#!/usr/bin/env python3
"""本地开发服务器：静态文件 + 网易云分享短链接展开。

网易云 App「复制链接」得到的是 163cn.tv 短链接，需要跟随一次跳转才能拿到歌单 / 单曲 ID，
浏览器里的页面受跨域限制做不到，所以由这个服务器代为展开。只接受网易云的短链域名。

用法：python3 serve.py [端口，默认 5173]
"""
import http.server
import json
import os
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request

NE_PORT = 3001
SHORT_HOSTS = {'163cn.tv', 'www.163cn.tv', '163cn.link', 'y.music.163.com', 'music.163.com'}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def resolve(url, hops=4):
    """沿着跳转走几步，返回最终地址（不下载页面内容）。"""
    opener = urllib.request.build_opener(NoRedirect)
    for _ in range(hops):
        host = urllib.parse.urlsplit(url).hostname or ''
        if host not in SHORT_HOSTS:
            break
        req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'Mozilla/5.0'})
        try:
            opener.open(req, timeout=8)
            break  # 没有跳转
        except urllib.error.HTTPError as e:
            loc = e.headers.get('Location')
            if e.code in (301, 302, 303, 307, 308) and loc:
                url = urllib.parse.urljoin(url, loc)
                continue
            break
    return url


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')  # 开发时改完文件刷新即生效
        super().end_headers()

    def do_GET(self):
        parts = urllib.parse.urlsplit(self.path)
        if parts.path.startswith('/api/ne/'):
            return self.ne_proxy(parts)
        if parts.path != '/api/netease-resolve':
            return super().do_GET()
        u = urllib.parse.parse_qs(parts.query).get('u', [''])[0]
        host = urllib.parse.urlsplit(u).hostname or ''
        if urllib.parse.urlsplit(u).scheme not in ('http', 'https') or host not in SHORT_HOSTS:
            return self.reply(400, {'error': 'only NetEase share links are allowed'})
        try:
            self.reply(200, {'url': resolve(u)})
        except Exception as e:  # 网络错误等
            self.reply(502, {'error': str(e)})

    def ne_proxy(self, parts):
        """转发到本机的网易云登录态侧车（netease-api/server.js）；没启动时返回 503。"""
        if self.client_address[0] not in ('127.0.0.1', '::1', '::ffff:127.0.0.1'):
            return self.reply(403, {'error': 'netease login is local only'})
        url = f'http://127.0.0.1:{NE_PORT}/' + parts.path[len('/api/ne/'):] + ('?' + parts.query if parts.query else '')
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                body, code = r.read(), r.status
        except urllib.error.HTTPError as e:
            body, code = e.read(), e.code
        except Exception:
            return self.reply(503, {'error': 'netease sidecar not running'})
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def reply(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def start_sidecar():
    """自动启动网易云侧车（需要 node，并在 netease-api/ 里 npm install 过）；失败就跳过，外链播放器照常可用。"""
    d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'netease-api')
    node = shutil.which('node')
    if not (os.path.isdir(os.path.join(d, 'node_modules')) and node):
        print('网易云登录态：未启用（在 netease-api/ 里运行 npm install 后重启即可）')
        return None
    p = subprocess.Popen([node, 'server.js', str(NE_PORT)], cwd=d)
    return p


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    print(f'DriveOS: http://localhost:{port}')
    http.server.ThreadingHTTPServer.request_queue_size = 128  # 默认只有 5，页面并发加载脚本时会被重置连接
    http.server.ThreadingHTTPServer.daemon_threads = True
    side = start_sidecar()
    try:
        http.server.ThreadingHTTPServer(('', port), Handler).serve_forever()
    finally:
        if side:
            side.terminate()
