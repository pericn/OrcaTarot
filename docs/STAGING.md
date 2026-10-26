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

## 发布记录（Asia/Shanghai）

### v1 · 2026-10-27 01:08:56

- 应用源码：`b732d9432ded926fd6e055c2f253eb0ce5d78b49`
- 站点快照源码：`5632f46e4696d32c7d8eec7087682913751c4fbb`
- 入口 HTML SHA-256：`fb02d1a7add6f8b955930d985d677062e5233fecdfb40498480f173dfd117895`
- manifest SHA-256：`d78973dfadf71d8af12d6ccb5548d330d3a08aa45ade9f03035dfbfd12352e75`
- 结果：已发布；资源核验后发现重复牌在无缓存时首次分享等待，由 v2 修复。

### v2 · 2026-10-27 01:27:50

- 地址：https://jinglingxia-staging.earthymars15.chatgpt.site
- 应用源码：`feb37e3cc19397a042dc4b4c50a7f2d4f89b6d2f`（PR #2）
- 站点快照源码：`3e6cc4a70734a1c7661445c97be238e67eb425d1`
- deployment_id：`appgdep_6adf8d875d388191b9bb290226f66fbf`
- 入口 HTML SHA-256：`fb02d1a7add6f8b955930d985d677062e5233fecdfb40498480f173dfd117895`
- manifest SHA-256：`ab8d51c895ab20daeb0f54b05f34ac38890816ba06ee5b539a1a416ff27dc58c`
- 线上 HTML 原始采样 SHA-256：`39651b2167644fb04e8a2910a9f59425ebaed8294873789eb86e4a2b28f5929e`
- 核验时间：2026-10-27 01:28:52；剔除 Cloudflare 纯新增脚本后首页与源 HTML 完全一致，全部 102 项核验通过。
- 验收：本地 11 组完整浏览器测试通过；线上无缓存条件下重现相同隐藏牌/追加牌组合，首次分享成功，字体加载正常，无页面错误。发布时远程 CI 仍在安装浏览器依赖，未宣称远程 CI 已通过。
