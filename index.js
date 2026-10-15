/**
 * dsh-fixed-login-token — pin client-connection's per-process launch token.
 *
 * `@deepseek-ai/dsh-client-connection` mints one random 32-byte launch token
 * per process (a module-private WeakMap keyed by the root context, never
 * persisted and not configurable) and reuses that same field for both halves
 * of the browser login:
 *
 *   - `BrowserAuth.authenticatedUrl(baseUrl)` puts it in the `?token=` query
 *     that `@deepseek-ai/dsh-web-app` prints and hands to the default browser;
 *   - `BrowserAuth.authorizeIndex(req, res)` accepts it on `GET /`, writes the
 *     signed session cookie, and 303-redirects to the clean `./`.
 *
 * Pinning that single field therefore makes the printed URL deterministic and
 * keeps the exchange consistent, without reimplementing the cookie, its HMAC
 * signing, the expiry, or the 401 path. The upload is prototype-level so a
 * Connection reload — which mints a fresh BrowserAuth from the same class and
 * would otherwise re-randomize the token — stays pinned as well.
 */
import Schema from '@deepseek-ai/schemastery'

/** Stable Cordis plugin name. */
export const name = 'fixed-login-token'

/**
 * Services required before this plugin can pin anything: the row stays
 * inactive in compositions without `connection` instead of throwing.
 */
export const inject = ['connection']

/** Fixed token used when the row config names none. */
const DEFAULT_TOKEN = 'dsh-fixed-login-token'

/** Shortest accepted token: a fixed token is a standing credential. */
const MIN_TOKEN_LENGTH = 8

/** Row config: the fixed launch token, overridable from a later patch layer. */
export const Config = Schema.object({
  token: Schema.string().default(DEFAULT_TOKEN),
})

/**
 * Pin this process's browser launch token.
 * @param ctx - plugin context carrying the `connection` service.
 * @param config - validated {@link Config}.
 */
export function apply(ctx, config) {
  const token = config?.token ?? DEFAULT_TOKEN
  if (typeof token !== 'string' || token.length < MIN_TOKEN_LENGTH) {
    throw new Error(`fixed-login-token: config.token must be a string of at least ${String(MIN_TOKEN_LENGTH)} characters`)
  }
  const auth = ctx.connection.browserAuth
  if (
    auth === undefined
    || typeof auth.authenticatedUrl !== 'function'
    || typeof auth.authorizeIndex !== 'function'
    || !Object.hasOwn(auth, 'launchToken')
  ) {
    throw new Error('fixed-login-token: client-connection BrowserAuth no longer exposes the launch token; this plugin needs an update')
  }
  const prototype = Object.getPrototypeOf(auth)
  const originalAuthenticatedUrl = prototype.authenticatedUrl
  const originalAuthorizeIndex = prototype.authorizeIndex
  ctx.effect(() => {
    prototype.authenticatedUrl = function (baseUrl) {
      this.launchToken = token
      return originalAuthenticatedUrl.call(this, baseUrl)
    }
    prototype.authorizeIndex = function (req, res) {
      this.launchToken = token
      return originalAuthorizeIndex.call(this, req, res)
    }
    return () => {
      prototype.authenticatedUrl = originalAuthenticatedUrl
      prototype.authorizeIndex = originalAuthorizeIndex
    }
  }, 'fixed-login-token: pin the browser launch token')
  // Pin the instance that already exists too, so the startup URL line — printed
  // after the loader settles — already carries the fixed token.
  auth.launchToken = token
}
