import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { S3Client } from '@aws-sdk/client-s3'
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda'
import type { JobApplication } from '../../frontend/src/types/application'
import { ValidationError } from './validate'

// Pieces used by both api.ts (applications) and documents.ts (files).

export const TABLE = process.env.TABLE_NAME!
export const BUCKET = process.env.BUCKET_NAME!

// Created once per Lambda "container" and reused across requests (faster).
// removeUndefinedValues: optional fields that are empty are simply not stored.
export const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
})
export const s3 = new S3Client({})

export type Event = APIGatewayProxyEventV2WithJWTAuthorizer
export type Item = JobApplication & { pk: string; sk: string }

export const userKey = (sub: string) => `USER#${sub}`
export const appKey = (id: string) => `APP#${id}`

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MAX_BODY_BYTES = 64 * 1024

export function json(statusCode: number, body?: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: body === undefined ? '' : JSON.stringify(body),
  }
}

/** Drop the database keys before sending a record to the browser. */
export function toApplication({ pk: _pk, sk: _sk, ...app }: Item): JobApplication {
  return app
}

export function readBody(event: Event): unknown {
  const raw = event.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString('utf8') : (event.body ?? '')
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) throw new ValidationError('Request is too large')
  try {
    return JSON.parse(raw)
  } catch {
    throw new ValidationError('Request body must be valid JSON')
  }
}

/** Application IDs are UUIDs we generate; reject anything else early. */
export function pathId(event: Event): string {
  const id = event.pathParameters?.id ?? ''
  if (!UUID.test(id)) throw new ValidationError('Invalid application id')
  return id
}
