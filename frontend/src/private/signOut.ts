import type { AuthContextProps } from 'react-oidc-context'
import { authConfig } from '../config'

/**
 * Sign out everywhere:
 * 1. Ask Cognito to cancel the refresh token, so it can't be reused.
 * 2. Forget the tokens stored in this browser tab.
 * 3. Visit Cognito's /logout page to end the session on the sign-in page too
 *    (otherwise the next "Sign in" would skip the password). Cognito then
 *    sends me back to the home page.
 */
let signingOut = false

/** True once sign-out has started, so /app doesn't immediately sign me back in. */
export const isSigningOut = () => signingOut

export async function signOut(auth: AuthContextProps) {
  // Removing the tokens (step 2) makes /app think "not signed in → go sign in".
  // Without this flag, that sign-in redirect races the /logout redirect below
  // and wins, and Cognito (whose session isn't ended yet) signs me straight back in.
  signingOut = true
  try {
    await auth.revokeTokens(['refresh_token'])
  } catch {
    // Not fatal: the refresh token still expires on its own (7 days).
  }
  await auth.removeUser()
  const params = new URLSearchParams({ client_id: authConfig.clientId, logout_uri: `${window.location.origin}/` })
  window.location.assign(`https://${authConfig.loginDomain}/logout?${params}`)
}
