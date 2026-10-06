import { App, Tags } from 'aws-cdk-lib'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SiteStack } from '../lib/site-stack'

// Entry point: `cdk synth` / `cdk deploy` run this file (see cdk.json).

const siteDir = fileURLToPath(new URL('../../frontend/dist', import.meta.url))
if (!existsSync(`${siteDir}/index.html`)) {
  throw new Error(`No built site at ${siteDir}. Run "npm run build:frontend" (or "npm run deploy") first.`)
}

const app = new App()

new SiteStack(app, 'ArmoryApply-Site', {
  // CDK_DEFAULT_ACCOUNT comes from your current AWS login.
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
  description: 'ArmoryApply public website (S3 + CloudFront)',
  siteDir,
})

// Tag every resource so the Billing console can show this project's costs.
Tags.of(app).add('project', 'armoryapply')
