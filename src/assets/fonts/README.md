# OrcaWoodblockSubset

齐伋体 Combo 的项目文字子集。缺少的数字、拉丁字符和标点取自 New Tegomin，合并后重命名为 OrcaWoodblockSubset；固定界面与分享牌名使用同一个字体家族；自由输入的问题使用随站点提供的 Noto Serif SC 宋体分片，CSS 名称为 OrcaQuestionSong；按字符加载，不依赖本地宋体是否可用。固定界面的刻本子集保持独立。

- 齐伋体：https://github.com/LingDong-/qiji-font
- New Tegomin：https://github.com/googlefonts/NewTegomin
- 两种字体均为 SIL OFL 1.1，完整许可见本目录。
- 本项目保留的文件是用于自托管的 WOFF2，正常构建不需要访问字体服务。
- 增加界面文案或牌名后，从原字体重新子集并检查字符覆盖。

重新生成（仅字体维护者需要安装 fonttools 和 brotli）：

```sh
python3 tools/subset_font.py --chinese /path/to/qiji-combo.ttf --supplement /path/to/NewTegomin-Regular.ttf
```

数字与拉丁补字在合并前按 0.88 比例统一缩放轮廓与字宽，匹配齐伋体的可见字身高度，避免日期中数字高于汉字。新增文案（含「载」「旋正」）必须重新子集。

问题宋体来源与原始文件哈希见 `question-song/SOURCE.json`，OFL 1.1 许可见 `question-song/OFL.txt`。字体文件由 Google Fonts 官方分片直接自托管，字形未修改。`css/question-font.css` 以 unicode-range 控制加载；输入框固定占位文字与 ASCII 单独使用小分片。分享前按实际问题等待相关字体就绪。Emoji 保留系统彩色字形。
