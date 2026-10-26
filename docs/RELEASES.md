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

### v2 · 2026-10-27 06:48:20 CST

- 线上地址：https://a17db079dfdd07afb.app.workbuddy.host
- 应用源码 commit：`397ff967993a5734bbc99937a00f8a17ae03675b`
- 站点文件数：105
- 入口 HTML SHA-256：`cead0dd70e1d1f4dad760e87cdcd7f870f0bb252e99c5f5acbe30fe664d2f59f`
- manifest SHA-256：`2c2033a7ddad226db31240e8acc71afc9e347564fb414f9235ef65b832741d0f`
- 本次内容：
  - 新增版本更新一次性弹框 `#updateOv`（键 `lx-upd-2026-10a`）：展示新桌面图标；说明桌面图标不会自动换新、需删除后重新添加；警告删除会连带清空抽卡记录，提示先在抽牌记录页分享保存
  - 生日牌阵标签改用繁体「業力」（简体「业」与繁体「業」在旧子集中均缺失导致 fallback）
  - 重新生成字体子集：373 个源码汉字全部命中（480 字形，旧子集 434）
  - 弹框关闭按钮由 `←` 字符改为 SVG（齐伋体无箭头字形）
  - 安装引导主按钮恢复居中（重构时丢失）
- 本地核验：构建产物 `SHA256SUMS` 105 项全部通过；375×667 与 390×844 两视口目检弹框一屏完整、按钮居中、图标加载正常；弹框一次性逻辑与 `#update` 强制预览均通过
- 线上核验（发布后实测）：入口 HTTP 200、9249 B，HTML SHA 与本地构建逐字节一致；manifest SHA 一致；新图标 PNG、字体 `orca-woodblock.7ee2d434799b.woff2`、icons.svg、js/deck.js 均为 200；`js/deck.js` 内 `BIRTHDAY_POSITIONS` 已为繁体「業力」
- 说明：发布时远程 main CI（GitHub Actions `build`）仍在排队未完成，**未宣称已通过**；以本地等价构建与核验为准。CI 完成后请复查本条记录。
