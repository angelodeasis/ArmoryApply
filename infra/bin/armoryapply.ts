import { App, Tags } from 'aws-cdk-lib'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { BackendStack } from '../lib/backend-stack'
import { SiteStack } from '../lib/site-stack'

// Entry point: `cdk synth` / `cdk deploy` run this file (see cdk.json).

const siteDir = fileURLToPath(new URL('../../frontend/dist', import.meta.url))
if (!existsSync(`${siteDir}/index.html`)) {
  throw new Error(`No built site at ${siteDir}. Run "npm run build:frontend" (or "npm run deploy") first.`)
}

// The public site's address (from the ArmoryApply-Site stack's SiteUrl output).
// Cognito needs it to know where it may send me back after signing in.
const SITE_URL = 'https://d1iqw1qv83zyx7.cloudfront.net'

// Personal settings that shouldn't be on GitHub live in infra/.env (gitignored),
// e.g.  ALERT_EMAIL=me@example.com
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)))
} catch {
  // No .env file: fine, the checks below explain what's missing.
}
const ALERT_EMAIL = process.env.ALERT_EMAIL
if (!ALERT_EMAIL) {
  throw new Error('Set ALERT_EMAIL in infra/.env (where alarm emails go). See DEV_GUIDE.md.')
}

// CDK_DEFAULT_ACCOUNT comes from your current AWS login. Without it, names
// built from the account number break with confusing errors, so stop early.
if (!process.env.CDK_DEFAULT_ACCOUNT) {
  throw new Error('Not signed in to AWS (or the session expired). Run "aws login" in a regular terminal, then try again.')
}
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' }

const app = new App()

new SiteStack(app, 'ArmoryApply-Site', {
  env,
  description: 'ArmoryApply public website (S3 + CloudFront)',
  siteDir,
  // From the ArmoryApply-Backend stack's outputs (also in frontend/src/config.ts).
  backend: {
    apiUrl: 'https://vlf1iqac1b.execute-api.us-east-1.amazonaws.com',
    cognitoRegion: 'us-east-1',
    loginDomain: 'armoryapply-182613.auth.us-east-1.amazoncognito.com',
    documentsBucket: 'armoryapply-backend-documentsbucket9ec9deb9-xit6gzkqgstr',
  },
})

new BackendStack(app, 'ArmoryApply-Backend', {
  env,
  description: 'ArmoryApply private backend: sign-in (Cognito), API + database, resume files (S3)',
  siteUrl: SITE_URL,
  alertEmail: ALERT_EMAIL,
})

// Tag every resource so the Billing console can show this project's costs.
Tags.of(app).add('project', 'armoryapply')
