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
 * signing, the expiry, or the 401 path. The wrap is prototype-level so a
 * Connection reload — which mints a fresh BrowserAuth from the same class and
 * would otherwise re-randomize the token — stays pinned as well.
 *
 * The token is declared `.volatile()`, which is what makes it editable from the
 * Web UI: schemastery parses a volatile field into a stable reference whose
 * `.get()` always returns the current value, and `@deepseek-ai/dsh-settings`
 * builds its form from the volatile part of the Config schema. A write from the
 * client half (`client.js`, the Plugins page's configuration page) updates that
 * reference in place, persists through the active profile's Cordis patch, and
 * takes effect on the next exchange without a restart.
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
export const DEFAULT_TOKEN = 'dsh-fixed-login-token'

/** Shortest accepted token: a fixed token is a standing credential. */
export const MIN_TOKEN_LENGTH = 8

/**
 * Row config. `token` is volatile so the settings-backed configuration form can
 * edit it live: the parsed value is a reference read with `.get()`.
 */
export const Config = Schema.object({
  token: Schema.string().min(MIN_TOKEN_LENGTH).default(DEFAULT_TOKEN).volatile(),
})

/**
 * Read the live token from the volatile Config reference.
 *
 * A volatile field is updated in place by a settings write, so the reference
 * captured at activation keeps returning the current value. The plain-value
 * branch covers a composition that supplies the field without the reference
 * wrapper.
 * @param config - validated {@link Config}.
 * @returns the token to pin, falling back to the default when the configured
 * value is absent or too short.
 */
function readToken(config) {
  const field = config?.token
  const value = typeof field?.get === 'function' ? field.get() : field
  return typeof value === 'string' && value.length >= MIN_TOKEN_LENGTH ? value : DEFAULT_TOKEN
}

/**
 * Pin this process's browser launch token.
 * @param ctx - plugin context carrying the `connection` service.
 * @param config - validated {@link Config}.
 */
export function apply(ctx, config) {
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
    // Read the token at call time, never once at activation, so a settings
    // write that lands later is honoured by both halves of the exchange.
    prototype.authenticatedUrl = function (baseUrl) {
      this.launchToken = readToken(config)
      return originalAuthenticatedUrl.call(this, baseUrl)
    }
    prototype.authorizeIndex = function (req, res) {
      this.launchToken = readToken(config)
      return originalAuthorizeIndex.call(this, req, res)
    }
    return () => {
      prototype.authenticatedUrl = originalAuthenticatedUrl
      prototype.authorizeIndex = originalAuthorizeIndex
    }
  }, 'fixed-login-token: pin the browser launch token')
  // Pin the instance that already exists too, so the startup URL line — printed
  // after the loader settles — already carries the fixed token.
  auth.launchToken = readToken(config)
  // This package ships its own configuration page (client.js) on the Plugins
  // page, so the Settings service must not also generate a page from the schema.
  ctx.inject(['settings'], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
  })
}
