import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import { AccessLogFormat } from 'aws-cdk-lib/aws-apigateway'
import { CorsHttpMethod, HttpApi, HttpMethod, HttpStage, LogGroupLogDestination } from 'aws-cdk-lib/aws-apigatewayv2'
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import type { Construct } from 'constructs'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The private side of ArmoryApply.
//   Phase 4: sign-in (Cognito)
//   Phase 5: the API (API Gateway → Lambda) and database (DynamoDB)
//   Phase 6: file storage for resumes and cover letters (S3)
//   Phase 7: alarms (CloudWatch → email), API access logs, tighter permissions,
//            branded sign-in page
//
// Cognito concepts:
//   - User pool: the directory of people who can sign in (just me).
//   - App client: registers my website with the user pool, so Cognito
//     knows where it may send people back after they sign in.
//   - Managed Login: Cognito's hosted sign-in page. My site never sees
//     my password; it only receives signed tokens afterwards.
//   - Tokens (JWTs): signed "wristbands". The ID token says who I am;
//     the access token is what the API (Phase 5) will check.

export interface BackendStackProps extends StackProps {
  /** The public site URL, e.g. https://d1iqw1qv83zyx7.cloudfront.net (no trailing slash). */
  siteUrl: string
  /** Where alarm emails go. */
  alertEmail: string
}

const LOCAL_DEV_URL = 'http://localhost:5173'

export class BackendStack extends Stack {
  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props)

    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'armoryapply-users',
      // Essentials: includes Managed Login; first 10,000 monthly users are free.
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
      // THE most important setting: nobody can create an account.
      // The only user is the one I create myself (see DEV_GUIDE.md).
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: Duration.days(3),
      },
      // Require a code from an authenticator app at every sign-in.
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { otp: true, sms: false },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      // The invite email. Cognito fills in {username} (their email) and {####}
      // (a temporary password that expires after 3 days).
      userInvitation: {
        emailSubject: "You're invited to ArmoryApply",
        emailBody: [
          "You've been invited to ArmoryApply, a private job application tracker.",
          '',
          `Sign in at: ${props.siteUrl}/app`,
          'Email: {username}',
          'Temporary password: {####}',
          '',
          "The temporary password expires in 3 days. When you first sign in, you'll choose your own password and set up an authenticator app (like Google Authenticator) for a 6-digit code.",
          '',
          `What's stored and who can see it: ${props.siteUrl}/privacy`,
        ].join('<br>'),
      },
      // My account must never be deleted by accident: block deletion in
      // the console/API, and keep it even if this stack is deleted.
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    })

    // Where the sign-in page lives: https://<prefix>.auth.us-east-1.amazoncognito.com
    // The prefix must be unique across AWS in this region.
    // Admins can invite and remove people from inside the app (lambda/accounts.ts).
    // Membership shows up in the access token as "cognito:groups".
    new cognito.CfnUserPoolGroup(this, 'AdminsGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'admins',
      description: 'Can invite and remove ArmoryApply users',
    })

    const domain = userPool.addDomain('LoginDomain', {
      cognitoDomain: { domainPrefix: `armoryapply-${this.account.slice(-6)}` },
      managedLoginVersion: cognito.ManagedLoginVersion.NEWER_MANAGED_LOGIN,
    })

    const client = userPool.addClient('WebClient', {
      userPoolClientName: 'armoryapply-web',
      // A browser app can't keep a secret (anyone can read its code), so it
      // has none. PKCE protects the sign-in instead (handled by the library).
      generateSecret: false,
      authFlows: { userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        // Cognito will ONLY send tokens back to these exact addresses.
        callbackUrls: [`${props.siteUrl}/app/callback`, `${LOCAL_DEV_URL}/app/callback`],
        logoutUrls: [`${props.siteUrl}/`, `${LOCAL_DEV_URL}/`],
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      // Don't reveal whether an email address has an account.
      preventUserExistenceErrors: true,
      idTokenValidity: Duration.hours(1),
      accessTokenValidity: Duration.hours(1),
      // Stay signed in up to 7 days; tokens refresh quietly in the background.
      refreshTokenValidity: Duration.days(7),
    })

    // The look of Cognito's sign-in page, matched to my site: indigo buttons and
    // links, a plain light background, and my shield logo on the form and tab.
    // branding/settings.json started as Cognito's full default style, recolored.
    // To restyle: use the visual editor (Cognito → Managed login → Style), then
    // export with `aws cognito-idp describe-managed-login-branding-by-client
    // --return-merged-resources` and copy its Settings into the file. (Editing
    // only in the console would be undone by the next deploy.)
    const brandingDir = new URL('../branding/', import.meta.url)
    const logo = readFileSync(new URL('logo.svg', brandingDir)).toString('base64')
    new cognito.CfnManagedLoginBranding(this, 'LoginBranding', {
      userPoolId: userPool.userPoolId,
      clientId: client.userPoolClientId,
      useCognitoProvidedValues: false,
      settings: JSON.parse(readFileSync(new URL('settings.json', brandingDir), 'utf8')),
      assets: [
        { category: 'FORM_LOGO', colorMode: 'LIGHT', extension: 'SVG', bytes: logo },
        { category: 'FAVICON_SVG', colorMode: 'LIGHT', extension: 'SVG', bytes: logo },
      ],
    })

    // ---------------------------------------------------------------- Phase 5

    // DynamoDB: the database. "On-demand" billing = pay per request, with no
    // servers to size; a personal tracker's traffic costs a fraction of a cent.
    // Layout and keys are explained in lambda/api.ts.
    const table = new dynamodb.TableV2(this, 'DataTable', {
      tableName: 'armoryapply-data',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      // Lets me restore the table to any second in the last 35 days ("undo"
      // for the whole database). Costs about $0.20/GB-month; my data is KBs.
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      // My real data: block deletion, and keep the table even if the stack is deleted.
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    })

    // ---------------------------------------------------------------- Phase 6

    // S3: private storage for resumes and cover letters. Nobody can reach a
    // file without a 5-minute presigned link from the API (see lambda/documents.ts).
    const documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      // My real files: keep the bucket even if the stack is deleted.
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        // Uploads land in pending/ first; ones never attached (tab closed
        // mid-upload) are deleted automatically after a day.
        { id: 'expire-abandoned-uploads', prefix: 'pending/', expiration: Duration.days(1) },
      ],
      // The browser talks to S3 directly (upload, and fetching .docx files for
      // the in-app preview), so S3 must allow my site's address (CORS).
      cors: [
        {
          allowedOrigins: [props.siteUrl, LOCAL_DEV_URL],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST],
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
    })

    // Lambda: the code that runs for each API request (lambda/api.ts).
    // NodejsFunction bundles the TypeScript into one small JavaScript file
    // with esbuild during `cdk deploy`.
    const apiFunction = new NodejsFunction(this, 'ApiFunction', {
      functionName: 'armoryapply-api',
      entry: fileURLToPath(new URL('../lambda/api.ts', import.meta.url)),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
      // Graviton (ARM) processors: ~20% cheaper than x86 for the same work.
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      // Import from link may wait up to ~7 s on someone else's website.
      timeout: Duration.seconds(15),
      environment: {
        TABLE_NAME: table.tableName,
        BUCKET_NAME: documentsBucket.bucketName,
        USER_POOL_ID: userPool.userPoolId,
        MAX_USERS: '20',
      },
      // externalModules: [] bundles the AWS SDK into the function too (the
      // presigning helpers aren't built into Lambda), pinning exact versions.
      bundling: { minify: true, sourceMap: true, externalModules: [] },
      // Logs (console.log/console.error) go here and are deleted after a month.
      logGroup: new logs.LogGroup(this, 'ApiFunctionLogs', {
        logGroupName: '/aws/lambda/armoryapply-api',
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    })
    // Least privilege: this function may use THIS table and THIS bucket, nothing else.
    // (Presigned links carry the function's permissions, so they're limited the same way.)
    // Each list names exactly the actions the code uses, nothing more
    // (CDK's grantReadWrite helpers would also allow extras it never calls).
    apiFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:BatchWriteItem',
        ],
        resources: [table.tableArn],
      }),
    )
    // Reading (also used to copy, check and presign), uploading, deleting files...
    apiFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
        resources: [documentsBucket.arnForObjects('*')],
      }),
    )
    // ...and listing a user's files when deleting their account.
    apiFunction.addToRolePolicy(
      new iam.PolicyStatement({ actions: ['s3:ListBucket'], resources: [documentsBucket.bucketArn] }),
    )
    // ...and manage users in MY user pool: only the five actions invites and deletion need.
    userPool.grant(
      apiFunction,
      'cognito-idp:AdminCreateUser',
      'cognito-idp:AdminGetUser',
      'cognito-idp:AdminDeleteUser',
      'cognito-idp:ListUsers',
      'cognito-idp:ListUsersInGroup',
    )

    // API Gateway (HTTP API): the public front door to the function.
    const api = new HttpApi(this, 'Api', {
      apiName: 'armoryapply-api',
      // Browsers block a site from calling a different domain unless that
      // domain says it's OK. This is that "OK" (CORS), for my site only.
      corsPreflight: {
        allowOrigins: [props.siteUrl, LOCAL_DEV_URL],
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.PUT, CorsHttpMethod.DELETE],
        allowHeaders: ['authorization', 'content-type'],
        maxAge: Duration.hours(1),
      },
      createDefaultStage: false,
    })

    // Rate limit: past ~10 requests/second, extra requests get "429 Too Many
    // Requests" instead of running Lambda. Caps cost even if a token leaked.
    // Access log: one line per request (who, what, result), kept for a month.
    // Lets me investigate anything odd an alarm reports. No request bodies or tokens are logged.
    const accessLogs = new logs.LogGroup(this, 'ApiAccessLogs', {
      logGroupName: '/armoryapply/api-access',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    })
    const stage = new HttpStage(this, 'ApiStage', {
      httpApi: api,
      stageName: '$default',
      autoDeploy: true,
      throttle: { rateLimit: 10, burstLimit: 20 },
      accessLogSettings: {
        destination: new LogGroupLogDestination(accessLogs),
        format: AccessLogFormat.custom(
          JSON.stringify({
            requestId: '$context.requestId',
            time: '$context.requestTime',
            ip: '$context.identity.sourceIp',
            userAgent: '$context.identity.userAgent',
            route: '$context.routeKey',
            status: '$context.status',
            latencyMs: '$context.responseLatency',
            user: '$context.authorizer.claims.sub',
            authError: '$context.authorizer.error',
          }),
        ),
      },
    })

    // The bouncer at the door: every route requires a valid Cognito access
    // token issued to MY app client. API Gateway checks it before Lambda runs.
    const authorizer = new HttpUserPoolAuthorizer('CognitoAuthorizer', userPool, {
      userPoolClients: [client],
    })
    const integration = new HttpLambdaIntegration('ApiIntegration', apiFunction)
    const routes: [HttpMethod, string][] = [
      [HttpMethod.GET, '/applications'],
      [HttpMethod.POST, '/applications'],
      [HttpMethod.PUT, '/applications/{id}'],
      [HttpMethod.DELETE, '/applications/{id}'],
      [HttpMethod.POST, '/applications/{id}/documents/{kind}/upload'],
      [HttpMethod.PUT, '/applications/{id}/documents/{kind}'],
      [HttpMethod.DELETE, '/applications/{id}/documents/{kind}'],
      [HttpMethod.GET, '/documents/url'],
      [HttpMethod.GET, '/admin/users'],
      [HttpMethod.POST, '/admin/users'],
      [HttpMethod.DELETE, '/admin/users/{username}'],
      [HttpMethod.DELETE, '/account'],
      [HttpMethod.POST, '/import'],
    ]
    for (const [method, path] of routes) {
      api.addRoutes({ path, methods: [method], integration, authorizer })
    }

    // ---------------------------------------------------------------- Phase 7

    // Alarms: CloudWatch watches these numbers and emails me (via SNS) when
    // one crosses its line. Quiet periods count as "fine", not as missing data.
    const alerts = new sns.Topic(this, 'AlertsTopic', { topicName: 'armoryapply-alerts' })
    // AWS emails a "Confirm subscription" link first; alerts only arrive after I click it.
    alerts.addSubscription(new subscriptions.EmailSubscription(props.alertEmail))

    const alarm = (id: string, description: string, metric: cloudwatch.IMetric, threshold: number) => {
      new cloudwatch.Alarm(this, id, {
        alarmName: `armoryapply-${id}`,
        alarmDescription: description,
        metric,
        threshold,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }).addAlarmAction(new cloudwatchActions.SnsAction(alerts))
    }
    const fiveMinutes = { period: Duration.minutes(5), statistic: 'Sum' }

    alarm(
      'lambda-errors',
      'The API code crashed at least once. Check: aws logs tail /aws/lambda/armoryapply-api --since 1h',
      apiFunction.metricErrors(fiveMinutes),
      1,
    )
    alarm(
      'api-5xx',
      'The API returned server errors (5xx). Check the Lambda logs and /armoryapply/api-access.',
      stage.metricServerError(fiveMinutes),
      1,
    )
    alarm(
      'api-4xx-spike',
      'Many rejected requests (4xx) in 5 minutes: someone probing the API, or the site is broken. Check /armoryapply/api-access.',
      stage.metricClientError(fiveMinutes),
      50,
    )
    alarm(
      'api-traffic-spike',
      'Unusually high API traffic (1000+ requests in an hour). Check /armoryapply/api-access for who.',
      stage.metricCount({ period: Duration.hours(1), statistic: 'Sum' }),
      1000,
    )

    // These values are not secrets: they end up in the website's code anyway.
    new CfnOutput(this, 'Region', { value: this.region })
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId })
    new CfnOutput(this, 'UserPoolClientId', { value: client.userPoolClientId })
    new CfnOutput(this, 'LoginDomain', { value: `${domain.domainName}.auth.${this.region}.amazoncognito.com` })
    new CfnOutput(this, 'ApiUrl', { value: stage.url })
    new CfnOutput(this, 'DocumentsBucketName', { value: documentsBucket.bucketName })
  }
}
