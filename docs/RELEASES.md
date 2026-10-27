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

### v5 · 2026-10-27 14:45 CST

- 线上地址：https://a17db079dfdd07afb.app.workbuddy.host
- 应用源码：`7ebd4ed680ec5bab59a68246d15591cd2905d541`（PR #12，含 PR #11；CI 双浏览器 `chromium` 与 `webkit` 均 success）
- 站点文件数：108（新增 `assets/whale-breath-strip.*.png` 与出处说明）
- 入口 HTML SHA-256：`1acb9f4d8d52e3d53ccaf7339b1e17806ee5af99361e7354a7e25d4e3e392e72`
- 本次内容：
  - PR #11：响应式抽牌流程；图标更新提示改为「未手动关闭前持续显示」
  - PR #12：修复 Safari 牌阵布局；新增约 2 秒的加载动画（鲸鱼出水换气帧条）
  - 字体子集再次重跑：373 个源码汉字全部命中
- 本地核验：`SHA256SUMS` 108 项通过；headless 加载无 JS 错误；抽牌、牌阵、记录、更新弹框、引导、鲸鱼呼吸条均渲染；新字体与鲸鱼条资源 200
- 线上核验：入口 200、13233 B，HTML SHA 与本地构建逐字节一致；`cache-control: must-revalidate, no-cache` 生效；字体 `orca-woodblock.ca1637c9e4df.woff2`、`whale-breath-strip.f4e2b168ac33.png`、`app.js`、`share-qr.js` 均 200
