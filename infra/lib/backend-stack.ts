import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import type { Construct } from 'constructs'

// The private side of ArmoryApply. Phase 4: sign-in (Cognito).
// Phases 5–6 add the API, database, and file storage to this same stack.
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
      userInvitation: {
        emailSubject: 'Your ArmoryApply account',
        emailBody:
          'Your ArmoryApply login is {username} with temporary password {####} . You will be asked to choose a new password and set up an authenticator app.',
      },
      // My account must never be deleted by accident: block deletion in
      // the console/API, and keep it even if this stack is deleted.
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    })

    // Where the sign-in page lives: https://<prefix>.auth.us-east-1.amazoncognito.com
    // The prefix must be unique across AWS in this region.
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

    // Managed Login needs a "style" attached to the app client. Use Cognito's default look.
    new cognito.CfnManagedLoginBranding(this, 'LoginBranding', {
      userPoolId: userPool.userPoolId,
      clientId: client.userPoolClientId,
      useCognitoProvidedValues: true,
    })

    // These values are not secrets: they end up in the website's code anyway.
    new CfnOutput(this, 'Region', { value: this.region })
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId })
    new CfnOutput(this, 'UserPoolClientId', { value: client.userPoolClientId })
    new CfnOutput(this, 'LoginDomain', { value: `${domain.domainName}.auth.${this.region}.amazoncognito.com` })
  }
}
