# 鲸灵匣 · OrcaTarot

马赛塔罗静态网页工具。纯白浅底、疏落的日月星底纹、深靛蓝夜间主题；使用开放许可的齐伋体 Combo 与 New Tegomin 合并子集，页面和分享图统一字体。无需后端、第三方字体服务或运行时依赖。

公开仓库：https://github.com/pericn/OrcaTarot

## 源码与构建

- `src/template.html`：页面结构、对话框及 iOS 引导。
- `src/css/app.css`：全部主题和响应式样式。
- `src/js/app.js`：抽牌、翻牌、历史、主题及引导。
- `src/js/deck.js`：78 张牌、马赛编号与数字归约规则。
- `src/js/share.js`：参数化分享图绘制与图片加载。
- `src/js/icons.js`、`src/assets/icons.svg`：操作和牌阵图标。
- `src/assets/fonts/`：自托管字体与 OFL 许可。
- `src/assets/motifs/`：经视觉稿确认的日月星图案，不拉伸。
- `src/cards/`：原始牌面和 iOS 引导素材，构建时转换为 WebP。
- `src/build.py`：生成可直接部署的目录式静态站。
- `tests/browser.cjs`：浏览器验收，使用独立测试会话，不读取个人历史。
- `dist/`：构建产物，不提交。

```sh
python3 -m pip install -r requirements.txt
python3 src/build.py
# Workbuddy 指定一个新的发布目录：
python3 src/build.py --output /workspace/jinglingxia
```

部署入口为 `index.html`；一起部署同目录的 `css/`、`js/`、`assets/`。不再输出单文件兼容包。默认目录已有旧版本时，请按 `manifest.json` 中列出的文件打包，或构建到新的暂存目录；不要把旧的单文件产物混入正式发布包。

牌图、图标、字体和底纹使用带内容哈希的文件名。HTML、CSS、JS 应重新验证缓存；带内容哈希的素材可设长缓存。牌背在首页共用一个 URL，未选牌面不会预加载，选中牌时立即预加载牌面，页面与分享复用同一个解码结果。牌面使用有容量上限的 Cache Storage 持久缓存（同域名、浏览器允许时），失败自动重试一次并显示手动重试入口；iOS 引导图按需请求。所有 URL 为相对路径，可部署在子目录；务必保留文件结构。

## 交互规则

- 一、二、三张牌阵使用图标，生日牌阵另标名称，图标与牌面均按 3＋2 分行。
- 扇形支持滑动、鼠标滚动和键盘操作；待抽牌位缩小，首屏按可用高度显示牌堆，短横屏使用左右布局。抽满后收起牌堆，点击逐张翻牌。
- 小阿尔卡纳和逆位开关直接放在抽牌页；切换会清空本轮未完成牌阵，保留历史。
- 罗马编号与原程序一致：IIII、VIIII、XIIII、XVIIII；愚者无编号，XIII 只显示编号，宫廷牌不加数字。
- 三张牌阵且关闭小阿尔卡纳时，按原三张主牌编号和归约计算隐藏牌。
- 最后一张主牌翻开后若为命运之轮（正逆位均可），旁边出现“再抽一张”。从当前牌池中排除已抽主牌，再抽一张作为追加牌；每轮最多追加一次，翻开的隐藏牌为命运之轮时也可触发，每轮总共最多追加一次。隐藏牌不参与追加牌池的排除，追加牌不改变隐藏牌计算。隐藏牌固定排在追加牌之前，页面、历史与分享保持一致。
- 底部抽牌/记录导航固定高度，记录页顶部的清空按钮用危险色标识并要求确认。记录页通过底栏切换，不另设返回按钮；统计跟随列表末尾滚动。
- 追加牌计入分享图和本轮同一条历史，保留初次记录的时间。历史重新分享仍取原记录日期，兼容 `hid`/`hidden` 标记。
- 生日牌位按年、月、日、业力、流年标注，页面、历史与分享一致，兼容旧生日记录。年份和日期仍按原 21 分界算法；业力与流年持续逐位相加到不大于 9（例如 2026 → 10 → 1），不随机替代。

## 本地验收

```sh
python3 -m http.server 8765 --directory dist
# 在另一个终端，安装测试依赖（不属于线上资源）：
npm install --prefix /tmp/orca-tests playwright@1.58.0
/tmp/orca-tests/node_modules/.bin/playwright install chromium
NODE_PATH=/tmp/orca-tests/node_modules node tests/browser.cjs http://127.0.0.1:8765/ /tmp/orca-qa
```

测试覆盖抽牌数量、牌堆收起、隐藏牌、命运之轮追加、生日牌阵、逆位、历史重新分享、字体和主题对比度、320–1440px 布局与 iOS 引导。`#guide` 可强制显示引导，连续点品牌三次也可打开。

## 数据与发布

既有 localStorage 键全部保留：`lx-history`、`lx-prefs`、`lx-theme`、`lx-guide-done`、`lx-visited`。历史最多 100 条。新版本在原域名发布时可以继续读取本机记录；域名变化须另行处理迁移。

Workbuddy 继续负责发布。只发布已合并且检查通过的版本，校验 `SHA256SUMS` 和 `manifest.json` 中的全部文件，记录 `SOURCE_COMMIT.txt`、入口 HTML SHA-256、整站清单 SHA-256、线上地址及时间；发布后实际核对线上资源。发布流程见 [docs/RELEASES.md](docs/RELEASES.md)。

历史线上地址：https://a17db079dfdd07afb.app.workbuddy.host （此重构不自动更改线上内容）。
