# 沙箱 / 本地 / 线上：能力边界与协作规则

> 本文定义两个开发环境（WorkBuddy 沙箱、用户本地）与线上发布之间的边界。
> 目的：任何一方的 agent 开工前，先确认某件事「归谁做、能不能做、怎么做」。

## 1. 三个位置的身份

| 位置 | 是什么 | 核心资产 |
|---|---|---|
| **公开仓库** pericn/OrcaTarot | 唯一共同真相源 | `src/template.html` + `src/cards/`（源码与原始素材） |
| **WorkBuddy 沙箱** | 隔离 VM，/workspace 为发布目录 | **唯一拥有线上发布通道**；有 chromium 可跑 headless 断言测试 |
| **用户本地** | 用户的机器 | 真机（iOS Safari）；局域网 http server 可做手机实时测试 |

## 2. 能力边界表

| 操作 | WorkBuddy 沙箱 | 用户本地 |
|---|---|---|
| clone / 读仓库 | ✅ | ✅ |
| 建分支 / push / 开 PR | ✅（SSH key：workbuddy-sandbox） | ✅ |
| 改源码 + `python3 src/build.py` 构建 | ✅ | ✅ |
| headless 断言测试（375×667 几何/居中/素材注入/回归） | ✅ | 视本地环境 |
| 真机测试（iOS Safari 引导、添加到主屏幕、暗色、触摸） | ❌ 无手机 | ✅ |
| 局域网 http server + 手机实时刷新测试 | ❌ 用户手机够不到沙箱 | ✅ |
| **发布到线上（workbuddy publish）** | ✅ **仅此一家** | ❌ 无此通道 |

## 3. 发布链路（唯一）

```
仓库 main（已合并、CI 通过）
  → python3 src/build.py --output /workspace/soul-toolkit.html
  → workbuddy publish --dir /workspace
  → https://a17db079dfdd07afb.app.workbuddy.host（重复发布保持同链接）
  → 在 docs/RELEASES.md 记录：源码 commit、HTML SHA-256、URL、发布时间
```

铁律：

- 发布会**覆盖所有人此刻看到的页面**，每次发布必须拿到用户**当轮**明确授权
- 只发布已合并且检查通过的确定版本；commit 记录不代表已验证，SHA-256 必须与实际发布内容核对
- 本地 agent 的交付终点是**仓库 main**，不是线上——本地没有任何发布通道，也不要尝试"部署"

## 4. 禁止事项（双方共用）

- ❌ 直接推 `main`：唯一路径是「分支 → PR → 合并」，不覆盖、不强推
- ❌ 提交构建产物：`dist/`、`soul-toolkit.html` 已在 .gitignore，不手改、不提交
- ❌ 把个人抽卡记录、凭据、临时调试文件放进仓库
- ❌ 改构建输出的单文件性质（workbuddy 发布通道只收单 HTML，见第 5 节）
- ❌ 在未验证构建的情况下推源码（会挂 CI：素材缺失、marker 丢失都会被 build.py 拦截）

## 5. 单文件约束与拆分逻辑（2026-10-20 讨论结论）

### 5.1 实测数据（沙箱验证）

| 能力 | http:// 线上 | file:// 本地打开 |
|---|---|---|
| 多 HTML 相对路径跳转 | ✅ | ✅ |
| 外链图片 `<img src="assets/...">` | ✅ | ✅ |
| localStorage 跨页共享 | ✅ | ✅ |
| **canvas 画外链图 → toDataURL** | ✅ | ❌ **SecurityError（画布被污染）** |

### 5.2 结论

- **单文件不是硬性技术限制，而是当前测试流的函数**：本地用 Safari 直接开 HTML 文件测试时，外链牌图会让分享卡 canvas 污染、`toDataURL` 抛错——这是分享卡功能的核心，所以牌图必须 base64 内联。
- 线上 http 同源环境下，多 HTML、外链图全部可行——限制只来自本地测试方式。
- **可拆分项**：纯展示图（logo、iOS 引导截图、apple-touch-icon）可走 `assets/` 相对路径；页面结构可拆（index / share / history）。
- **不可拆分项**：进入 canvas 的牌图（分享卡 compose 的输入）。
- **构建输出必须是单文件**：workbuddy 发布只收单 HTML。即使源码拆成多文件/多目录，`build.py` 也必须产出兼容的单文件成品。

### 5.3 拆分的决策前提

把测试流从「Safari 开本地文件」换成「本地 `python3 -m http.server` + 手机开 `http://<局域网IP>:8000`」之后：

- canvas 污染问题消失，拆分障碍清零；
- 同时获得手机实时刷新测试能力（改完刷新即见效）。

**在此之前，不要拆。** 拆分是"想不想"的问题，不是"能不能"——等测试流就位再动手，改动本身很小。

## 6. 测试责任分工

| 环节 | 负责方 | 内容 |
|---|---|---|
| headless 断言 | 沙箱 | 375×667 几何（一屏完整）、按钮居中、素材注入、回归项（抽牌/隐藏牌/历史重分享/明暗） |
| `#guide` 强制预览 | 沙箱 | 引导弹框桌面截图目检 |
| 真机验证 | 本地 | iOS Safari 引导全流程、添加到主屏幕（含"作为网页 App 打开"开关）、暗色模式、触摸交互 |
| 合并前 checklist | 双方 | 见 AGENTS.md：抽牌、隐藏牌、历史重新分享、明暗主题、iOS 引导 |

## 7. 无推送权限时的交接（备用）

某一方失去写权限时（如 SSH key 被删）：产出 patch 文件 + 注明基线 commit 与改动文件清单，由有写权限的一方应用合并。当前双方均有写权限，此节仅作应急。

---

*本文由 WorkBuddy 沙箱侧建立（2026-10-20）。规则变更须经 PR，双方认可后合并。*
