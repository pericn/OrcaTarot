# OrcaWoodblockSubset 与问题刻本体

固定界面和牌名使用 QiJi Combo 的文字子集，数字、拉丁字符和缺少的标点取自 New Tegomin；补字按 0.88 比例缩放轮廓与字宽。字体重命名为 OrcaWoodblockSubset。

自由输入的问题在确认后、抽牌结果、历史和分享中使用同源刻本体。`OrcaQuestionWoodblock` 优先复用固定界面已下载的字形，其余字形按 128 个 Unicode 码点一组拆成 WOFF2；`css/question-font.css` 用互不重叠的 unicode-range 按需加载。原来的宋体分片已移除。超出 QiJi Combo 字库的字符使用平台衬线字，Emoji 保留系统彩色字形。

弹窗编辑器固定用系统字体，避免输入新字时先显示后备字体、下载完成后再换字形。确认后才在页面显示刻本问题文字。分享前按实际问题等待字体加载完成。

上游及许可：

- 齐伋体：https://github.com/LingDong-/qiji-font/releases/tag/0.0.4
- Combo 补字基于 Source Han Serif，说明见上述发布页；许可见 OFL-SourceHanSerif.txt。
- New Tegomin：https://github.com/googlefonts/NewTegomin
- 均为 SIL OFL 1.1，完整许可随字体保留。问题字体的来源、原始文件哈希、每片字符范围及大小见 `question-woodblock/SOURCE.json`。
- 正常构建直接复制已提交的 WOFF2，不访问字体服务，也不依赖用户本机安装字体。

维护字体时安装 fonttools、brotli，使用原始 TTF：

```sh
python3 tools/subset_font.py --chinese /path/to/qiji-combo.ttf --supplement /path/to/NewTegomin-Regular.ttf
python3 tools/subset_question_font.py --chinese /path/to/qiji-combo.ttf
```

修改固定界面文案后先更新固定子集，再更新问题分片，确保两者的 unicode-range 不重复；检查字形覆盖和浏览器分享。不要把完整 TTF 加入首次加载或提交到发布目录。
