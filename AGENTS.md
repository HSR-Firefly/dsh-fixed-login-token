# AGENTS.md

面向维护者与本仓库内的 agent：实现细节、接线契约、验证方法与易碎点。
最终用户文档在 [README.md](README.md)——**本仓库任何文件都不要写入机器绝对路径**，
profile 与 DSH 主目录一律用 `$DSH_HOME/profiles/<profile>/…` 表达。

## 组成

| 半侧 | 文件 | 作用 |
|---|---|---|
| Host | `index.js` + `cordis.patch.yml` | bundle patch 插入行 `fixed-login-token`，钉住启动 token |
| Client | `client.js`（`dsh.client`，`exports["./client"]`） | 在「插件」页注册该行的配置页 |

纯 JS、无构建步骤；Host 侧唯一外部依赖是 `@deepseek-ai/schemastery`（peer）。

## 为什么钉一个字段就能固定 token

`@deepseek-ai/dsh-client-connection/lib/index.js`：

- `processLaunchToken(owner)`（约 244-250）用 `randomBytes(32)` 生成随机 token，存进以 `ctx.root`
  为键的模块级 `WeakMap`，不落盘、无配置项、无命令行开关；
- `BrowserAuth` 构造时（约 352-357）把它写进**公开自有字段** `launchToken`；
- 同一个字段被两处消费：`authenticatedUrl(baseUrl)`（约 374-378）拼出被打印/被打开的 URL；
  `authorizeIndex(req,res)`（约 388-427）只在 `GET /` 接受它，写入 HMAC 签名的 `dsh-auth-*`
  Cookie（签名密钥持久化在凭据库，默认 30 天），再 303 到干净的 `./`。

因此插件只做一件事：在 `connection` 服务就绪后，把 `BrowserAuth.prototype` 上的
`authenticatedUrl` / `authorizeIndex` 各包一层，调用时先 `this.launchToken = <当前 token>` 再委托
原实现。Cookie、签名、过期、401 全部复用原实现，不重写。

要点与原因：

- **原型级而非实例级**：Connection 重载会从同一个类新建 `BrowserAuth`，实例级包装会被重置为随机值。
- **调用时读值**：token 在每次交换时重新读取（见下一节），所以界面里改完立即生效。
- **失败要响**：激活时校验 `browserAuth` 存在、`authenticatedUrl`/`authorizeIndex` 是函数、
  `launchToken` 是自有属性；若 DSH 将来改成 `#launchToken`，插件直接抛错而不是静默变成 401。
- **可卸载**：包装与还原都放在 `ctx.effect` 里，插件卸载即恢复原方法。

## 可编辑与免重启

- `Config.token = Schema.string().min(8).default(DEFAULT).volatile()`。
  schemastery 把 volatile 字段解析成**稳定引用**（`src/index.ts` 约 521-526、769），用 `.get()` 读当前值；
  引用在配置更新时原地更新，所以 `apply` 时捕获一次引用即可一直读到最新值。
- `@deepseek-ai/dsh-settings` 只把 **volatile 字段**投影成可编辑表单
  （`lib/types/schema.js` 的 `volatileForm`），并且 Loader 对"只有 volatile 变化"的配置更新不重挂插件。
- 写入持久化到 profile 的**用户层** `$DSH_HOME/profiles/<profile>/cordis.patch.yml`，优先级高于所有 bundle 层；
  界面保存与手改文件写的是同一份配置。
- `ctx.inject(['settings'], child => …settings.configure({ auto: false }, ctx.fiber))`：本包自带配置页，
  必须关掉 Settings 的自动生成页。

## 界面接线（Client 半侧）

- `package.json` 需同时具备 `exports["./client"]` 与 `dsh.client {platform:'web', immediately, inject}`；
  `dsh-client-modules` 的 node 半侧扫描 Loader 行里有 `dsh.client` 的包，按
  `/plugins/??<pkg>/client.js&rev=<rev>` 提供 bundle（**公开**、`text/javascript`、immutable），
  并把行写进 `window.__DSH_BOOT__`。
- `client.js` 注册进「插件」页声明的 keyed slot `plugins.row.config`，键为
  `<包名>#<行 id>` = `dsh-fixed-login-token#fixed-login-token`；**行 id 同时是设置命名空间**
  （设置表单按 profile 条目 id 寻址）。
- 页面以 props `{ view: 'page' | 'summary', form?: { state, mutate } }` 渲染我们的组件：
  `state` 是 ConfigFormSnapshot `{status,value,base,user,revision,writable,mode}`；
  写操作用 `form.mutate([{op:'set'|'unset', path:['token'], value}], revision)`（`revision` 可取 `undefined`，
  但**不要传 `null`**）。
- `ctx.slots.inject(name, cb)` 按"槽声明生命周期"运行回调：Plugins 页晚于本插件声明该槽也能注册成功。
- bundle 格式是惰性 CJS：`window.__ModuleLoader__.load({ id, factory(require) {…} })`，
  factory 里只从模块表取 `react`；**不要 import 任何 DSH Client 包**（升级即碎）。
- 文案按 `navigator.language` 在中/英间切换；未接 DSH 的 locale 服务（第三方插件的简化）。

## 展示元数据（插件页的名称与描述）

- 必须导出 `exports["./package.json"]`：读取器用包名自引用解析 `<pkg>/package.json`，缺了它只能回退到包名。
- `locale/<语言>.json` 的内容是 `{"meta":{"title":…,"description":…}}`
  （`dsh-app-boot` 的 `dictionariesOf` / `localizedText`）：每种语言一份，Client 按当前语言挑选，
  英文作为兜底，title 最终兜底是模块说明符、description 为空。
- 宿主进程会缓存一次"解析失败"（Node 解析缓存），因此**改元数据后需重启 `dsh web`** 才在页面生效。

## 验证

四个脚本位于本包上一级（工作区根目录）：

| 脚本 | 证明什么 |
|---|---|
| `../verify-fixed-token.ps1` | 两次启动打印同一 token；`?token=<固定值>` → 303 + `set-cookie`；错值/无凭据 → 401；仅 Cookie → 200 |
| `../verify-token-override.ps1` | 更晚的补丁层（`--patch`）能改掉被接受的 token |
| `../verify-settings-ui.ps1` | `settings/describe` 提供该命名空间（`writable`、`autoGenerate:false`、`value.token`）；`settings/mutate` 立刻生效（新值 303 / 旧值 401）并写入补丁；`unset` 后恢复原样；客户端 bundle 在启动图里且 GET 200 |
| `../verify-client-graph.ps1` | 启动图行的 `inject` 目标都存在（否则浏览器里永远不 materialize） |

运行须知：

- 每个脚本都会在 `--port 0 --no-open` 上临时起一个 `dsh web` 并在结束时杀掉，不要用它替换正在用的 GUI。
- 脚本会写 `$DSH_HOME` 与 profile 目录，在 workspace-write 沙箱下会被拒（EPERM）；需要一次性更宽权限。
- 用到的 RPC 形状：`POST /api/settings/<describe|mutate>`，体为
  `{"type":"client-request","rpcId":…,"method":"settings/<m>","payload":{"args":{…}}}`，
  应答 `{"type":"server-response","rpcId":…,"result":{"ok":true,"value":…}}`；
  `mutate` 的 `ns`/`ops`/`expectedRevision` 按 wire 名传，`expectedRevision` 是数字。
- 浏览器验证（browser-skill，需要先有 bsk daemon）：会话打开
  `http://127.0.0.1:<port>/?token=<固定 token>` → 侧边栏 **插件** → 该 bundle → **配置**。
  已验证：页面正常渲染；改值保存后立即生效并持久化；恢复默认后复原；输入不足 8 字符时保存禁用。

## 易碎点（DSH 升级后先查这些）

1. `@deepseek-ai/dsh-client-connection`：`BrowserAuth.launchToken` 仍是公开可写自有字段，
   `authenticatedUrl` / `authorizeIndex` 仍是原型方法。
2. `@deepseek-ai/dsh-client-ui-plugin-manager`：`plugins.row.config` 仍是 keyed slot，
   props 仍是 `{ view, form: { state, mutate } }`。
3. `@deepseek-ai/dsh-settings`：仍只投影 volatile 字段，写入仍落在用户层补丁。
4. `@deepseek-ai/dsh-client-modules` / `dsh-app-boot`：`exports["./client"]`、
   `dsh.client.platform === "web"`、`exports["./package.json"]` 仍是必需项。

改完先用 `dsh --profile web --dump-config`（应无诊断、含 `fixed-login-token` 行）快速自检，
再跑上表脚本与一次浏览器验证。
