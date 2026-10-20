# OrcaTarot 协作

公开仓库：https://github.com/pericn/OrcaTarot

- 仓库中的源码是正式版本。开始工作先同步最新 main，再创建 codex/主题 或 workbuddy/主题 分支，完成后通过 PR 合并。不要从旧沙箱副本覆盖 main，不要强制推送。
- 当前页面源文件是 src/template.html，素材在 src/cards/。只修改源码和原始素材；dist/ 和 soul-toolkit.html 是构建产物，不提交，不手改。
- 安装依赖：python3 -m pip install -r requirements.txt。构建：python3 src/build.py。产物为 dist/soul-toolkit.html 和同名 .sha256 文件；支持 --output 指定 Workbuddy 发布目录。
- 发布继续走 Workbuddy 原有机制，发布目录固定为 /workspace/site（只含 index.html；无 index.html 时 http.server 根路径会返回目录列表，2026-10-20 曾因此事故）。构建直接输出到该位置：python3 src/build.py --output /workspace/site/index.html。只发布已合并且检查通过的确定版本，记录源码 commit、HTML SHA-256、线上地址和发布时间。发布日志中的 commit 不代表已验证线上内容，两者必须实际核对。
- 本地无法 Git 同步时，使用仓库固定 commit 的源码包；交回修改时注明基线 commit 和改动文件，由有写权限的一方合并。公开可读不等于拥有推送权限。
- 保留既有交互、视觉和 localStorage 键。域名变更会影响用户读取原有抽卡历史，必须另行处理迁移。
- 完成修改后运行构建；交互变更检查抽牌、隐藏牌、历史重新分享、明暗主题及 iOS 引导。不要把个人抽卡记录、凭据或临时调试文件加入仓库。

本次建仓先保留原模板结构；CSS/JS 的模块拆分尚未进行。后续拆分必须保持单文件构建输出兼容 Workbuddy。
