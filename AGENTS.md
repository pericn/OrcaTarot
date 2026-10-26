# OrcaTarot 协作

公开仓库：https://github.com/pericn/OrcaTarot

- 开始工作先同步最新 main，再创建 codex/主题 或 workbuddy/主题 分支，完成后通过 PR 合并。不要从旧沙箱副本覆盖 main，不要强制推送。
- 源码入口是 src/template.html，样式在 src/css/，脚本在 src/js/，原始牌面在 src/cards/，字体、图标与底纹在 src/assets/。只修改源码和原始素材，dist/ 和旧 soul-toolkit.html 不提交、不手改。
- 安装依赖：python3 -m pip install -r requirements.txt。构建：python3 src/build.py。产物为 dist/ 目录式静态站，入口 index.html；--output 指定一个发布目录。用户已确认 Workbuddy 可以部署拆分后的目录，不再要求单文件兼容包。
- 不要用 `python3 -m http.server` 直接发布：它不发 Cache-Control，浏览器会启发式缓存入口 HTML，导致更新类改动（如版本提示弹框）老用户拿不到。发布用 `tools/serve.py`（入口与 js/css 发 no-cache, must-revalidate；带指纹的 assets 发 immutable）：
  ```sh
  node <skill-directory>/sites/scripts/publish.js --dir /workspace/site \
    --start-cmd 'python3 /workspace/serve.py $PORT --directory /workspace/site'
  ```
- 发布继续走 Workbuddy 原有机制。只发布已合并且检查通过的版本，记录源码 commit、入口 HTML SHA-256、整站 manifest SHA-256、线上地址和发布时间；实际核对线上内容。
- 本地无法 Git 同步时，使用仓库固定 commit 的源码，核对基线；交回修改注明基线 commit 和改动文件，由有写权限的一方合并。公开可读不等于拥有推送权限。
- 保留既有核心交互、localStorage 键和马赛编号规则。域名变化影响读取原有历史，必须另行处理迁移。
- 末张主牌或已翻开的隐藏牌为命运之轮时可“再抽一张”，主牌正逆位均可，每轮最多追加一次；从当前牌池排除已抽主牌，追加到同一条历史与分享。隐藏牌不参与追加牌池排除，追加后不重算隐藏牌；显示顺序为主牌、隐藏牌、追加牌。
- 发布前先给 owner 一个可真机验证的版本：Workbuddy 侧只有一个正式链接、没有独立预发环境，因此先把构建产物打包交给 owner（本地 `python3 -m http.server`、手机连局域网验证），确认后再发布正式站。不要跳过这一步直接发。
- 交互修改完成后运行构建和 tests/browser.cjs，检查抽牌、隐藏牌、追加牌、历史重新分享、明暗主题及 iOS 引导。不要把个人抽卡记录、凭据或临时调试文件加入仓库。
