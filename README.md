# dsh-fixed-login-token

把 DSH Web GUI 的"每进程随机登录 token"固定成一个固定值。

## 它解决什么

`dsh web` 启动时会打印并打开一行带 `?token=...` 的 URL。这个 token 由
`@deepseek-ai/dsh-client-connection` 每个进程用 `randomBytes(32)` 现生成，只存在内存里：
没有配置项、没有环境变量、没有命令行开关，重启一次就变一次（所以书签、多浏览器、无痕窗口
都要重新抓 URL）。本插件把该进程的启动 token 钉成固定值，于是打印的 URL 每次完全一样。

登录链路本身没有改动：token 仍然只在 `GET /` 上被接受一次，成功后照旧写入签名的
`dsh-auth-*` Cookie（HttpOnly / SameSite=Strict，默认 30 天），再 303 重定向到干净的 `./`。
也就是说：**固定 token 只影响首登那一步**，已有 Cookie 的浏览器行为完全不变。

## 原理

`BrowserAuth` 的同一个字段同时供两处使用：

- `authenticatedUrl(baseUrl)` —— 拼进被打印/被打开的 URL；
- `authorizeIndex(req, res)` —— `GET /` 上校验该 token。

所以插件只需在 `connection` 服务就绪后，把 `browserAuth.launchToken` 钉住，并在原型上包一层
`authenticatedUrl` / `authorizeIndex`，让两者在任何时刻都读到同一个固定值（原型级包装是为了让
Connection 重载后新建的实例也保持固定）。Cookie、签名、过期、401 逻辑全部复用原实现。

## 安装与启用

作为 bundle 安装到 profile（本机默认 profile 是 `web`）：

```powershell
dsh plugin --profile web add link:D:/Users/Firefly/Documents/deepseek-harness/dsh-disable-randomlogintoken/dsh-fixed-login-token
```

然后把包名加入 profile 的 `dsh.profile.bundles`（等价于插件管理器安装时自动完成的这一步）：

```json
"C:\\Users\\Firefly\\.dsh\\profiles\\web\\package.json"
{
  "dsh": { "profile": { "bundles": [ "...", "dsh-fixed-login-token" ] } }
}
```

检查合成结果（不绑定端口）：

```powershell
dsh --profile web --dump-config
```

输出中应出现 `fixed-login-token` 行与 `token: dsh-fixed-login-token`。改动在下一次
`dsh web` 启动时生效。

## 改 token

用户补丁层优先级高于 bundle 层，因此在 profile 的用户补丁文件里覆盖即可（不要改本包）：

```yaml
# C:\Users\Firefly\.dsh\profiles\web\cordis.patch.yml
- id: fixed-login-token
  config:
    token: 'your-own-fixed-token'
```

token 至少 8 个字符；它会被放进 URL 的 query，建议只用 `A-Z a-z 0-9 - _`。

**安全提醒**：固定 token 等于一个长期有效的登录凭据。`dsh web` 明确拒绝 `--host 0.0.0.0`，
默认只绑 `127.0.0.1`，所以不指定非回环 `--host` 时暴露面仅本机；一旦要把 GUI 暴露到局域网，
请把 token 换成长随机串。

## 停用 / 卸载

轻量停用（保留安装，重启后回到原生随机 token）：

```yaml
# C:\Users\Firefly\.dsh\profiles\web\cordis.patch.yml
- id: fixed-login-token
  disabled: true
```

完整卸载：

```powershell
dsh plugin --profile web remove dsh-fixed-login-token
```

并从 `dsh.profile.bundles` 中移除 `dsh-fixed-login-token`。

## 依赖与边界

- 依赖 `@deepseek-ai/dsh-client-connection` 的公开结构：字段 `BrowserAuth.launchToken` 以及原型方法
  `authenticatedUrl` / `authorizeIndex`。若将来 DSH 把这些改成私有字段（`#launchToken`），插件会在
  激活时直接报错（而不是静默变成 401），需要随之更新。卸载时恢复被包装的原始方法。
- DSH 升级后先看 `dsh --profile web --dump-config` 是否仍无诊断，再重启 GUI。
- 本包只做 Host 侧改动，没有 Client 半侧，因此不参与 `window.__DSH_BOOT__`，也不需要重建 Web 产物。
- 不做的事：不实现"完全免 token 登录"，也不做 token 轮换。
