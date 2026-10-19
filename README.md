# OrcaTarot · 灵匣 · Tarot de Marseille

微信马赛塔罗网页小工具。单文件交付（`soul-toolkit.html`，约 4.5 MB），所有卡牌图、UI 素材、logo 均以 WebP base64 内联，无任何外部依赖，可直接部署到任意静态托管。

公开源码仓库：https://github.com/pericn/OrcaTarot

仓库保存源码与原始素材，生成的 HTML 不进入日常 Git 历史。协作约定见 [AGENTS.md](AGENTS.md)，沙箱/本地/线上三方能力边界见 [docs/SANDBOX_BOUNDARY.md](docs/SANDBOX_BOUNDARY.md)。当前先保留原模板结构，CSS/JS 拆分是后续工作（拆分前提见 SANDBOX_BOUNDARY 第 5 节）。

## 文件结构

```
OrcaTarot/
├── README.md                ← 本文件
├── requirements.txt         ← 构建依赖
├── AGENTS.md                ← Codex / Workbuddy 协作约定
├── docs/                    ← 交接基线、发布记录、环境边界
│   ├── HANDOFF_BASELINE.json
│   ├── RELEASES.md
│   └── SANDBOX_BOUNDARY.md  ← 沙箱/本地/线上能力边界（协作前必读）
├── dist/                    ← 构建输出，不提交 Git
│   └── soul-toolkit.html     ← 单文件成品，可直接部署
└── src/                     ← 源码
    ├── template.html        ← 唯一源模板（所有改动都在这里）
    ├── build.py             ← 构建脚本：模板 + 素材 → 成品
    ├── dl_cards.py          ← 历史脚本：卡牌原图下载
    ├── export_b64.py        ← 历史脚本：base64 导出
    └── cards/               ← 85 张 PNG（78 张牌 + 3 张引导 + 牌背 + 3 张 logo 素材）
```

## 构建

```bash
python3 -m pip install -r requirements.txt
python3 src/build.py
```

默认产物写到 `dist/soul-toolkit.html`，同时生成 `.sha256` 校验文件。脚本从自身位置定位源码和素材，在任意工作目录运行均可。Workbuddy 需要指定发布路径时：

```bash
python3 src/build.py --output /workspace/soul-toolkit.html
```

构建流程：

1. 扫描 `cards/*.png`，转 WebP → base64
2. 普通牌图缩放到 280px 宽、q=80；`ios_` 前缀的引导截图**不缩放**、q=88（保 UI 文字清晰）
3. 校验完整牌组与必需素材，再注入 `template.html` 的 `__IMAGES_JSON__` 占位符
4. 同时注入牌背、logo 的 base64

改完 `template.html` 后必须重新 build，成品才会变。

## 自动构建与交付

main 更新、PR 或手动触发会运行 GitHub Actions，生成带源码 commit 标识的构建包，临时产物保留 14 天。Workbuddy 从通过检查的 main 构建中下载 HTML，核对 SHA-256 后用原机制发布。PR 构建仅用于预览，不代表正式版本。

正式发布时应另行将 HTML、校验文件与源码 commit 归档到 GitHub Release；当前尚未建立 Release。发布记录见 [docs/RELEASES.md](docs/RELEASES.md)。

## 本地测试

 Safari 打不开 file:// 的引导弹框问题，用以下任一方式：

- **地址栏强制预览**：`dist/soul-toolkit.html#guide`（打开即弹引导，跳过 iOS UA 检测和记忆）
- **牌匾三击**：成品页连续点顶部"灵匣"牌匾 3 次，随时弹出引导
- **桌面浏览器**：Chromium headless + `--allow-file-access-from-files` 可跑断言测试（375×667 视口模拟 iPhone SE）

## 功能清单

| 模块 | 说明 |
|---|---|
| 抽牌 | 单张 / 三张牌阵，逆位开关，小阿尔卡纳开关 |
| 隐藏牌 | 三张牌阵抽卡后可翻一张隐藏牌 |
| 分享卡 | compose() 生成 750px 宽分享长图，参数化（牌数组 + 时间戳） |
| 历史记录 | localStorage 最多 100 条，每条可**重新分享**（日期取抽卡当天） |
| 重新分享 | 历史页每条记录的"享"按钮重绘分享卡 |
| 换牌阵入口 | 迷你牌阵 SVG 图标 + 放大按钮 + 常驻提示 + 首次轻浮动画（只弹一次） |
| iOS 引导 | 首次 Safari 打开弹"添加到主屏幕"引导，真实 iOS 截图三步流程 |
| 明暗模式 | CSS 变量切换，跟随系统 |

## iOS 引导流程（新版 iOS 26+）

1. 点屏幕最下面的**更多**按钮 → 再点**共享**
2. 共享菜单里找到**添加到主屏幕**，点这一行
3. 打开**作为网页 App 打开**的开关，再点**添加**
   - ⚠️ 不开这个开关，加的只是书签，点开还在 Safari 里

引导弹框只在 iOS Safari 且未 standalone 时自动弹出一次；`lx-guide-done` 记住已看过。

## 技术要点 / 踩过的坑

- **compose(cards, ts) 参数化**：分享卡从读全局 picks/hidden 改为接受牌数组 + 时间戳参数，历史重绘时日期取抽卡当天而非今天
- **hid/hidden 双兼容**：实时路径隐藏牌是 `{...c, flipped:false, hidden:true}`，历史存档存 `hid:true`，compose 判定必须写 `c.hid||c.hidden`，否则历史重绘的隐藏牌标签丢失
- **iOS Safari 检测**：UA 含 iPad/iPhone/iPod（或 MacIntel + maxTouchPoints>1）+ 真 Safari（排除 CriOS/FxiOS/EdgiOS/OPiOS）+ `!navigator.standalone`
- **const 不挂 window**：iframe 内 `const IMG` 不能通过 `w.IMG` 访问，断言测试里要用 `w.eval('IMG.xxx')`
- **headless 截图**：`--screenshot` 按 `--window-size` 尺寸，真实视口 = 窗口高 − 87px（chrome 区）；窗口 754 高 = 667 视口（iPhone SE）
- **iframe 测试滚动条**：桌面 Chromium 垂直滚动条占 15px，iframe 宽要设 390 才能得到 375 视口
- **引导弹框一屏完整**：375×667 下 scrollHeight 必须 ≤ 667，实测 629；步骤文字 12px + letter-spacing .5px 才能单行（step 内容区实际只有 260px 宽）
- **分享卡呼吸感参数**：M=62、PAD=32、headH=140、footH=70、gap=25；牌名 `400 20px` + SOFT 色（#7d6b52）

## localStorage 键

| 键 | 用途 |
|---|---|
| `lx-history` | 历史抽卡记录（HMAX=100） |
| `lx-guide-done` | 引导已看过（GKEY，只自动弹一次） |
| `lx-visited` | 换牌阵入口弹跳只播一次（VKEY） |

## 线上地址（原 README 提供，建仓时未重新发布）

https://a17db079dfdd07afb.app.workbuddy.host （重复发布保持同一链接）
