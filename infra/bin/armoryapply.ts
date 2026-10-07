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

// CDK_DEFAULT_ACCOUNT comes from your current AWS login.
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' }

const app = new App()

new SiteStack(app, 'ArmoryApply-Site', {
  env,
  description: 'ArmoryApply public website (S3 + CloudFront)',
  siteDir,
})

new BackendStack(app, 'ArmoryApply-Backend', {
  env,
  description: 'ArmoryApply private backend: sign-in (Cognito), API + database; files in Phase 6',
  siteUrl: SITE_URL,
})

// Tag every resource so the Billing console can show this project's costs.
Tags.of(app).add('project', 'armoryapply')
