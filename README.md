# ArmoryApply

A personal job application tracker built as a hands-on AWS serverless project.

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
| `infra/` | AWS CDK stack (Phase 3+) |

## Local development

```bash
cd frontend
npm install
npm run dev
```

## Roadmap

- [x] Phase 1: scaffold, data model, demo data source
- [ ] Phase 2: dashboard, list, detail, and forms on demo data
- [ ] Phase 3: CDK, S3 + CloudFront hosting (public demo live)
- [ ] Phase 4: Cognito authentication
- [ ] Phase 5: DynamoDB + Lambda + API Gateway
- [ ] Phase 6: resume uploads to S3
- [ ] Phase 7: CloudWatch alarms, log retention, IAM review
