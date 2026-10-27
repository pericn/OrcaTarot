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

### v3 · 2026-10-27 07:21 CST

- 线上地址：https://a17db079dfdd07afb.app.workbuddy.host
- 应用源码 commit：`a88197e8404655c9ecde82f2e05c9c2845ffe7f5`
- 站点文件数：105
- 入口 HTML SHA-256：`cead0dd70e1d1f4dad760e87cdcd7f870f0bb252e99c5f5acbe30fe664d2f59f`（与 v2 同，本次仅改 app.js 的显示时序与服务端缓存策略，index.html 未变）
- 本次内容：
  - **修缓存**：发布服务由 `python3 -m http.server` 改为 `tools/serve.py`。入口 HTML 与 js/css 发 `no-cache, must-revalidate`（每次校验，变更即返回新内容）；带内容指纹的 assets 发 `public, max-age=31536000, immutable`。此前服务不发 Cache-Control，浏览器启发式缓存入口 HTML，是「更新提示」这类改动无法触达老用户的根因
  - **修显示时序**：安装引导占屏时更新提示曾整轮跳过，改为关闭引导后接着弹（iPhone Safari UA 实测 4/4）
- 线上核验：`/` 与 `/js/app.js` 均为 `cache-control: must-revalidate, no-cache`；指纹字体为 `public, immutable, max-age=31536000`；带 If-Modified-Since 请求返回 304；入口 200 且 SHA 与本地构建一致
- **已知局限**：已缓存旧副本的设备无法远程召回，`no-cache` 只对之后的请求生效；这类设备需等本地缓存自然过期或手动刷新，除非更换 URL。本次不做 URL 变更。
- 说明：发布时远程 main CI 未完成，未宣称已通过。

### v6 · 2026-10-28 01:52 CST

- 线上地址：https://a17db079dfdd07afb.app.workbuddy.host
- 应用源码：`4bb4eec3b99cca7ae7fc0c7dff34cbe220fa1075`（PR #17，含 PR #14/#15/#16；CI `chromium` 与 `webkit` 均 success）
- 站点文件数：351（manifest 记录 349）
- 入口 HTML SHA-256：`c6186aee17457725940635cdce12723ad1cf734889bee7c0bb7a28cb079cc1a9`
- 本次内容：
  - PR #17：问题输入改为弹窗（modal）；恢复居中纵向问题入口并保留短屏牌堆布局；木刻字形子集改为按需加载
  - PR #16：修复历史记录中懒加载图片的可见性，补回缩略图
  - PR #15：提供真实宋体问题字形，改为懒加载自托管字体子集
  - PR #14：选中时预建牌面节点，优化衬线分享布局
  - 牌背图改为内联 CSS 变量（首屏少一次请求）；鲸鱼帧条转 WebP 并提供明暗两套
- **首屏实测（沙箱 390×844 加载）**：18 个请求、仅加载 1 个字体分片、估算流量 1.20 MB（其中字体 0.38 MB）——按需分片生效，未出现 21 MB 字体全量下载
- 本地核验：`SHA256SUMS` 全项通过；headless 加载无 JS 错误；抽牌、牌阵、记录、更新弹框、引导、问题弹窗节点均渲染
- 线上核验：入口 200、185056 B，HTML SHA 与本地构建逐字节一致；`cache-control: must-revalidate, no-cache` 生效；字体分片 `orca-woodblock.184fee230167.woff2`、鲸鱼条 `whale-breath-strip.422881277c8b.webp`、`app.js` 均 200
