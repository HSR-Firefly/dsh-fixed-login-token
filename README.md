# dsh-fixed-login-token

把 DSH Web GUI 的「每进程随机登录 token」固定成一个固定值，并可以在 Web UI 里直接编辑它。

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
Connection 重载后新建的实例也保持固定）。Cookie、签名、过期、401 逻辑全部复用原实现。被包装的
方法在卸载时恢复。

## 在 Web UI 里编辑

token 是 Config 里用 `.volatile()` 声明的字段。这是 DSH 的设置机制要求的形状：

- schemastery 把 volatile 字段解析成**稳定引用**，用 `.get()` 读当前值 —— 所以插件在每次 token
  交换时读到的都是最新值，**保存后立即生效，不需要重启**；
- `@deepseek-ai/dsh-settings` 只把「volatile 字段」投影成可编辑表单，写入持久化到当前 profile 的
  Cordis patch（即用户层配置，优先级高于 bundle 层）。

界面遵循 DSH 自己的约定：**插件的配置页在侧边栏「插件」（Plugins）页上**，而不是「设置」对话框中
（设置 → 内置插件 只有只读清单）。本插件注册的是 `plugins.row.config` slot，键为
`dsh-fixed-login-token#fixed-login-token`，因此：

1. 打开侧边栏 **插件**；
2. 在 **已安装** 分组里选 `dsh-fixed-login-token`；
3. 在该 bundle 的页面上，对行 `fixed-login-token` 点 **配置 / Configure**；
4. 页面里可以改 token、保存、恢复默认，并显示/复制当前登录链接。

保存后的行为：新 token 立即对下一次首登生效；**正在运行的 GUI 之前打印的旧链接作废**，但已经登录
的浏览器 Cookie 继续有效；下一次 `dsh web` 启动打印的就是新的固定 token。

## 安装与启用

作为 bundle 安装到 profile（本机默认 profile 是 `web`）：

```powershell
dsh plugin --profile web add link:D:/Users/Firefly/Documents/deepseek-harness/dsh-disable-randomlogintoken/dsh-fixed-login-token
```

该命令会同时把它写进 profile 的 `dsh.profile.bundles`。检查合成结果（不绑定端口）：

```powershell
dsh --profile web --dump-config
```

## 用文件改 token（等价的另一条路）

用户补丁层优先级最高，也可以直接写文件：

```yaml
# C:\Users\Firefly\.dsh\profiles\web\cordis.patch.yml
- id: fixed-login-token
  config:
    token: 'your-own-fixed-token'
```

两种方式改的是**同一个用户层配置**：UI 保存会写进这个文件，文件里的值也会出现在 UI 里。

token 至少 8 个字符（schema 用 `.min()` 强制，UI 也会先校验）；它会被放进 URL 的 query，建议只用
`A-Z a-z 0-9 - _ . ~`。

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
  激活时直接报错（而不是静默变成 401），需要随之更新。
- 客户端半侧（`client.js`）只注册 `plugins.row.config` 一个 slot，并要求 Host 已组合
  `@deepseek-ai/dsh-client-ui-settings` 与 `@deepseek-ai/dsh-client-ui-plugin-manager`（本 profile
  的 web bundle 默认都有）。DSH 的 Client 包不作为模块导入，只使用 slot 契约传递的 props。
- 界面文案按 `navigator.language` 在中/英之间切换；没有接入 DSH 的 locale 服务（第三方插件的简化）。
- 插件在「插件」页上的显示名称/描述走 DSH 的展示元数据：必须导出 `exports["./package.json"]`，并在
  `locale/<语言>.json` 里写成 `{ "meta": { "title": ..., "description": ... } }`（每种语言一份，Client
  按当前语言挑选）。缺这两项时页面只会显示包名。修改元数据后需重启 `dsh web` 生效（宿主进程会缓存
  一次解析结果）。
- 非回环页面（例如通过其它主机名打开）在 DSH 里不提供持久设置，此时配置页只显示不可用提示。
- 本包只做 Host 侧改动加一个纯 JS 客户端 bundle，不需要构建步骤。
- 不做的事：不实现「完全免 token 登录」，也不做 token 轮换。
