import { authConfig, isAuthConfigured } from '../config'

// "Am I signed in?" for public pages like the landing page, WITHOUT loading
// the sign-in libraries (those only download on /app, keeping the public site
// light and Cognito-free).
//
// After sign-in, the private app keeps my tokens in this tab's sessionStorage
// under this key. This just peeks at whether they're there and who they're for.
// It's only a display hint: the real check happens in API Gateway on every request.
// sessionStorage is per tab, so a brand-new tab shows "Sign in" until I open /app.

const STORAGE_KEY = `oidc.user:https://cognito-idp.${authConfig.region}.amazonaws.com/${authConfig.userPoolId}:${authConfig.clientId}`

/** The signed-in email, or null if this tab isn't signed in. */
export function signedInEmail(): string | null {
  if (!isAuthConfigured) return null
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as {
      profile?: { email?: unknown }
      refresh_token?: string
      expires_at?: number
    } | null
    // Still usable if the access token hasn't expired, or can be quietly refreshed.
    const usable = !!stored && (!!stored.refresh_token || (stored.expires_at ?? 0) * 1000 > Date.now())
    return usable && typeof stored.profile?.email === 'string' ? stored.profile.email : null
  } catch {
    return null
  }
}
