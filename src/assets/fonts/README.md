# OrcaWoodblockSubset

齐伋体 Combo 的项目文字子集。缺少的数字、拉丁字符和标点取自 New Tegomin，合并后重命名为 OrcaWoodblockSubset；页面与分享图使用同一个字体家族。

- 齐伋体：https://github.com/LingDong-/qiji-font
- New Tegomin：https://github.com/googlefonts/NewTegomin
- 两种字体均为 SIL OFL 1.1，完整许可见本目录。
- 本项目保留的文件是用于自托管的 WOFF2，正常构建不需要访问字体服务。
- 增加界面文案或牌名后，从原字体重新子集并检查字符覆盖。

重新生成（仅字体维护者需要安装 fonttools 和 brotli）：

```sh
python3 tools/subset_font.py --chinese /path/to/qiji-combo.ttf --supplement /path/to/NewTegomin-Regular.ttf
```
