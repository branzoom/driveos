// 网易云登录态侧车：只监听 127.0.0.1，登录 cookie 存在项目之外的 ~/.driveos/netease-cookie.json（权限 600）。
// 用法：node server.js [端口，默认 3001]；由 ../serve.py 通过 /api/ne/* 转发。
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const api = require('NeteaseCloudMusicApi');

const PORT = +process.argv[2] || 3001;
const DIR = path.join(os.homedir(), '.driveos');
const FILE = path.join(DIR, 'netease-cookie.json');

let cookie = '';
try { cookie = JSON.parse(fs.readFileSync(FILE, 'utf8')).cookie || ''; } catch (e) {}
function saveCookie(c) {
  cookie = c || '';
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  if (cookie) fs.writeFileSync(FILE, JSON.stringify({ cookie, savedAt: new Date().toISOString() }), { mode: 0o600 });
  else try { fs.unlinkSync(FILE); } catch (e) {}
}
// 只保留 cookie 的 name=value，去掉 Path / Expires 等属性
function cleanCookie(raw) {
  return String(raw || '').split(/;\s*/).filter(p => /^[\w.-]+=/.test(p) && !/^(Path|Expires|Max-Age|Domain|SameSite|HTTPOnly|Secure)=/i.test(p)).join('; ');
}
const https = u => (u || '').replace(/^http:/, 'https:');
const call = (fn, q = {}) => api[fn]({ ...q, cookie }).then(r => r.body);
let me = null; // 缓存登录用户

async function profile() {
  if (!cookie) return null;
  if (me) return me;
  const b = await call('login_status');
  const p = b.data && b.data.profile;
  if (!p) return null;
  me = { userId: p.userId, nickname: p.nickname, avatar: https(p.avatarUrl), vip: p.vipType };
  return me;
}
const mapSong = s => ({
  id: s.id, name: s.name, artist: (s.ar || s.artists || []).map(a => a.name).join(' / '),
  album: (s.al || s.album || {}).name || '', cover: https((s.al || s.album || {}).picUrl), dur: Math.round((s.dt || s.duration || 0) / 1000),
  fee: s.fee,
});

const routes = {
  async status() { const p = await profile(); return p ? { loggedIn: true, ...p } : { loggedIn: false }; },
  async 'qr/new'() {
    const k = (await call('login_qr_key', { timestamp: Date.now() })).data.unikey;
    const c = (await call('login_qr_create', { key: k, qrimg: true, timestamp: Date.now() })).data;
    return { key: k, qrimg: c.qrimg, qrurl: c.qrurl };
  },
  async 'qr/check'(q) {
    const r = await api.login_qr_check({ key: q.key, timestamp: Date.now() });
    const code = r.body.code;
    if (code === 803) { saveCookie(cleanCookie(r.body.cookie)); me = null; }
    return { code, message: r.body.message };
  },
  async logout() { saveCookie(''); me = null; return { ok: true }; },
  async playlists() {
    const p = await profile(); if (!p) throw Object.assign(new Error('not logged in'), { status: 401 });
    const b = await call('user_playlist', { uid: p.userId, limit: 100, timestamp: Date.now() });
    return {
      userId: p.userId,
      lists: (b.playlist || []).map(l => ({ id: l.id, name: l.name, cover: https(l.coverImgUrl), count: l.trackCount, mine: l.userId === p.userId, special: l.specialType })),
    };
  },
  async playlist(q) {
    const b = await call('playlist_detail', { id: q.id, timestamp: Date.now() });
    const ids = (b.playlist.trackIds || []).map(t => t.id).slice(0, 500);
    const songs = [];
    for (let i = 0; i < ids.length; i += 100) {
      const d = await call('song_detail', { ids: ids.slice(i, i + 100).join(',') });
      songs.push(...(d.songs || []).map(mapSong));
    }
    return { id: b.playlist.id, name: b.playlist.name, total: b.playlist.trackCount, songs };
  },
  async search(q) {
    const type = q.type === 'playlist' ? 1000 : 1;
    const b = await call('cloudsearch', { keywords: q.q, type, limit: 50 });
    const r = b.result || {};
    if (type === 1000) return { lists: (r.playlists || []).map(l => ({ id: l.id, name: l.name, cover: https(l.coverImgUrl), count: l.trackCount, by: l.creator && l.creator.nickname })) };
    return { songs: (r.songs || []).map(mapSong) };
  },
  async daily() {
    const b = await call('recommend_songs', { timestamp: Date.now() });
    return { name: '每日推荐', songs: ((b.data && b.data.dailySongs) || []).map(mapSong) };
  },
  async url(q) {
    let b = await call('song_url_v1', { id: q.id, level: 'exhigh' });
    let d = b.data && b.data[0];
    if (!d || !d.url) { b = await call('song_url', { id: q.id, br: 320000 }); d = b.data && b.data[0]; }
    return { url: d && d.url ? https(d.url) : null, free: d && d.freeTrialInfo ? true : false, br: d && d.br };
  },
  async lyric(q) {
    const b = await call('lyric', { id: q.id });
    return { lrc: (b.lrc && b.lrc.lyric) || '', tlyric: (b.tlyric && b.tlyric.lyric) || '' };
  },
};

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const name = u.pathname.replace(/^\/+/, '');
  const q = Object.fromEntries(u.searchParams);
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
  if (!routes[name]) return send(404, { error: 'not found' });
  try { send(200, await routes[name](q)); }
  catch (e) { send(e.status || 500, { error: String(e.message || e) }); }
}).listen(PORT, '127.0.0.1', () => console.log('netease sidecar on 127.0.0.1:' + PORT + (cookie ? ' (已有登录)' : ' (未登录)')));
