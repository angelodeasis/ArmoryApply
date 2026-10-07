import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  ListUsersInGroupCommand,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider'
import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { BatchWriteCommand, QueryCommand, type BatchWriteCommandInput } from '@aws-sdk/lib-dynamodb'
import { BUCKET, db, json, readBody, s3, TABLE, userKey, UUID, type Event } from './shared'
import { ValidationError } from './validate'

// Accounts: invites (admins only) and account deletion.
//
// Sign-up is turned off in Cognito, so the ONLY way to get an account is an
// invite from an admin (me). An invite asks Cognito to create the account and
// email a temporary password. The new person then signs in, picks their own
// password, and sets up an authenticator app, just like I did.
//
// Who's an admin? Anyone in the Cognito group "admins". Cognito writes the
// groups into the access token ("cognito:groups"), and API Gateway has already
// verified that token, so this can't be faked.

const POOL_ID = process.env.USER_POOL_ID!
const ADMIN_GROUP = 'admins'
// Safety cap on the number of accounts, so a mistake (or a stolen admin
// session) can't create hundreds of users or send hundreds of emails.
const MAX_USERS = Number(process.env.MAX_USERS ?? 20)

const cognito = new CognitoIdentityProviderClient({})

type Claims = Record<string, unknown>

/** True if the verified token says this person is in the "admins" group. */
export function isAdmin(claims: Claims): boolean {
  // API Gateway passes lists as text, e.g. "[admins]" or "[admins, other]".
  const groups = String(claims['cognito:groups'] ?? '')
    .replace(/[[\]]/g, '')
    .split(/[\s,]+/)
  return groups.includes(ADMIN_GROUP)
}

function forbidden() {
  return json(403, { message: 'Only admins can do that' })
}

const attr = (user: UserType, name: string) => user.Attributes?.find((a) => a.Name === name)?.Value

async function listAllUsers(): Promise<UserType[]> {
  const users: UserType[] = []
  let token: string | undefined
  do {
    const page = await cognito.send(new ListUsersCommand({ UserPoolId: POOL_ID, PaginationToken: token }))
    users.push(...(page.Users ?? []))
    token = page.PaginationToken
  } while (token)
  return users
}

async function adminUsernames(): Promise<Set<string>> {
  const page = await cognito.send(new ListUsersInGroupCommand({ UserPoolId: POOL_ID, GroupName: ADMIN_GROUP }))
  return new Set((page.Users ?? []).map((u) => u.Username!))
}

/** GET /admin/users → everyone with an account (admins only). */
export async function listUsers(claims: Claims) {
  if (!isAdmin(claims)) return forbidden()
  const [users, admins] = await Promise.all([listAllUsers(), adminUsernames()])
  const result = users.map((u) => ({
    username: u.Username!,
    email: attr(u, 'email') ?? '',
    // FORCE_CHANGE_PASSWORD = invited but hasn't signed in yet.
    status: u.UserStatus === 'FORCE_CHANGE_PASSWORD' ? 'invited' : u.Enabled ? 'active' : 'disabled',
    isAdmin: admins.has(u.Username!),
    createdAt: u.UserCreateDate?.toISOString() ?? '',
  }))
  result.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return json(200, { users: result, maxUsers: MAX_USERS })
}

/** POST /admin/users { email } → invite someone, or re-send a pending invite. */
export async function inviteUser(claims: Claims, event: Event) {
  if (!isAdmin(claims)) return forbidden()
  const body = readBody(event) as { email?: unknown }
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('Enter a valid email address')
  }

  // Already has an account? Re-send the invite if they never signed in.
  let existing
  try {
    existing = await cognito.send(new AdminGetUserCommand({ UserPoolId: POOL_ID, Username: email }))
  } catch (err) {
    if (!(err instanceof Error && err.name === 'UserNotFoundException')) throw err
  }
  if (existing) {
    if (existing.UserStatus !== 'FORCE_CHANGE_PASSWORD') {
      return json(409, { message: 'That person already has an active account' })
    }
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: POOL_ID,
        Username: email,
        MessageAction: 'RESEND',
        DesiredDeliveryMediums: ['EMAIL'],
      }),
    )
    return json(200, { message: `Invite re-sent to ${email}` })
  }

  if ((await listAllUsers()).length >= MAX_USERS) {
    return json(409, { message: `Account limit reached (${MAX_USERS}). Remove someone first.` })
  }
  await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        // I'm vouching for this address, so Cognito won't ask them to verify it.
        { Name: 'email_verified', Value: 'true' },
      ],
      DesiredDeliveryMediums: ['EMAIL'],
    }),
  )
  return json(201, { message: `Invite sent to ${email}` })
}

/**
 * Permanently delete one user's applications, files, and login.
 * Data goes first: if a step fails, the login still exists, so it can be retried.
 */
async function deleteUserEverywhere(username: string, sub: string) {
  // 1. Every database record under USER#<sub>, 25 at a time (DynamoDB's batch limit).
  let startKey: Record<string, unknown> | undefined
  do {
    const page = await db.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': userKey(sub) },
        ProjectionExpression: 'pk, sk',
        ExclusiveStartKey: startKey,
      }),
    )
    const keys = page.Items ?? []
    for (let i = 0; i < keys.length; i += 25) {
      let request: BatchWriteCommandInput['RequestItems'] = {
        [TABLE]: keys.slice(i, i + 25).map((Key) => ({ DeleteRequest: { Key } })),
      }
      // DynamoDB may hand back some deletes as "unprocessed" when busy; retry those.
      for (let attempt = 0; request && Object.keys(request).length && attempt < 5; attempt++) {
        request = (await db.send(new BatchWriteCommand({ RequestItems: request }))).UnprocessedItems
      }
      if (request && Object.keys(request).length) throw new Error('Could not delete all records; try again')
    }
    startKey = page.LastEvaluatedKey
  } while (startKey)

  // 2. Every file under their folders, including unfinished uploads.
  for (const prefix of [`users/${sub}/`, `pending/users/${sub}/`]) {
    let token: string | undefined
    do {
      const page = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }))
      const objects = (page.Contents ?? []).map((o) => ({ Key: o.Key! }))
      if (objects.length) {
        await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: objects, Quiet: true } }))
      }
      token = page.NextContinuationToken
    } while (token)
  }

  // 3. The login itself.
  await cognito.send(new AdminDeleteUserCommand({ UserPoolId: POOL_ID, Username: username }))
}

/** DELETE /admin/users/{username} → remove someone (and all their data). Admins only; never another admin. */
export async function removeUser(claims: Claims, event: Event) {
  if (!isAdmin(claims)) return forbidden()
  const username = event.pathParameters?.username ?? ''
  if (!UUID.test(username)) throw new ValidationError('Invalid user')
  if ((await adminUsernames()).has(username)) return json(400, { message: "Admins can't be removed from the app" })

  let user
  try {
    user = await cognito.send(new AdminGetUserCommand({ UserPoolId: POOL_ID, Username: username }))
  } catch (err) {
    if (err instanceof Error && err.name === 'UserNotFoundException') return json(204)
    throw err
  }
  const sub = user.UserAttributes?.find((a) => a.Name === 'sub')?.Value
  if (!sub) throw new Error('User has no sub')
  await deleteUserEverywhere(username, sub)
  return json(204)
}

/** DELETE /account → delete MY account and everything in it. Admins can't (protects the owner). */
export async function deleteMyAccount(claims: Claims, sub: string) {
  if (isAdmin(claims)) return json(400, { message: "The admin account can't be deleted from the app" })
  const username = typeof claims.username === 'string' ? claims.username : sub
  await deleteUserEverywhere(username, sub)
  return json(204)
}
