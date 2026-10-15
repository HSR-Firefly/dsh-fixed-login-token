# dsh-fixed-login-token

把 DSH Web 界面的登录链接Token固定，并提供一个界面随时修改它。

## 它解决什么

每次启动 `dsh web`，终端会打印（并打开）一行带 `?token=...` 的链接。这个 token 每次启动都会变，
所以书签、无痕窗口、另一台设备/另一个浏览器每次都要重新去终端里复制。

装上本插件后：token 固定不变，登录链接也就固定不变；想换一个，直接在界面里改。

登录方式本身没有变化：固定 token 只用于**浏览器第一次登录**；登录成功后仍然照常写入登录
Cookie（默认 30 天），之后不再需要 token。

## 修改 token（界面）

1. 打开侧边栏 **插件**；
2. 在 **已安装** 里选 **`dsh-fixed-login-token`**；
3. 在该 bundle 页面上，对组件行 **`fixed-login-token`** 点 **配置 / Configure**；
4. 在页面里修改 **登录 token** 后点 **保存**；页面同时会显示并可复制当前登录链接。

需要复原时点 **恢复默认**。保存后的效果：

- 新的 token **立刻**对"新浏览器首次登录"生效，不必重启；
- 已经在用的浏览器因为已有登录 Cookie，不受影响；
- 下一次启动 `dsh web` 时，终端打印的就是新的固定 token。

> 界面只能在能读写本机设置的页面上编辑（通过本机地址打开的 GUI）。其它情况下页面会提示不可用。

## token 规则与安全提醒

- 至少 8 个字符；建议只使用 `A-Z a-z 0-9 - _ . ~`（它会出现在链接里）。
- 固定 token 等于一个长期有效的登录凭据。界面默认只绑定本机 `127.0.0.1`，此时只有本机能用；
  如果你用 `--host` 把界面暴露到局域网，请把 token 改成一串很长的随机值。

## 安装

在本插件目录里执行（`$PWD` 由 PowerShell 展开为当前目录）：

```powershell
dsh plugin --profile web add "link:$PWD"
```

然后重启 `dsh web`。

## 用文件改 / 临时停用 / 卸载

界面保存的值与下面文件里的值是**同一份配置**（用户层配置，优先级最高，重装插件不会丢）。
`<profile>` 默认是 `web`，`$DSH_HOME` 默认是 `~/.dsh`：

```yaml
# $DSH_HOME/profiles/<profile>/cordis.patch.yml
- id: fixed-login-token
  config:
    token: 'your-own-fixed-token'    # 换掉固定 token
    # disabled: true                 # 或临时停用，重启后回到原生随机 token
```

完整卸载：

```powershell
dsh plugin --profile web remove dsh-fixed-login-token
```

并从该 profile `package.json` 的 `dsh.profile.bundles` 里移除 `dsh-fixed-login-token`。

## 说明

- 需要 DSH 的 Web 界面（`web` profile）。
- 界面文案随浏览器语言在中/英之间切换。
- 不改动登录与 Cookie 机制，也不做 token 轮换；本插件不实现"完全免 token 登录"。
- 面向开发者/维护者的实现与验证细节见 [AGENTS.md](AGENTS.md)。
