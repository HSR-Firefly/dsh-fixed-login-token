/**
 * dsh-fixed-login-token — browser half.
 *
 * Registers the plugin's own configuration page into the Plugins page's
 * `plugins.row.config` slot, keyed `<package name>#<row id>`. That page hands
 * the entry a Host-owned configuration form for the row (`form.state` /
 * `form.mutate`), which is the same settings transport the official
 * configuration pages use; the row id doubles as the settings namespace, and
 * the editable field is the volatile `token` of the Host half's Config.
 *
 * Plain-JS bundle in the client module format: the factory is registered at
 * script execution and everything else happens at materialization.
 */
window.__ModuleLoader__.load({
  id: 'dsh-fixed-login-token',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Must equal the bundle's package name, so the graph row matches. */
    const PACKAGE_NAME = 'dsh-fixed-login-token'
    /** The row id this bundle's patch declares; also the settings namespace. */
    const ROW_ID = 'fixed-login-token'
    /** The keyed-slot key the Plugins page looks up for this row. */
    const ENTRY_KEY = `${PACKAGE_NAME}#${ROW_ID}`
    /** The volatile Config field this page edits. */
    const FIELD = 'token'
    /** Mirrors the Host schema's `.min()` so a write is never sent invalid. */
    const MIN_TOKEN_LENGTH = 8

    const ZH = {
      summary: '固定登录 token，可在此修改',
      title: '固定登录 token',
      loading: '正在读取设置…',
      unavailable: '当前页面无法读写 Host 设置（例如通过非本机地址打开），此设置保持不可用。',
      fieldLabel: '登录 token',
      placeholder: '至少 8 个字符',
      save: '保存',
      saving: '保存中…',
      reset: '恢复默认',
      copied: '已复制',
      copy: '复制登录链接',
      copyFailed: '复制失败，请手动选择上面的文本',
      saved: '已保存。新 token 立即生效；下一次启动 dsh web 时打印的就是它。',
      resetDone: '已恢复默认 token。',
      refused: 'Host 拒绝了这次写入（可能被更高优先级的配置层覆盖）。',
      failed: '写入失败：',
      tooShort: `token 至少需要 ${String(MIN_TOKEN_LENGTH)} 个字符`,
      whitespace: 'token 不能包含空格或换行',
      unchanged: '与当前值相同，无需保存',
      urlLabel: '登录链接（浏览器首次访问用；已登录的浏览器靠 Cookie，不受影响）',
      note: '修改后：正在运行的 GUI 打印的旧链接作废，但已经登录的浏览器 Cookie（默认 30 天）继续有效；重启 dsh web 后打印的链接就是新的固定 token。',
      defaultHasValue: '当前值来自本插件的默认配置',
      overridden: '当前值来自你的覆盖配置',
    }
    const EN = {
      summary: 'Fixed login token, editable here',
      title: 'Fixed login token',
      loading: 'Reading settings…',
      unavailable: 'This page cannot read or write Host settings (for example when opened through a non-loopback address), so the setting stays unavailable.',
      fieldLabel: 'Login token',
      placeholder: 'at least 8 characters',
      save: 'Save',
      saving: 'Saving…',
      reset: 'Reset to default',
      copied: 'Copied',
      copy: 'Copy login URL',
      copyFailed: 'Copy failed; select the text above instead',
      saved: 'Saved. The new token applies immediately, and the next dsh web start prints it.',
      resetDone: 'Default token restored.',
      refused: 'The Host refused this write (a higher-priority configuration layer may override it).',
      failed: 'Write failed: ',
      tooShort: `A token needs at least ${String(MIN_TOKEN_LENGTH)} characters`,
      whitespace: 'A token cannot contain spaces or line breaks',
      unchanged: 'Same as the current value; nothing to save',
      urlLabel: 'Login URL (for a browser’s first visit; an already signed-in browser uses its cookie)',
      note: 'After a change: the link a running GUI already printed stops working, while cookies in browsers already signed in (30 days by default) keep working; the next dsh web start prints the new fixed token.',
      defaultHasValue: 'Current value comes from this plugin’s default configuration',
      overridden: 'Current value comes from your override',
    }
    const TEXT = String(navigator.language ?? '').toLowerCase().startsWith('zh') ? ZH : EN

    /** Validation shared by the save button and the write path. */
    function validate(draft) {
      if (draft.length < MIN_TOKEN_LENGTH) return TEXT.tooShort
      if (/\s/u.test(draft)) return TEXT.whitespace
      return null
    }

    /** The login URL a browser should open first, built from the page's own origin. */
    function loginUrl(token) {
      return `${location.origin}/?token=${encodeURIComponent(token)}`
    }

    /** Plugin-owned styles; rendered inside the tree so unmounting removes them. */
    function styles() {
      return h('style', { 'data-dsh-fixed-login-token': '' }, `
.dshFixedLoginToken{display:flex;flex-direction:column;gap:12px;font-family:var(--dsw-font-family);color:var(--dsw-alias-label-primary)}
.dshFixedLoginTokenRow{display:flex;flex-direction:column;gap:6px}
.dshFixedLoginTokenLabel{color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}
.dshFixedLoginTokenInput{box-sizing:border-box;width:100%;max-width:520px;height:36px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-family:var(--ds-font-family-code);font-size:13px}
.dshFixedLoginTokenInput:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.dshFixedLoginTokenActions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dshFixedLoginTokenButton{box-sizing:border-box;height:32px;padding:0 14px;border-radius:var(--dsw-radius-md);border:.5px solid transparent;font-family:inherit;font-size:13px;cursor:pointer}
.dshFixedLoginTokenButton:disabled{cursor:default;opacity:.5}
.dshFixedLoginTokenButton[data-variant=primary]{background:var(--dsw-alias-brand-primary);color:var(--dsw-static-neutral-00)}
.dshFixedLoginTokenButton[data-variant=outline]{background:0 0;border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}
.dshFixedLoginTokenHint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;max-width:640px}
.dshFixedLoginTokenUrl{box-sizing:border-box;width:100%;max-width:640px;padding:8px 12px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);font-family:var(--ds-font-family-code);font-size:12px;line-height:18px;word-break:break-all;user-select:all}
.dshFixedLoginTokenError{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}
.dshFixedLoginTokenOk{color:var(--dsw-alias-state-success-primary);font-size:12px;line-height:18px}
`)
    }

    /**
     * The row's configuration page. Props come from the Plugins page: `view` is
     * `page` for the form (which supplies its own save control) or `summary`
     * for the row's one-line fallback; `form` carries the Host-owned values and
     * the atomic write action, and is absent when the Host serves no such
     * namespace.
     */
    class FixedLoginTokenPage extends React.Component {
      constructor(props) {
        super(props)
        this.state = { draft: null, saving: false, notice: null, copied: false }
      }

      /** Save the draft through the Host form with the revision that was read. */
      save(draft) {
        const form = this.props.form
        if (form === undefined) return
        const invalid = validate(draft)
        if (invalid !== null) {
          this.setState({ notice: { kind: 'error', text: invalid } })
          return
        }
        const revision = form.state?.revision
        this.setState({ saving: true, notice: null })
        Promise.resolve(form.mutate([{ op: 'set', path: [FIELD], value: draft }], revision)).then((accepted) => {
          this.setState({
            saving: false,
            draft: null,
            notice: accepted === true ? { kind: 'ok', text: TEXT.saved } : { kind: 'error', text: TEXT.refused },
          })
        }).catch((error) => {
          this.setState({ saving: false, notice: { kind: 'error', text: `${TEXT.failed}${String(error?.message ?? error)}` } })
        })
      }

      /** Drop the user layer so the field re-inherits the bundle's default. */
      reset() {
        const form = this.props.form
        if (form === undefined) return
        const revision = form.state?.revision
        this.setState({ saving: true, notice: null })
        Promise.resolve(form.mutate([{ op: 'unset', path: [FIELD] }], revision)).then((accepted) => {
          this.setState({
            saving: false,
            draft: null,
            notice: accepted === true ? { kind: 'ok', text: TEXT.resetDone } : { kind: 'error', text: TEXT.refused },
          })
        }).catch((error) => {
          this.setState({ saving: false, notice: { kind: 'error', text: `${TEXT.failed}${String(error?.message ?? error)}` } })
        })
      }

      /** Copy the current login URL; loopback pages are a secure context. */
      copy(url) {
        const clipboard = navigator.clipboard
        if (clipboard === undefined || typeof clipboard.writeText !== 'function') {
          this.setState({ notice: { kind: 'error', text: TEXT.copyFailed } })
          return
        }
        Promise.resolve(clipboard.writeText(url)).then(() => {
          this.setState({ copied: true })
        }).catch(() => {
          this.setState({ notice: { kind: 'error', text: TEXT.copyFailed } })
        })
      }

      render() {
        if (this.props.view === 'summary') return h('span', null, TEXT.summary)
        const form = this.props.form
        const state = form?.state
        const style = styles()
        if (state === undefined) {
          return h('div', { className: 'dshFixedLoginToken' }, style, h('p', { className: 'dshFixedLoginTokenHint' }, TEXT.unavailable))
        }
        if (state.status === 'loading') {
          return h('div', { className: 'dshFixedLoginToken' }, style, h('p', { className: 'dshFixedLoginTokenHint' }, TEXT.loading))
        }
        if (state.status === 'unavailable') {
          return h('div', { className: 'dshFixedLoginToken' }, style, h('p', { className: 'dshFixedLoginTokenHint' }, TEXT.unavailable))
        }
        const stored = state.value !== null && typeof state.value === 'object' ? state.value[FIELD] : undefined
        const current = typeof stored === 'string' ? stored : ''
        const draft = this.state.draft ?? current
        const overridden = state.user !== null && typeof state.user === 'object' && Object.hasOwn(state.user, FIELD)
        const invalid = validate(draft)
        const disabled = this.state.saving || state.writable !== true || invalid !== null || draft === current
        const url = loginUrl(draft)
        return h('div', { className: 'dshFixedLoginToken' }, [
          style,
          h('div', { className: 'dshFixedLoginTokenRow', key: 'field' }, [
            h('label', { className: 'dshFixedLoginTokenLabel', key: 'label', htmlFor: `dshFixedLoginTokenField` }, TEXT.fieldLabel),
            h('input', {
              className: 'dshFixedLoginTokenInput',
              key: 'input',
              id: 'dshFixedLoginTokenField',
              type: 'text',
              spellCheck: false,
              autoComplete: 'off',
              placeholder: TEXT.placeholder,
              value: draft,
              disabled: state.writable !== true,
              onChange: (event) => {
                this.setState({ draft: event.target.value, notice: null, copied: false })
              },
              onKeyDown: (event) => {
                if (event.key === 'Enter' && !disabled) this.save(draft)
              },
            }),
            h('p', { className: 'dshFixedLoginTokenHint', key: 'hint' }, invalid ?? (overridden ? TEXT.overridden : TEXT.defaultHasValue)),
          ]),
          h('div', { className: 'dshFixedLoginTokenActions', key: 'actions' }, [
            h('button', {
              className: 'dshFixedLoginTokenButton',
              'data-variant': 'primary',
              key: 'save',
              type: 'button',
              disabled,
              onClick: () => {
                this.save(draft)
              },
            }, this.state.saving ? TEXT.saving : TEXT.save),
            h('button', {
              className: 'dshFixedLoginTokenButton',
              'data-variant': 'outline',
              key: 'reset',
              type: 'button',
              disabled: this.state.saving || state.writable !== true || !overridden,
              onClick: () => {
                this.reset()
              },
            }, TEXT.reset),
          ]),
          this.state.notice === null
            ? null
            : h('p', {
              key: 'notice',
              className: this.state.notice.kind === 'ok' ? 'dshFixedLoginTokenOk' : 'dshFixedLoginTokenError',
            }, this.state.notice.text),
          h('div', { className: 'dshFixedLoginTokenRow', key: 'url' }, [
            h('span', { className: 'dshFixedLoginTokenHint', key: 'urllabel' }, TEXT.urlLabel),
            h('code', { className: 'dshFixedLoginTokenUrl', key: 'urlvalue' }, url),
            h('div', { className: 'dshFixedLoginTokenActions', key: 'urlactions' }, h('button', {
              className: 'dshFixedLoginTokenButton',
              'data-variant': 'outline',
              type: 'button',
              onClick: () => {
                this.copy(url)
              },
            }, this.state.copied ? TEXT.copied : TEXT.copy)),
          ]),
          h('p', { className: 'dshFixedLoginTokenHint', key: 'note' }, TEXT.note),
        ])
      }
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        // `inject` runs the callback for each declaration lifetime of the slot,
        // so registering before the Plugins page declares it still works and a
        // collapse withdraws the page.
        ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
          name: 'plugins.row.config',
          key: ENTRY_KEY,
        }, FixedLoginTokenPage))
      },
    }
  },
})
