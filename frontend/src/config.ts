// Settings for the private app, copied from the `ArmoryApply-Backend` stack's
// outputs after it's deployed. None of these are secrets: anyone can read a
// website's code, and Cognito security doesn't depend on hiding them.
export const authConfig = {
  region: 'us-east-1',
  userPoolId: 'us-east-1_BczimFLao',
  clientId: '3m1avqv91llq1na42sqk8up7dh',
  /** e.g. armoryapply-182613.auth.us-east-1.amazoncognito.com (no https://) */
  loginDomain: 'armoryapply-182613.auth.us-east-1.amazoncognito.com',
}

export const isAuthConfigured = Boolean(authConfig.userPoolId && authConfig.clientId && authConfig.loginDomain)
