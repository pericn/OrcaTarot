# 发布记录

当前还没有由本仓库核验过的线上发布。原线上地址来自交接文档，不能据此推断内容版本。

Workbuddy 从已合并且检查通过的 commit 构建到新的暂存目录：

```sh
SOURCE_COMMIT=<merged-commit> python3 src/build.py --output /workspace/jinglingxia-staging
cd /workspace/jinglingxia-staging
shasum -a 256 -c SHA256SUMS
```

发布整个构建目录中的 index.html、css/、js/、assets/ 以及版本清单。先上传全部新哈希素材，再切换 HTML/CSS/JS，或使用托管的原子目录发布；不要先删除旧哈希素材，以免旧页面请求失败。

发布后从线上下载 index.html 及 manifest.json 中每个静态资源，逐项核对 SHA-256。commit 标识与发布日志不能替代实际核对。

每次发布或回滚新增一行，不覆盖旧行：

| 发布日期与时区 | 源码 commit | index.html SHA-256 | manifest.json SHA-256 | 线上地址 | 发布包/Release | 验证结果 |
|---|---|---|---|---|---|---|

归档完整目录包、SHA256SUMS、manifest.json 和 SOURCE_COMMIT.txt；重要版本保存到 GitHub Release，不能只依赖会过期的 Actions 产物。域名保持原样；更换域名须另做历史迁移。

## 正式站（Workbuddy 发布）

正式站与预发站使用不同的本地发布目录，勿混用：

| 环境 | 本地发布目录 | 地址 |
|---|---|---|
| 正式站 | `/workspace/site` | https://a17db079dfdd07afb.app.workbuddy.host |
| 预发站 | `/workspace/jinglingxia-staging` | 见 STAGING.md |

正式发布：

```sh
cd ~/OrcaTarot
SOURCE_COMMIT=$(git rev-parse HEAD) python3 src/build.py --output /workspace/site
node <skill-directory>/sites/scripts/publish.js --dir /workspace/site
```

### v1 · 2026-10-27 02:43:34 CST

- 线上地址：https://a17db079dfdd07afb.app.workbuddy.host
- 应用源码 commit：`0a98b2e7f49b51ece54b544524a8ca46e18cb1b1`（main，含 PR #2、#4、#6、#7、#8；main CI 已通过）
- 站点（目录式）文件数：105
- 入口 HTML SHA-256：`42b89e09b9e1024ae09019c917043c553225e26c9e66ccc4f93a1eb67d8e1b59`
- manifest SHA-256：`a11b7eb315350457ad5a3600694f4a57d31ebd3e0772b1254f31d7cda3c56021`
- 本地核验：05 个产物文件 SHA 逐项自校验通过；headless 加载无页面错误，index 引用的 18 个资源全部 200，抽牌/历史/牌阵/引导/牌匾等关键节点渲染正常
- 线上核验（发布时间后实测）：入口 HTTP 200、7646 B，HTML SHA 与本地构建一致；manifest、SOURCE_COMMIT、卡牌 WebP、woff2 字体、app 图标抽样均为 200；旧单文件条目 `soul-toolkit.html` 已 404
- 说明：这是重构为目录式静态站（CSS/JS/assets 拆分）后的首次正式站发布。旧用户 localStorage 数据沿用同一域名，无需迁移。
