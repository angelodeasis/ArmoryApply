import { User } from 'oidc-client-ts'
import { apiConfig, authConfig } from '../config'
import { ApiDataSource } from '../data/ApiDataSource'

// Sign-in settings and the API connection for the private app, in one place
// so both PrivateApp.tsx and the Account page can use them.

export const oidcConfig = {
  authority: `https://cognito-idp.${authConfig.region}.amazonaws.com/${authConfig.userPoolId}`,
  client_id: authConfig.clientId,
  redirect_uri: `${window.location.origin}/app/callback`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  response_type: 'code',
  scope: 'openid email profile',
  automaticSilentRenew: true,
  // After the callback, remove ?code=... from the address bar.
  onSigninCallback: () => window.history.replaceState({}, document.title, window.location.pathname),
}

// The tokens live in this tab's sessionStorage under this key (the library's
// naming). Reading them at request time means the API always gets the latest
// token, even right after a background refresh.
function getAccessToken(): string | undefined {
  const stored = sessionStorage.getItem(`oidc.user:${oidcConfig.authority}:${oidcConfig.client_id}`)
  return stored ? User.fromStorageString(stored).access_token : undefined
}

// Same pages as the demo; only the data source differs (see router.tsx).
export const apiSource = new ApiDataSource(apiConfig.url, getAccessToken)
