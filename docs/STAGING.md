# 鲸灵匣 · 线上预发环境

地址：https://jinglingxia-staging.earthymars15.chatgpt.site

这是独立的预发站，默认仅站点所有者登录 ChatGPT 后访问。正式站继续使用 Workbuddy 的原有发布机制和域名。预发记录保存在预发域名的浏览器存储，与正式站分开，既有 localStorage 键不变。

## 环境标识

- Sites project_id：`appgprj_6adf878c19f48191ba974e8fc1230429`
- 本地站点工作目录：`work/staging-site/`
- 站点源配置：该目录中的 `.openai/hosting.json`，`static.directory` 为 `out`。
- 预发站源仓库由 Sites 管理，存放从 OrcaTarot 固定 commit 构建的静态快照；应用开发仍以本公开仓库为准。

更新预发站时复用这个 project_id 和地址，不再创建新站。先从已合并且检查通过的 commit 构建，再将其清单列出的文件复制到站点 out/、同步站点源仓库并发布对应版本。不能把临时源目录、个人记录或凭据提交进去。

## 验证

对照线上 `SOURCE_COMMIT.txt`、`manifest.json` 及各文件 SHA-256；`/index.html` 会跳转到规范入口 `/`。托管层会在首页添加 Cloudflare challenge-platform 脚本，原始线上 HTML 的 SHA 随注入内容变化，应另记采样值，并验证剔除这段纯新增脚本后与源 HTML 完全相同。其他静态文件须字节一致。

浏览器验收使用隔离会话，测试抽牌、隐藏牌、末张命运之轮追加、首次分享和历史重新分享。追加牌和隐藏牌可以使用同一张牌图，必须验证在没有缓存时首次分享也能完成。
