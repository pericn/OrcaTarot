#!/usr/bin/env python3
"""鲸灵匣静态站服务。

目录式静态站的缓存策略：
- 无指纹文件（index.html / js / css / manifest / 校验清单）：no-cache, must-revalidate
  每次向服务器校验，内容变了立刻返回新内容——这是「更新提示」类改动能被老用户
  拿到的前提；未变更时服务器返回 304，几乎不耗流量。
- 带内容指纹的 assets（如 orca-woodblock.7ee2d434799b.woff2）：public, immutable
  长缓存。内容变则文件名变，不存在缓存陈旧问题。

用法：python3 serve.py <port> --directory <站点目录>
"""
import argparse
import os
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# 形如 name.<8~20位hex>.ext 的内容指纹文件名
FINGERPRINT = re.compile(r"\.[0-9a-f]{8,20}\.[a-z0-9]+$", re.IGNORECASE)


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        try:
            fs_path = self.translate_path(self.path)
            name = os.path.basename(fs_path)
            if FINGERPRINT.search(name):
                self.send_header("Cache-Control", "public, max-age=31536000, immutable")
            else:
                self.send_header("Cache-Control", "no-cache, must-revalidate")
        except Exception:
            pass
        SimpleHTTPRequestHandler.end_headers(self)

    def log_message(self, fmt, *args):  # 安静一点
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("port", type=int, nargs="?", default=8000)
    ap.add_argument("--directory", default=".")
    ap.add_argument("--bind", default="0.0.0.0")
    args = ap.parse_args()
    os.chdir(args.directory)
    ThreadingHTTPServer((args.bind, args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
