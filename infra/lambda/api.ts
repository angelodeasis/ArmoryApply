import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  type QueryCommandOutput,
} from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda'
import { randomUUID } from 'node:crypto'
import type { JobApplication } from '../../frontend/src/types/application'
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

const TABLE = process.env.TABLE_NAME!
const MAX_BODY_BYTES = 64 * 1024

// Created once per Lambda "container" and reused across requests (faster).
// removeUndefinedValues: optional fields that are empty are simply not stored.
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
})

type Event = APIGatewayProxyEventV2WithJWTAuthorizer
type Item = JobApplication & { pk: string; sk: string }

const userKey = (sub: string) => `USER#${sub}`
const appKey = (id: string) => `APP#${id}`

function json(statusCode: number, body?: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: body === undefined ? '' : JSON.stringify(body),
  }
}

/** Drop the database keys before sending a record to the browser. */
function toApplication({ pk: _pk, sk: _sk, ...app }: Item): JobApplication {
  return app
}

function readBody(event: Event): unknown {
  const raw = event.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString('utf8') : (event.body ?? '')
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) throw new ValidationError('Request is too large')
  try {
    return JSON.parse(raw)
  } catch {
    throw new ValidationError('Request body must be valid JSON')
  }
}

/** Application IDs are UUIDs we generate; reject anything else early. */
function pathId(event: Event): string {
  const id = event.pathParameters?.id ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ValidationError('Invalid application id')
  return id
}

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
  await db.send(new DeleteCommand({ TableName: TABLE, Key: { pk: userKey(sub), sk: appKey(id) } }))
  return json(204)
}

export async function handler(event: Event): Promise<APIGatewayProxyResultV2> {
  // "sub" = the user's permanent Cognito ID, taken from the verified token.
  const sub = event.requestContext.authorizer.jwt.claims.sub
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
