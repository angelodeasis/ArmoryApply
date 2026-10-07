import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { randomUUID } from 'node:crypto'
import { MAX_DOCUMENT_BYTES } from '../../frontend/src/lib/documents'
import { DOCUMENT_KINDS, type DocumentKind, type StoredFile } from '../../frontend/src/types/application'
import {
  appKey,
  BUCKET,
  db,
  json,
  pathId,
  readBody,
  s3,
  TABLE,
  toApplication,
  userKey,
  UUID,
  type Event,
  type Item,
} from './shared'
import { ValidationError } from './validate'

// Resume and cover letter files, stored in a private S3 bucket.
//
// The browser never gets AWS credentials. Instead, this function hands out
// "presigned" links: short-lived permission slips, signed by this function,
// that allow exactly ONE action on exactly ONE file for a few minutes.
//
// Uploading takes three steps:
//   1. Browser: "I want to upload resume.pdf (200 KB)."
//      → this function checks the type and size and returns a presigned POST
//        for a temporary key: pending/users/<sub>/<random id>
//        (S3 itself enforces the size limit and file type in that slip.)
//   2. Browser uploads the file DIRECTLY to S3 (it never passes through Lambda).
//   3. Browser: "Done, attach it."
//      → this function checks the file really arrived, moves it to its final
//        key users/<sub>/<app id>/<kind>/<random id>, saves it on the
//        application, and deletes the old file it replaced.
//
// If step 3 never happens (tab closed mid-upload), the file stays under
// pending/, and a bucket rule deletes everything there after a day.
// So abandoned uploads can't pile up ("orphans").
//
// Viewing/downloading: a presigned GET link that works for 5 minutes.

const LINK_SECONDS = 5 * 60

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

const FIELD: Record<DocumentKind, 'resumeFile' | 'coverLetterFile'> = {
  resume: 'resumeFile',
  coverLetter: 'coverLetterFile',
}

const pendingPrefix = (sub: string) => `pending/users/${sub}/`
const finalPrefix = (sub: string) => `users/${sub}/`

function pathKind(event: Event): DocumentKind {
  const kind = event.pathParameters?.kind as DocumentKind
  if (!DOCUMENT_KINDS.includes(kind)) throw new ValidationError('Document kind must be resume or coverLetter')
  return kind
}

/** A file name that's safe to store and show: no folders, no control characters, not too long. */
function cleanFileName(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('fileName is required')
  const name = value.replace(/[\u0000-\u001f\u007f/\\]/g, '').trim().slice(-200)
  if (!name) throw new ValidationError('fileName is required')
  return name
}

/** PDF and Word only, decided by the file extension. Returns the matching content type. */
function contentTypeFor(fileName: string): string {
  const type = CONTENT_TYPES[fileName.toLowerCase().split('.').pop() ?? '']
  if (!type) throw new ValidationError('Only PDF and Word (.doc/.docx) files are allowed')
  return type
}

async function getItem(sub: string, id: string): Promise<Item | undefined> {
  const { Item: item } = await db.send(new GetCommand({ TableName: TABLE, Key: { pk: userKey(sub), sk: appKey(id) } }))
  return item as Item | undefined
}

async function deleteObject(key: string | undefined) {
  if (key) await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

/** Delete the stored files of an application that was just deleted. */
export async function deleteFilesOf(item: Partial<Item> | undefined) {
  await Promise.all([deleteObject(item?.resumeFile?.key), deleteObject(item?.coverLetterFile?.key)])
}

/** Step 1: POST /applications/{id}/documents/{kind}/upload → a presigned POST. */
export async function createUpload(sub: string, event: Event) {
  const id = pathId(event)
  pathKind(event)
  const body = readBody(event) as { fileName?: unknown; size?: unknown }
  const contentType = contentTypeFor(cleanFileName(body?.fileName))
  const size = body?.size
  if (typeof size !== 'number' || size < 1 || size > MAX_DOCUMENT_BYTES) {
    throw new ValidationError('Files must be between 1 byte and 5 MB')
  }
  if (!(await getItem(sub, id))) return json(404, { message: 'Application not found' })

  const uploadKey = `${pendingPrefix(sub)}${randomUUID()}`
  const { url, fields } = await createPresignedPost(s3, {
    Bucket: BUCKET,
    Key: uploadKey,
    // Rules S3 enforces on the upload itself, whatever the browser claims:
    Conditions: [
      ['content-length-range', 1, MAX_DOCUMENT_BYTES],
      ['eq', '$Content-Type', contentType],
    ],
    Fields: { 'Content-Type': contentType },
    Expires: LINK_SECONDS,
  })
  return json(200, { url, fields, uploadKey })
}

/** Step 3: PUT /applications/{id}/documents/{kind} → attach the uploaded file. */
export async function attachUpload(sub: string, event: Event) {
  const id = pathId(event)
  const kind = pathKind(event)
  const body = readBody(event) as { uploadKey?: unknown; fileName?: unknown }
  const fileName = cleanFileName(body?.fileName)
  const contentType = contentTypeFor(fileName)

  // The upload key must be one of MY pending uploads (never someone else's file).
  const uploadKey = typeof body?.uploadKey === 'string' ? body.uploadKey : ''
  if (!uploadKey.startsWith(pendingPrefix(sub)) || !UUID.test(uploadKey.slice(pendingPrefix(sub).length))) {
    throw new ValidationError('Invalid upload')
  }

  const existing = await getItem(sub, id)
  if (!existing) return json(404, { message: 'Application not found' })

  let head
  try {
    head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: uploadKey }))
  } catch {
    throw new ValidationError('Upload not found. It may have expired; please try again.')
  }
  if (head.ContentType !== contentType || !head.ContentLength || head.ContentLength > MAX_DOCUMENT_BYTES) {
    await deleteObject(uploadKey)
    throw new ValidationError('The uploaded file does not match what was requested')
  }

  // Move it from pending/ to its permanent place.
  const finalKey = `${finalPrefix(sub)}${id}/${kind}/${randomUUID()}`
  await s3.send(new CopyObjectCommand({ Bucket: BUCKET, CopySource: `${BUCKET}/${uploadKey}`, Key: finalKey }))
  await deleteObject(uploadKey)

  const stored: StoredFile = {
    fileName,
    key: finalKey,
    size: head.ContentLength,
    uploadedAt: new Date().toISOString(),
  }
  let updated
  try {
    updated = await db.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { pk: userKey(sub), sk: appKey(id) },
        UpdateExpression: 'SET #file = :file, updatedAt = :now',
        ExpressionAttributeNames: { '#file': FIELD[kind] },
        ExpressionAttributeValues: { ':file': stored, ':now': stored.uploadedAt },
        ConditionExpression: 'attribute_exists(pk)',
        ReturnValues: 'ALL_NEW',
      }),
    )
  } catch (err) {
    await deleteObject(finalKey) // the application vanished meanwhile: don't leave the file behind
    throw err
  }
  // Replacing a file deletes the old one.
  await deleteObject(existing[FIELD[kind]]?.key)
  return json(200, toApplication(updated.Attributes as Item))
}

/** DELETE /applications/{id}/documents/{kind} → detach and delete the file. */
export async function removeDocument(sub: string, event: Event) {
  const id = pathId(event)
  const kind = pathKind(event)
  const existing = await getItem(sub, id)
  if (!existing) return json(404, { message: 'Application not found' })

  const updated = await db.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { pk: userKey(sub), sk: appKey(id) },
      UpdateExpression: 'REMOVE #file SET updatedAt = :now',
      ExpressionAttributeNames: { '#file': FIELD[kind] },
      ExpressionAttributeValues: { ':now': new Date().toISOString() },
      ConditionExpression: 'attribute_exists(pk)',
      ReturnValues: 'ALL_NEW',
    }),
  )
  await deleteObject(existing[FIELD[kind]]?.key)
  return json(200, toApplication(updated.Attributes as Item))
}

/** GET /documents/url?key=...&purpose=view|download → a 5-minute link to one of MY files. */
export async function documentUrl(sub: string, event: Event) {
  const key = event.queryStringParameters?.key ?? ''
  const purpose = event.queryStringParameters?.purpose === 'download' ? 'download' : 'view'

  // Keys look like users/<sub>/<app id>/<kind>/<file id>. It must be under MY folder...
  const [, , id, kind, fileId] = key.split('/')
  if (!key.startsWith(finalPrefix(sub)) || !UUID.test(id ?? '') || !UUID.test(fileId ?? '')) {
    throw new ValidationError('Invalid file')
  }
  // ...and still attached to one of my applications (deleted files can't be fetched).
  const item = await getItem(sub, id)
  const file = item && DOCUMENT_KINDS.includes(kind as DocumentKind) ? item[FIELD[kind as DocumentKind]] : undefined
  if (!file || file.key !== key) return json(404, { message: 'File not found' })

  // "attachment" = save the file; "inline" = show it in the browser.
  // filename* carries non-English names safely (RFC 5987).
  const ascii = file.fileName.replace(/[^\x20-\x7e]|["\\]/g, '_')
  const disposition = `${purpose === 'download' ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ResponseContentDisposition: disposition,
      ResponseContentType: contentTypeFor(file.fileName),
    }),
    { expiresIn: LINK_SECONDS },
  )
  return json(200, { url })
}
