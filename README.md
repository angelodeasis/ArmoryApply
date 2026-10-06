# ArmoryApply

A personal job application tracker built as a hands-on AWS serverless project.

**Live demo:** https://d1iqw1qv83zyx7.cloudfront.net/demo (sample data, no account needed)

- **Public demo** (`/demo`): runs entirely in the browser on sample data. It makes no backend calls and requires no account.
- **Private app** (`/app`): Cognito login → API Gateway (JWT-protected) → Lambda → DynamoDB, with resume files in a private S3 bucket.

## Architecture

```
Recruiter ─► /demo ─► React app ─► DemoDataSource (sample data in localStorage)
                         ▲
              CloudFront ─► S3 (static site, private via OAC)

Owner ─► /app ─► Cognito login ─► JWT
                     │
                     ▼
           API Gateway HTTP API (JWT authorizer, throttled)
                     │
                     ▼
                  Lambda ─► DynamoDB
                     └────► S3 resumes bucket (presigned URLs)

CloudWatch logs + alarms · AWS Budgets alert
```

## Repository layout

| Path | Contents |
|---|---|
| `frontend/` | Vite + React + TypeScript + Tailwind |
| `backend/` | Lambda handler (Phase 5) |
| `infra/` | AWS CDK app: `lib/site-stack.ts` (S3 + CloudFront) |

## Local development

```bash
cd frontend
npm install
npm run dev
```

## Deploying (AWS CDK)

Infrastructure is defined in TypeScript in `infra/` and deployed with AWS CDK to `us-east-1`.

```bash
aws login                          # short-lived credentials (run in a normal terminal)
cd infra
npm install
npx cdk bootstrap                  # one time per account/region
npm run deploy                     # builds frontend/, then cdk deploy
```

`npx cdk diff` shows what a deploy would change; `npx cdk destroy` removes the site.

## Roadmap

- [x] Phase 1: scaffold, data model, demo data source
- [x] Phase 2: dashboard, list, detail, forms, folders, and document viewer on demo data
- [ ] Phase 3: CDK, S3 + CloudFront hosting (public demo live)
- [ ] Phase 4: Cognito authentication
- [ ] Phase 5: DynamoDB + Lambda + API Gateway
- [ ] Phase 6: resume + cover letter uploads to a private S3 bucket (presigned URLs)
- [ ] Phase 7: CloudWatch alarms, log retention, IAM review
- [ ] Phase 8: **Import from link**: paste a job posting URL and a Lambda extracts the details
      (schema.org JobPosting data, Greenhouse/Lever public APIs) into a pre-filled form to review
      before saving. Private app only, with SSRF protections.
