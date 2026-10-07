import { DeleteCommand, GetCommand, PutCommand, QueryCommand, type QueryCommandOutput } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyResultV2 } from 'aws-lambda'
import { randomUUID } from 'node:crypto'
import type { JobApplication } from '../../frontend/src/types/application'
import { deleteMyAccount, inviteUser, listUsers, removeUser } from './accounts'
import { importFromUrl } from './import'
import { attachUpload, createUpload, deleteFilesOf, documentUrl, removeDocument } from './documents'
import { appKey, db, json, pathId, readBody, TABLE, toApplication, userKey, type Event, type Item } from './shared'
import { parseApplicationInput, ValidationError } from './validate'

// The ArmoryApply API: one small Lambda function that handles every route.
//
//   Browser ──(access token)──► API Gateway ──► this function ──► DynamoDB
//
// By the time a request reaches this code, API Gateway has ALREADY checked
// the Cognito token (signature, expiry, which app it was issued to). Requests
// without a valid token are rejected before Lambda even starts, so strangers
// can't run this code or cost me money.
//
// Each user's data lives under their own Cognito user ID ("sub"), which comes
// from the verified token, never from the request. So a user can only ever
// read or change their own records, even if they edit the request.
//
// DynamoDB table layout (one table, "single-table design"):
//   pk (partition key) = "USER#<sub>"   → groups everything belonging to one user
//   sk (sort key)      = "APP#<id>"     → one job application
// "Give me all my applications" is then one Query on pk: fast and cheap.
//
// Files (resumes, cover letters) are handled in documents.ts,
// invites and account deletion in accounts.ts, Import from link in import.ts.

async function listApplications(sub: string) {
  const items: Item[] = []
  // A single Query returns at most 1 MB, so keep asking until there's no "next page".
  let startKey: QueryCommandOutput['LastEvaluatedKey']
  do {
    const page = await db.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :app)',
        ExpressionAttributeValues: { ':pk': userKey(sub), ':app': 'APP#' },
        ExclusiveStartKey: startKey,
      }),
    )
    items.push(...((page.Items ?? []) as Item[]))
    startKey = page.LastEvaluatedKey
  } while (startKey)
  return json(200, items.map(toApplication))
}

async function createApplication(sub: string, event: Event) {
  const input = parseApplicationInput(readBody(event))
  const now = new Date().toISOString()
  const app: JobApplication = { ...input, id: randomUUID(), createdAt: now, updatedAt: now }
  await db.send(new PutCommand({ TableName: TABLE, Item: { pk: userKey(sub), sk: appKey(app.id), ...app } }))
  return json(201, app)
}

async function updateApplication(sub: string, event: Event) {
  const id = pathId(event)
  const input = parseApplicationInput(readBody(event))
  const key = { pk: userKey(sub), sk: appKey(id) }
  const { Item: existing } = await db.send(new GetCommand({ TableName: TABLE, Key: key }))
  if (!existing) return json(404, { message: 'Application not found' })

  const app: JobApplication = {
    ...input,
    id,
    // Server-managed fields are kept from the stored record, not taken from the request.
    resumeFile: existing.resumeFile,
    coverLetterFile: existing.coverLetterFile,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  }
  await db.send(
    new PutCommand({
      TableName: TABLE,
      Item: { ...key, ...app },
      // Don't recreate it if it was deleted a moment ago (e.g. in another tab).
      ConditionExpression: 'attribute_exists(pk)',
    }),
  )
  return json(200, app)
}

async function deleteApplication(sub: string, event: Event) {
  const id = pathId(event)
  // Deleting something that's already gone is fine: the result is the same.
  // ALL_OLD hands back what was deleted, so its files can be deleted too.
  const { Attributes: deleted } = await db.send(
    new DeleteCommand({ TableName: TABLE, Key: { pk: userKey(sub), sk: appKey(id) }, ReturnValues: 'ALL_OLD' }),
  )
  await deleteFilesOf(deleted as Item | undefined)
  return json(204)
}

export async function handler(event: Event): Promise<APIGatewayProxyResultV2> {
  // "sub" = the user's permanent Cognito ID, taken from the verified token.
  const claims = event.requestContext.authorizer.jwt.claims
  const sub = claims.sub
  if (typeof sub !== 'string' || !sub) return json(401, { message: 'Not signed in' })

  try {
    switch (event.routeKey) {
      case 'GET /applications':
        return await listApplications(sub)
      case 'POST /applications':
        return await createApplication(sub, event)
      case 'PUT /applications/{id}':
        return await updateApplication(sub, event)
      case 'DELETE /applications/{id}':
        return await deleteApplication(sub, event)
      case 'POST /applications/{id}/documents/{kind}/upload':
        return await createUpload(sub, event)
      case 'PUT /applications/{id}/documents/{kind}':
        return await attachUpload(sub, event)
      case 'DELETE /applications/{id}/documents/{kind}':
        return await removeDocument(sub, event)
      case 'GET /documents/url':
        return await documentUrl(sub, event)
      case 'GET /admin/users':
        return await listUsers(claims)
      case 'POST /admin/users':
        return await inviteUser(claims, event)
      case 'DELETE /admin/users/{username}':
        return await removeUser(claims, event)
      case 'DELETE /account':
        return await deleteMyAccount(claims, sub)
      case 'POST /import':
        return await importFromUrl(event)
      default:
        return json(404, { message: 'Not found' })
    }
  } catch (err) {
    if (err instanceof ValidationError) return json(400, { message: err.message })
    if (err instanceof Error && err.name === 'ConditionalCheckFailedException') {
      return json(404, { message: 'Application not found' })
    }
    // Log the details for me (CloudWatch), but don't reveal them to the caller.
    console.error('Unhandled error', { routeKey: event.routeKey, err })
    return json(500, { message: 'Something went wrong on the server' })
  }
}
