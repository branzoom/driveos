/* DriveOS 主逻辑：Tesla 风格界面
 * 状态全部集中在 S 中；修改状态 → commit() → 重新渲染相关区域并通知 CarPlay 皮肤
 */
(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const I = (n, s, c) => window.icon(n, s, c);
  const stage = $('#stage');

  const store = {
    get(k, d) { try { const v = localStorage.getItem('driveos.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('driveos.' + k, JSON.stringify(v)); } catch (e) {} },
  };

  // ------------------------------------------------------------------ 数据
  const PAINTS = [['珍珠白', '#e9eaec'], ['冷光银', '#a7adb3'], ['星空灰', '#41464c'], ['钻石黑', '#0f1012'], ['深海蓝', '#1d3a66'], ['烈焰红', '#a1111b'], ['快银', '#c4c6c8']];
  // 车衣常见色
  const WRAPS = [['哑光黑', '#1b1c1e'], ['午夜紫', '#3d2463'], ['电光蓝', '#1f6bff'], ['青金蓝', '#0b6e8a'], ['薄荷绿', '#62d2b0'], ['军绿', '#4b5a3a'], ['樱花粉', '#f2a7c3'], ['熔岩橙', '#ff6a13'], ['赛道黄', '#ffd21a'], ['香槟金', '#c9a96e'], ['水泥灰', '#8d9196'], ['勃艮第红', '#6b1424']];
  const BODY_NAMES = { sedan: 'Model 3', suv: 'SUV', hatch: '我的掀背车', pickup: '我的皮卡', cybertruck: 'Cybertruck' };
  const TRACKS = [
    { t: '夜航星海', a: 'Lumen Drive', dur: 214, c: ['#0b1d3a', '#3e6ae1', '#9b5de5'], bpm: 96, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], pattern: [0, 1, 2, 1, 3, 2, 1, 2], drums: true },
    { t: 'Electric Dawn', a: 'Northbound', dur: 188, c: ['#3a0b1d', '#ff6b6b', '#ffd166'], bpm: 112, chords: [[62, 66, 69], [59, 62, 66], [55, 59, 62], [57, 61, 64]], pattern: [0, 2, 1, 3, 0, 2, 1, 3], drums: true },
    { t: '海岸线 101', a: 'The Regens', dur: 241, c: ['#06343b', '#2ec4b6', '#cbf3f0'], bpm: 84, chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], pattern: [0, null, 2, null, 1, null, 3, null], drums: false },
    { t: '超级充电', a: 'Volt Club', dur: 176, c: ['#0d2b12', '#18a957', '#e9ff70'], bpm: 124, chords: [[57, 60, 64], [57, 60, 64], [53, 57, 60], [55, 59, 62]], pattern: [0, 1, 2, 0, 1, 2, 3, 2], drums: true },
    { t: '雨夜高架', a: '城市回声', dur: 229, c: ['#1b1b2f', '#5c6bc0', '#ff8fab'], bpm: 76, chords: [[56, 60, 63, 67], [53, 56, 60, 63], [51, 55, 58, 62], [58, 62, 65, 68]], pattern: [0, null, 1, 2, null, 3, null, 2], drums: false },
    { t: 'Ludicrous', a: 'Plaid Society', dur: 198, c: ['#240046', '#ff006e', '#3a86ff'], bpm: 132, chords: [[52, 55, 59], [52, 55, 59], [48, 52, 55], [50, 54, 57]], pattern: [0, 1, 2, 3, 2, 1, 0, 1], drums: true },
  ];
  const APPS = {
    phone: { n: '电话', i: 'phone' }, camera: { n: '相机', i: 'camera' }, media: { n: '媒体', i: 'music' },
    calendar: { n: '日历', i: 'calendar' }, energy: { n: '能耗', i: 'energy' }, toybox: { n: '玩具箱', i: 'toybox' },
    theater: { n: '剧场', i: 'theater' }, game: { n: '游戏厅', i: 'game' }, browser: { n: '浏览器', i: 'browser' },
    dashcam: { n: '行车记录仪', i: 'dashcam' }, charge: { n: '充电', i: 'bolt' }, messages: { n: '消息', i: 'message' },
    manual: { n: '用户手册', i: 'manual' },
  };
  const SECTIONS = [
    ['quick', '快捷控制', 'car'], ['vehicle', '车型与外观', 'sparkle'], ['lights', '灯光', 'headlight'], ['locks', '锁', 'lock'],
    ['display', '显示', 'sun'], ['drive', '驾驶', 'gauge'], ['autopilot', '自动辅助驾驶', 'wheel'], ['charging', '充电', 'bolt'],
    ['trips', '行程', 'trip'], ['nav', '导航', 'navArrow'], ['safety', '安全', 'shield'], ['service', '维修保养', 'wrench'], ['software', '软件', 'download'],
  ];

  // 自制轮廓的掀背/皮卡不再提供选择（程序化车身仍保留给道路上的其他车辆）
  const HIDDEN_BODIES = ['hatch', 'pickup'];
  const bodyType = HIDDEN_BODIES.includes(store.get('body', 'cybertruck')) ? 'cybertruck' : store.get('body', 'cybertruck');
  const S = {
    skin: store.get('skin', 'tesla'), themePref: store.get('theme.v2', 'dark'),
    body: bodyType, carName: ['我的掀背车', '我的皮卡'].includes(store.get('carName', '')) ? BODY_NAMES[bodyType] : store.get('carName', BODY_NAMES[bodyType]), owner: store.get('owner', 'Tim'), paint: store.get('paint', '#e9eaec'), finish: store.get('finish', '原厂漆'), tail: store.get('tail', '原厂'),
    gear: 'P', speed: 0, cruise: 60, braking: false, ap: false, signal: null, hazard: false, limit: 60,
    battery: 78, showKm: false, odometer: 12843, trip: { km: 0, sec: 0 }, split: store.get('split', 700),
    locked: false, frunk: false, trunk: false, port: false, folded: false, childLock: false, windowLock: false, glovebox: false,
    headlights: 'auto', fog: false, autoHigh: true, ambient: true, ambientColor: '#3e6ae1', hlDelay: '1 分钟', wipers: '自动',
    walkLock: true, parkUnlock: true, lockSound: true, childSide: '关闭',
    brightness: 80, timeFmt: '24 小时', energyFmt: '百分比',
    accel: '标准', steering: '标准', stopMode: '保持', regen: '标准', traction: true,
    apMode: '自动转向', offset: '+0 km/h', followDist: 3, blindCam: true, laneWarn: '警告', fsd: true, autoLane: store.get('autoLane', true),
    chargeLimit: 80, chargeAmps: 32, charging: false, scheduled: false, energyMul: '×10', lowWarned: 100, redRuns: 0,
    mapMode: (store.get('mapMode', 'real') === 'real') ? '真实地图' : '模拟地图', navVol: 6, avoidHwy: false, autoNav: true, trafficOn: true, chargersOn: false,
    sentry: false, overspeed: '显示', fcw: '中', pinDrive: false, updatePref: '标准',
    rainbow: false, carExpanded: false,
    climate: { on: true, auto: true, left: 21, right: 21, sync: true, fan: 4, ac: true, recirc: false, defF: false, defR: false, seatL: 0, seatR: 0, wheel: false, mode: null, focusL: [250, 120], focusR: [550, 120] },
    volume: 5, muted: false,
    media: { idx: 0, pos: 37, playing: false, fav: [1], src: '流媒体' },
    netease: store.get('netease', null), // { type: 0 歌单 / 1 专辑 / 2 单曲, id }
    dockApps: ['messages', 'phone', 'camera', 'media', 'toybox'], recent: [], // 日历、能耗等放在「更多」里
    sheet: null, ctlSec: 'quick', ctlFilter: '', launcher: false,
    nav: { mode: 'idle', query: '', results: [], route: null, d: 0 },
    call: null, chargerCard: null,
  };
  // 网易云登录态（侧车）运行时状态
  const NEA = new Audio(); NEA.preload = 'auto';
  const NE = { probed: false, side: false, auth: null, tab: 'mine', lists: null, view: null, qr: null, queue: [], i: 0, q: '', stype: 'song', live: false, playing: false, loading: false, token: 0, fails: 0 };

  const listeners = [];
  function commit(...regions) {
    if (!regions.length) regions = ['all'];
    render(regions);
    listeners.forEach(fn => fn(S));
  }

  // ------------------------------------------------------------------ 工具
  const pad = n => String(n).padStart(2, '0');
  const fmtDur = s => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
  const fmtDist = m => m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} 米` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} 公里`;
  const clock = d => S.timeFmt === '12 小时' ? `${d.getHours() % 12 || 12}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}` : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const rangeKm = () => Math.round(S.battery * 5.56);
  const isDark = () => S.themePref === 'dark' || (S.themePref === 'auto' && (new Date().getHours() >= 18 || new Date().getHours() < 6));
  function art(i, cls = '') {
    const c = TRACKS[i].c;
    return `<div class="art art-gen ${cls}" style="--a1:${c[0]};--a2:${c[1]};--a3:${c[2]};--rot:${i * 57}deg"></div>`;
  }
  // 把屏幕坐标换算为缩放画布内坐标
  function localXY(e, el) {
    const r = el.getBoundingClientRect();
    return [(e.clientX - r.left) * (el.offsetWidth / r.width), (e.clientY - r.top) * (el.offsetHeight / r.height)];
  }

  let toastTimer;
  function toast(msg, ic) {
    const t = $('#toast');
    t.innerHTML = (ic ? I(ic, 24) : '') + `<span>${msg}</span>`;
    t.classList.add('show'); clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  // ------------------------------------------------------------------ 画布缩放
  // 手机（触屏且短边 < 600px）：隐藏顶部工具条、舞台铺满整个屏幕（留出刘海 / 圆角安全区），
  // 横屏时等比缩放并留黑边；竖屏显示“请横屏”提示。桌面端的布局保持不变。
  // 调试：地址后加 ?phone=1 可在电脑浏览器里模拟手机布局，?phone=0 强制关闭
  const rootEl = document.documentElement;
  function isPhone() {
    const q = /[?&]phone=([01])\b/.exec(location.search);
    if (q) return q[1] === '1';
    return !!(window.matchMedia && matchMedia('(pointer: coarse)').matches) && Math.min(window.innerWidth, window.innerHeight) < 600;
  }
  function fit() {
    const phone = isPhone();
    rootEl.classList.toggle('phone', phone);
    rootEl.classList.toggle('portrait', phone && window.innerHeight > window.innerWidth);
    const b = $('#bezel'), m = phone ? 0 : 26;
    const s = Math.min((b.clientWidth - m * 2) / 1920, (b.clientHeight - m * 2) / 1200);
    stage.style.transform = `scale(${s}) translate(-50%, -50%)`;
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => { fit(); setTimeout(fit, 250); setTimeout(fit, 700); }); // iOS 转屏后尺寸会晚一点才更新
  if (window.visualViewport) visualViewport.addEventListener('resize', fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe($('#bezel'));
  fit();
  // 手机上禁止双指缩放（iOS Safari 无视 user-scalable=no，要拦 gesture 事件）
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.addEventListener(ev, e => { if (rootEl.classList.contains('phone')) e.preventDefault(); }, { passive: false }));
  $('#rotateSkip').addEventListener('click', () => rootEl.classList.add('allow-portrait'));

  // ------------------------------------------------------------------ 3D 车辆
  let car = null;
  function initCar() {
    if (car || !window.THREE) return;
    car = Car3D.create($('#car3d'), { type: S.body, color: S.paint, finish: S.finish, tail: S.tail });
    car.setTheme(isDark());
    syncCar();
    car.onFrame = placeLabels;
    car.setViewShift(90);
    car.onEvent = onCarEvent;
    App.car = car;
  }
  window.addEventListener('three-ready', initCar);
  if (window.THREE) setTimeout(initCar);

  function syncCar() {
    if (!car) return;
    car.set('frunk', S.frunk); car.set('trunk', S.trunk); car.set('port', S.port); car.set('charging', S.charging); car.set('folded', S.folded);
    car.set('lights', S.headlights === 'on' || (S.headlights === 'auto' && (isDark() || S.gear !== 'P')));
    // 双闪开着时打转向灯：转向灯临时覆盖双闪（只闪变道一侧），变完道恢复双闪
    car.set('signal', S.signal || (S.hazard ? 'both' : null));
    car.setDrive(S.gear !== 'P'); car.setAP(S.ap); car.setRainbow(S.rainbow);
  }

  // 车身上的可点击标签（打开前备箱 / 后备箱 / 锁 / 充电口）
  const labels = $('#carLabels');
  labels.innerHTML = `
    <button class="car-label" data-lbl="frunk"></button>
    <button class="car-label" data-lbl="trunk"></button>
    <button class="car-label icon lockbtn" data-lbl="lock"></button>
    <button class="car-label icon" data-lbl="port"></button>`;
  labels.addEventListener('click', e => {
    const b = e.target.closest('[data-lbl]'); if (!b) return;
    const k = b.dataset.lbl;
    if (k === 'lock') setLock(!S.locked);
    else toggleKey(k === 'port' ? 'port' : k);
  });
  function renderLabels() {
    const q = n => labels.querySelector(`[data-lbl="${n}"]`);
    q('frunk').innerHTML = `${S.frunk ? '关闭' : '打开'}<small>前备箱</small>`;
    q('trunk').innerHTML = `${S.trunk ? '关闭' : '打开'}<small>后备箱</small>`;
    q('lock').innerHTML = I(S.locked ? 'lock' : 'unlock', 34);
    q('lock').classList.toggle('locked', S.locked);
    q('port').innerHTML = I('bolt', 30); q('port').classList.toggle('on', S.port);
  }
  function placeLabels() {
    if (!car) return;
    for (const n of ['frunk', 'trunk', 'lock', 'port']) {
      const p = car.project(n), el = labels.querySelector(`[data-lbl="${n}"]`);
      if (!p || !el) continue;
      el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
    }
  }

  // ------------------------------------------------------------------ 换挡 & 驾驶模拟
  function shift(g) {
    if (g === S.gear) return;
    if (g !== 'P' && (S.frunk || S.trunk)) { Sound.play('warn'); toast(`请先关闭${S.frunk ? '前备箱' : '后备箱'}`, 'info'); return; }
    if (g !== 'P' && S.port && S.charging) { Sound.play('warn'); toast('请先断开充电枪', 'bolt'); return; }
    if (g === 'P' && S.speed > 3) { Sound.play('error'); toast('请先将车辆停稳'); return; }
    if (S.locked) setLock(false, true);
    const fromPark = S.gear === 'P';
    if (S.port && g !== 'P') { S.port = false; }
    if (g !== 'P') setExpanded(false);
    S.gear = g;
    if (g !== 'D' && S.ap) setAP(false, true);
    Sound.play(g === 'P' ? 'gearP' : 'gear');
    $('#carpane').classList.toggle('driving', g !== 'P');
    $('#revCam').classList.toggle('show', g === 'R');
    if (g === 'R') startCamLoop($('#revCam canvas'), () => 'rear');
    // 行驶时地图切换为跟随车辆的行车视角
    if (g === 'D') { MapCtl.setNav(true); MapCtl.recenter(); if (S.nav.mode !== 'active' && !freeRoute.route) planFreeRoute(); }
    if (g === 'P' && S.nav.mode !== 'active') { MapCtl.setNav(false); MapCtl.recenter(); }
    // 从路边起步：车在应急车道上，提示打左灯并入车流
    if (g === 'D') { S.cruise = 0; setTimeout(() => banner(fromPark ? '从路边起步 · 按住 ↑ 加速，打左灯（←）并入车道' : '按住 ↑ 加速 · ↓ 减速 · ← → 打灯变道'), 300); }
    if (g !== 'D') { glow('left', false); glow('right', false); glow('front', false); }
    syncCar();
    commit();
  }

  function setAP(on, silent) {
    if (on && S.gear !== 'D') {
      Sound.play('apUnavailable'); banner('自动辅助驾驶暂不可用 · 请挂入 D 档', true); return;
    }
    S.ap = on;
    if (on) { S.cruise = S.speed > 15 ? Math.round(S.speed) : S.limit; Sound.play('apOn'); banner(S.apMode === '自动转向' ? '自动辅助转向已启用' : '交通感知巡航控制已启用'); }
    else if (!silent) { Sound.play('apOff'); banner('自动辅助驾驶已退出', true); }
    if (!on) autoLaneReset();
    syncCar(); commit('car', 'cp');
  }
  let bannerT;
  function banner(msg, warn) {
    const b = $('#apBanner'); b.textContent = msg; b.classList.toggle('warn', !!warn); b.classList.add('show');
    clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('show'), 2200);
  }

  function setSignal(side, auto, urgent) {
    if (auto) { if (S.signal) return; }
    else if (AL.byAuto && car && car.laneBusy) { AL.byAuto = false; car.cancelLane(); } // 手动打灯：接管自动变道
    S.signal = S.signal === side ? null : side;
    Sound.play(S.signal ? 'signalOn' : 'signalOff');
    // 行驶中打灯 = 变道请求
    if (S.signal && S.gear === 'D' && S.speed > 10 && car) car.requestLane(side === 'left' ? -1 : 1, auto ? { auto: true, urgent: !!urgent } : undefined);
    else if (!S.signal && car) car.cancelLane();
    if (S.signal) setTimeout(() => { if (S.signal === side) { S.signal = null; syncCar(); commit('car'); } }, 8000);
    syncCar(); commit('car');
  }
  // 鸣笛：按住持续响；前车会加速或让道
  let hornOn = false, hornT = 0;
  function honk(on) {
    if (on === hornOn) return;
    hornOn = on; Sound.horn(on);
    $$('[data-horn]').forEach(b => b.classList.toggle('on', on));
    if (on && car && S.gear === 'D' && S.speed > 5 && performance.now() - hornT > 1500) {
      hornT = performance.now();
      if (car.honk()) setTimeout(() => banner('前车正在让行'), 400);
    }
  }
  // 双闪（危险警示灯）
  function toggleHazard() {
    S.hazard = !S.hazard; sigAcc = 0;
    Sound.play(S.hazard ? 'signalOn' : 'signalOff');
    banner(S.hazard ? '危险警示灯已开启' : '危险警示灯已关闭', S.hazard);
    syncCar(); commit('car', 'sheet');
  }
  // 自动变道（Autopilot + 自动转向 + 设置里“自动变道”开启，车速 > 25 km/h）：
  // 慢车超车 → 超车后空档安全 3 秒返回原车道 → 遇障碍来不及停时优先变道避让；每 0.5 秒评估一次，自动变道之间冷却 7 秒
  let alClock = 0; // 自动变道用的模拟时钟（毫秒，随仿真步进，不受页面卡顿影响）
  const AL = { next: 0, cool: 0, ret: null, retSince: 0, glowT: -1e9, byAuto: false };
  const alOn = () => S.ap && S.autoLane && S.apMode === '自动转向' && S.gear === 'D' && S.speed > 25 && !pull && !S.hazard;
  function alReset() { AL.ret = null; AL.retSince = 0; AL.byAuto = false; }
  function autoLaneReset() { if (AL.byAuto && car && car.laneBusy) car.cancelLane(); alReset(); }
  // 目标车道空档：前方 front 米 + 接近速度×1.5 秒；后方 rear 米 + 对方追近速度×2 秒
  function alGapOk(info, v, front, rear) {
    const a = info.ahead, b = info.behind;
    if (a && a.gap < front + Math.max(0, v - a.v) / 3.6 * 1.5) return false;
    if (b && b.gap < rear + Math.max(0, b.v - v) / 3.6 * 2) return false;
    return true;
  }
  // 变道受阻：只偶尔闪一下对应一侧的红光（不响铃、不刷屏）
  function alBlocked(dir) {
    if (alClock - AL.glowT < 8000) return; AL.glowT = alClock;
    const side = dir < 0 ? 'left' : 'right', el = $('#glow-' + side);
    if (el) glow(side, el.classList.contains('on'), true);
  }
  function alGo(dir, msg, warn, urgent) { AL.byAuto = true; banner(msg, warn); setSignal(dir < 0 ? 'left' : 'right', true, urgent); }
  function stepAutoLane(now) {
    if (now < AL.next) return;
    AL.next = now + 500;
    if (!car || !alOn()) { AL.retSince = 0; return; }
    if (car.laneBusy || S.signal) return;
    const lane = car.lane;
    if (lane < -1 || lane > 1) return;
    const v = S.speed, lead = car.getLead(), stop = car.getStop();
    const ok = d => lane + d >= -1 && lane + d <= 1;
    const closing = lead ? Math.max(0, v - lead.v) / 3.6 : 0;
    // 来不及舒适停车（制动 5 m/s²）或不足 2.5 秒碰撞时间：视为紧急，无视冷却，两侧都可选，空档要求放宽
    const critical = !!lead && closing > 1 && (lead.gap < closing * closing / 10 + 10 || lead.gap / closing < 2.5);
    // 前车明显慢于设定速度（40 米内或 4 秒内追上，且比设定速度低 8 km/h 以上；货车 / 公交低 3 km/h；静止车辆）
    const slow = !!lead && !stop && lead.gap < Math.max(40, closing * 4) &&
      (lead.v < S.cruise - 8 || ((lead.kind === 'truck' || lead.kind === 'bus') && lead.v < S.cruise - 3) || lead.v < 5) && S.cruise > lead.v + 3;
    if (critical || (slow && now >= AL.cool)) {
      const tries = critical ? [-1, 1] : (lane === -1 ? [-1, 1] : [-1]);
      for (const d of tries) {
        if (!ok(d)) continue;
        const info = car.laneInfo(lane + d);
        // 值得变过去：那条车道前方更快、或更空；紧急时只要前方不比现在更糟
        const a = info.ahead, better = !a || a.gap > 90 || a.v > lead.v + (critical ? 0 : 5);
        if (!better) continue;
        if (!alGapOk(info, v, critical ? 12 : 18, critical ? 10 : 15)) { alBlocked(d); continue; }
        if (AL.ret == null) AL.ret = lane;
        return alGo(d, critical ? '前方有障碍 · 自动变道避让' : '前方车辆较慢 · 自动变道超车', critical, critical);
      }
      return;
    }
    // 超车完成后返回原车道：原车道前方没有很快会追上的慢车（≥ 8 秒才追上或已远离）、后方无快车，持续 3 秒
    if (AL.ret != null && AL.ret !== lane && now >= AL.cool) {
      const d = Math.sign(AL.ret - lane);
      const info = car.laneInfo(lane + d), a = info.ahead;
      const cl = a ? Math.max(0, v - a.v) / 3.6 : 0, farOk = !a || a.gap > 120 || a.gap > 50 + cl * 8 || (a.v >= S.cruise - 8 && a.gap > 35);
      if (ok(d) && farOk && alGapOk(info, v, 20, 15)) {
        if (!AL.retSince) AL.retSince = now;
        if (now - AL.retSince >= 3000) { AL.retSince = 0; return alGo(d, '已超车 · 自动返回原车道'); }
      } else AL.retSince = 0;
    } else if (AL.ret === lane) alReset();
  }
  // 靠边停车：打右灯逐条并入应急车道，减速停稳后打开双闪
  // mode 'arrive'：导航快到目的地时自动靠边，只并道限速，由到达逻辑停车
  let pull = null;
  function pullOver(mode = 'stop') {
    if (mode === 'stop' && pull && pull.mode === 'stop') { endPull(); S.cruise = S.speed; return banner('已取消靠边停车'); }
    if (S.gear !== 'D' || S.speed < 1) { if (mode === 'stop') { Sound.play('error'); banner('行驶中才能靠边停车', true); } return; }
    if (S.ap) setAP(false, true);
    pull = { mode };
    if (mode === 'stop') { Sound.play('toggle'); banner('正在靠边停车'); }
    $$('[data-pull]').forEach(b => b.classList.add('on'));
  }
  function endPull() { pull = null; $$('[data-pull]').forEach(b => b.classList.remove('on')); }
  function stepPull() {
    if (!pull || !car) return;
    if (S.gear !== 'D') return endPull();
    const lane = car.lane;
    if (lane < 2) {
      S.cruise = Math.min(S.cruise, 45);
      // 进应急车道前先减到 60 以下；其他车道随时可以并
      if (S.signal !== 'right' && S.speed > 10 && (lane < 1 || S.speed <= 58)) setSignal('right');
    } else if (pull.mode === 'stop') {
      S.cruise = 0;
      if (S.speed === 0) { endPull(); if (!S.hazard) toggleHazard(); Sound.play('chime'); setTimeout(() => banner('已靠边停车 · 可挂 P 档'), 900); }
    } else S.cruise = Math.min(S.cruise, 30);
  }
  // 路边充电站（距本车的米数）：导航去充电站时出现，到达后留在原地直到开走
  let stationX = null;
  const isCharger = p => !!p && (MapCtl.CHARGERS.some(c => c.name === p.name) || /充电/.test(p.name));

  function honkTap() { honk(true); setTimeout(() => honk(false), 350); }
  function apSpeedHint() {
    const now = performance.now();
    if (now - apHintT > 250) { apHintT = now; banner(`设定速度 ${Math.round(S.cruise)} km/h`); }
  }

  // 屏幕边缘红色光晕（盲区 / 碰撞预警）
  function glow(side, on, flash) {
    const el = $('#glow-' + side); if (!el) return;
    el.classList.toggle('on', on);
    if (flash) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); el.addEventListener('animationend', () => el.classList.remove('flash'), { once: true }); }
  }
  function onCarEvent(type, d) {
    if (type === 'crash') {
      // 撞停：本车速度变为对方车速的一部分，退出 Autopilot
      S.speed = S.cruise = d.front ? Math.max(0, d.v * 0.7) : Math.max(S.speed, d.v * 0.6);
      if (S.ap) setAP(false, true);
      Sound.play('crash');
      glow('front', true, true); setTimeout(() => { if (!fcwOn) glow('front', false); }, 900);
      const p = $('#carpane'); p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake');
      banner('发生碰撞！请注意车距', true);
      return;
    }
    if (type === 'blind') {
      glow('left', d.left); glow('right', d.right);
      if ((d.left && S.signal === 'left') || (d.right && S.signal === 'right')) Sound.play('warn');
    }
    if (type === 'lane') {
      const side = d.dir < 0 ? '左' : '右';
      if (d.status === 'blocked') { Sound.play('warn'); glow(d.dir < 0 ? 'left' : 'right', true, true); banner(`${side}侧盲区有车 · 等待安全时机变道`, true); }
      if (d.status === 'edge') { Sound.play('error'); banner(d.dir > 0 && car.lane === 2 ? '已在应急车道' : `已在最${side}侧车道`, true); clearSignal(); }
      if (d.status === 'fast') { Sound.play('error'); banner('车速高于 60 km/h，不能驶入应急车道', true); clearSignal(); }
      if (d.status === 'start') banner(`正在向${side}变道`);
      if (d.status === 'done') { if (!AL.byAuto) AL.ret = null; AL.byAuto = false; AL.cool = alClock + 7000; AL.retSince = 0; }
      if (d.status === 'cancel' && d.auto) { AL.byAuto = false; AL.next = alClock + 1500; alBlocked(d.dir); }
      if (d.status === 'done' || d.status === 'cancel') clearSignal();
    }
  }
  function clearSignal() { if (S.signal) { S.signal = null; Sound.play('signalOff'); syncCar(); commit('car'); } }

  // 档位条：在左侧边缘上下滑动（上 = R，下 = D）
  (function gearStrip() {
    const strip = $('#gearStrip'), pop = $('#gearPop');
    pop.innerHTML = ['R', 'N', 'D'].map(g => `<span data-g="${g}">${g}</span>`).join('');
    let y0 = null, pick = null;
    const mark = g => pop.querySelectorAll('span').forEach(s => s.classList.toggle('on', s.dataset.g === g));
    strip.addEventListener('pointerdown', e => { y0 = localXY(e, stage)[1]; pick = null; strip.classList.add('active'); strip.setPointerCapture(e.pointerId); mark(S.gear === 'P' ? null : S.gear); });
    strip.addEventListener('pointermove', e => {
      if (y0 == null) return;
      const dy = localXY(e, stage)[1] - y0;
      pick = dy < -50 ? 'R' : dy > 50 ? 'D' : (Math.abs(dy) > 20 ? 'N' : null);
      mark(pick || (S.gear === 'P' ? null : S.gear));
    });
    const up = () => { if (y0 == null) return; y0 = null; strip.classList.remove('active'); if (pick) shift(pick); };
    strip.addEventListener('pointerup', up); strip.addEventListener('pointercancel', up);
  })();

  const pedal = { up: false, down: false };
  let fcwOn = false, apHintT = 0;
  // 自由驾驶：随机选一个 3–6 km 外的点，规划真实道路路线后沿路行驶
  let freeRoute = { route: null, d: 0, loading: false };
  async function planFreeRoute() {
    if (freeRoute.loading) return;
    // 优先沿地图上的真实道路开；地图还没加载出道路时才去请求路线服务
    const road = MapCtl.roadRoute();
    if (road) { freeRoute = { route: road, d: 0, loading: false }; return; }
    freeRoute.loading = true;
    const a = MapCtl.carLL, ang = Math.random() * Math.PI * 2, km = 3 + Math.random() * 3;
    const r = await MapCtl.route({ name: '自由驾驶', ll: [a[0] + Math.cos(ang) * km / 95, a[1] + Math.sin(ang) * km / 111] });
    // 规划期间车辆已经往前走了一段：从路线前 500 米里找离当前位置最近的点接上，避免跳回起点
    let d0 = 0, best = Infinity;
    if (r) for (let d = 0; d <= Math.min(500, r.total); d += 5) {
      const dist = MapCtl.haversine(MapCtl.carLL, MapCtl.pointAt(r, d).ll);
      if (dist < best) { best = dist; d0 = d; }
    }
    // 路线服务失败时返回的是示意直线路线，自由驾驶不用它（会横穿建筑和树林）
    freeRoute = { route: S.nav.mode === 'active' || r.fake ? null : r, d: d0, loading: false };
  }
  let shoulderHintT = 0, apLightWait = false;
  const ENERGY_MUL = { 真实: 1, '×10': 10, '×30': 30 };

  // 红绿灯：每个路口有自己的相位，按“绿 16 秒 → 黄 3 秒 → 红 15 秒”循环
  // 用路口的地理位置做种子，同一个路口无论走哪条路线看到的灯都一致
  const LIGHT_CYCLE = 34;
  function lightState(r, absD) {
    const ll = MapCtl.pointAt(r, absD).ll, key = Math.round(ll[0] / 3e-4) * 7919 + Math.round(ll[1] / 3e-4);
    const h = Math.sin(key * 12.9898) * 43758.5453, off = (h - Math.floor(h)) * LIGHT_CYCLE;
    const t = (performance.now() / 1000 + off) % LIGHT_CYCLE;
    return t < 16 ? { state: 'green', left: 16 - t, key } : t < 19 ? { state: 'yellow', left: 19 - t, key } : { state: 'red', left: LIGHT_CYCLE - t, key };
  }
  // 闯红灯检测 + 仪表上的红绿灯读秒
  const lastStop = new Map();
  let tlightHTML = '';
  function watchLights(js, ls) {
    let chip = '';
    js.forEach((x, i) => {
      const d = x - 19 - 2.4, L = ls[i], was = lastStop.get(L.key);
      if (was != null && was > 0 && d <= 0 && L.state === 'red' && S.speed > 5) { S.redRuns++; Sound.play('warn'); banner(`闯红灯！（第 ${S.redRuns} 次）`, true); glow('front', true, true); setTimeout(() => glow('front', false), 900); }
      lastStop.set(L.key, d);
      if (!chip && d > -2 && d < 160) chip = `<i class="${L.state}"></i><b>${Math.ceil(L.left)}</b>`;
    });
    if (lastStop.size > 50) lastStop.clear();
    if (chip !== tlightHTML) { tlightHTML = chip; const el = $('#tlight'); el.innerHTML = chip; el.classList.toggle('show', !!chip); }
  }

  // 充电站：附近最近的几个（模拟地图会在整座城市里生成超充站）
  const nearestChargers = (n = 3) => MapCtl.nearestChargers ? MapCtl.nearestChargers(MapCtl.carLL, n)
    : MapCtl.CHARGERS.map(c => ({ ...c, km: MapCtl.haversine(MapCtl.carLL, c.ll) / 1000 })).sort((a, b) => a.km - b.km).slice(0, n);
  async function goCharge(c, start) {
    c = c || nearestChargers(1)[0]; if (!c) return;
    await navigateTo({ name: c.name, addr: `${c.kw} kW 超级充电 · ${c.free}/${c.total} 可用`, ll: c.ll, icon: 'bolt' });
    if (start && S.nav.mode === 'preview') startNav();
  }
  function lowBattery() {
    Sound.play('warn');
    if (S.nav.mode === 'active' && isCharger(S.nav.route.dest)) return toast(`电量 ${Math.round(S.battery)}% · 正在前往充电站`, 'bolt');
    const c = nearestChargers(1)[0]; if (!c) return;
    const old = $('#mappane .lowbat-card'); if (old) old.remove();
    const el = document.createElement('div'); el.className = 'charger-card lowbat-card';
    el.innerHTML = `<h4>${I('bolt', 26)}电量低：${Math.round(S.battery)}%</h4><p>剩余续航约 ${rangeKm()} km，建议尽快充电。<br>最近的充电站：${c.name}<br>${c.km.toFixed(1)} km · ${c.free}/${c.total} 个充电桩可用 · ${c.kw} kW</p><div class="route-actions"><button class="btn primary" data-lb="go">${I('navArrow', 22)}导航前往</button><button class="btn" data-lb="later">稍后</button></div>`;
    el.addEventListener('click', e => { const b = e.target.closest('[data-lb]'); if (!b) return; Sound.play('tap'); el.remove(); if (b.dataset.lb === 'go') goCharge(c, true); });
    $('#mappane').appendChild(el);
  }
  let simLast = performance.now(), mapAcc = 0, sigAcc = 0, sigPhase = false, slowAcc = 0;
  function sim(now) {
    const dt = Math.min(0.1, (now - simLast) / 1000); simLast = now;
    // 速度
    // 按住 ↑ 踩电门、按住 ↓ 踩刹车，松开后保持当前车速（开启 Autopilot 时 ↑ ↓ 调整设定速度）
    const accel = { 舒适: 9, 标准: 15, 狂暴: 30 }[S.accel] || 15;
    const vmax = S.accel === '狂暴' ? 250 : 180;
    if (S.gear === 'D') {
      if (S.ap) {
        if (pedal.up) S.cruise = Math.min(vmax, S.cruise + 15 * dt);
        if (pedal.down) S.cruise = Math.max(20, S.cruise - 15 * dt);
        if (pedal.up || pedal.down) apSpeedHint();
      } else if (pedal.up) S.cruise = Math.min(vmax, S.speed + accel * 0.4);
      else if (pedal.down) S.cruise = Math.max(0, S.speed - 12);
      else if (pedal.was) S.cruise = S.speed; // 松开踏板：保持当前车速
    }
    pedal.was = pedal.up || pedal.down;
    let target = 0, decel = 22;
    if (S.gear === 'D') target = S.braking ? 0 : S.cruise;
    if (S.gear === 'R') target = S.braking ? 0 : (pedal.up ? 8 : 4);
    if (S.braking || pedal.down) decel = 40;
    // 同车道前车：Autopilot 自动跟车；手动驾驶时距离过近触发碰撞预警 + 自动紧急制动
    const lead = car && S.gear === 'D' && S.speed > 1 ? car.getLead() : null;
    if (lead) {
      if (S.ap) {
        const safe = 8 + S.followDist * S.speed / 12;
        if (lead.gap < safe) target = Math.min(target, Math.max(0, lead.v - (safe - lead.gap) * 1.5));
        // 前方静止 / 很慢的车：按剩余距离提前减速（约 4 m/s²），来不及时加大制动（自动紧急制动）
        if (S.speed > lead.v) {
          const room = Math.max(0, lead.gap - 4), cv = (S.speed - lead.v) / 3.6;
          target = Math.min(target, lead.v + Math.sqrt(2 * 4 * room) * 3.6);
          if (cv * cv / (2 * Math.max(room, 0.5)) > 5.5) decel = Math.max(decel, 40);
        }
      } else if (S.speed > lead.v + 3 && lead.gap / ((S.speed - lead.v) / 3.6) < 1.8) {
        if (!fcwOn) { fcwOn = true; Sound.play('warn'); glow('front', true); banner('前方碰撞预警 · 自动紧急制动', true); }
        target = Math.min(target, lead.v - 5); decel = 90; S.cruise = Math.min(S.cruise, lead.v);
      }
    }
    if (fcwOn && (!lead || S.speed <= lead.v + 1)) { fcwOn = false; glow('front', false); }
    // 红绿灯：Autopilot 在停止线前平稳停车，绿灯后自动继续；来不及停的黄灯直接通过
    const stopAt = car && S.gear === 'D' ? car.getStop() : null;
    if (S.ap && stopAt) {
      const v = S.speed / 3.6;
      if (stopAt.state === 'red' || stopAt.d > v * v / (2 * 3.5) + 2) {
        target = Math.min(target, Math.sqrt(2 * 2.6 * Math.max(0, stopAt.d - 1.5)) * 3.6);
        if (!apLightWait && stopAt.d < 80) { apLightWait = true; banner(stopAt.state === 'red' ? '前方红灯 · 自动停车' : '前方黄灯 · 准备停车'); }
      }
    } else if (apLightWait) { apLightWait = false; if (S.ap) banner('绿灯 · 继续行驶'); }
    // 电量耗尽：无法再加速，滑行停车
    if (S.battery <= 0 && S.gear !== 'P') { target = 0; decel = 8; if (!S.emptyWarned) { S.emptyWarned = true; Sound.play('error'); banner('电量耗尽 · 车辆即将停止', true); } }
    const prev = S.speed;
    if (S.gear === 'N') S.speed = Math.max(0, S.speed - 1.5 * dt);
    else S.speed += Math.max(-decel * dt, Math.min(accel * dt, target - S.speed));
    if (S.speed < 0.05 && target <= 0) S.speed = 0;
    S.speed = Math.max(0, S.speed);
    if (car) car.setSpeed(S.gear === 'R' ? -S.speed : S.speed);
    // 能耗：行驶阻力随车速平方增加，加速额外耗电、减速动能回收（75 kWh 电池），乘以演示倍率
    if (S.gear !== 'P' && !S.charging) {
      const v = S.speed, acc = (S.speed - prev) / Math.max(dt, 1e-3);
      const kw = 0.8 + v * (120 + 0.022 * v * v) / 1000 + Math.max(-25, acc * v * 0.035);
      S.battery = Math.max(0, S.battery - kw * dt / 3600 / 75 * 100 * (ENERGY_MUL[S.energyMul] || 1));
    }
    if (Math.round(prev) !== Math.round(S.speed)) { $('#speed').textContent = Math.round(S.speed); App.onSpeed && App.onSpeed(S.speed); }

    // 转向灯“嗒-哒”
    if (S.signal || S.hazard) { sigAcc += dt; if (sigAcc > 0.38) { sigAcc = 0; sigPhase = !sigPhase; Sound.play(sigPhase ? 'signalOn' : 'signalOff'); } }

    // 地图上的车辆移动：与仪表车速一致
    // 有导航时沿导航路线走；没有导航时沿后台规划的一条附近道路“自由驾驶”
    const n = S.nav;
    if (S.gear !== 'P') { S.trip.sec += dt; S.trip.km += S.speed / 3.6 * dt / 1000; }
    if (S.gear === 'D' && S.speed > 0.5) {
      const step = S.speed / 3.6 * dt;
      mapAcc += dt;
      if (stationX != null) { stationX -= step; if (stationX < -60) stationX = null; }
      if (n.mode === 'active') {
        n.d += step;
        const remain = n.route.total - n.d;
        if (remain < 260 && !n.pulled) { n.pulled = true; pullOver('arrive'); }
        if (remain < 300 && isCharger(n.route.dest)) stationX = remain;
        if (n.d >= n.route.total - 3) arrive();
        else if (mapAcc > 0.25) {
          mapAcc = 0;
          const p = MapCtl.pointAt(n.route, n.d);
          MapCtl.setCar(p.ll, p.brg, { duration: 260 });
          MapCtl.progress(n.route, n.d);
          renderTurn();
        }
      } else if (!freeRoute.route) {
        // 路线还没规划好（路线服务可能要好几秒）：先沿当前朝向直行，地图不能停
        planFreeRoute();
        if (mapAcc > 0.25) {
          const [lng, lat] = MapCtl.carLL, b = MapCtl.carBrg * Math.PI / 180, d = S.speed / 3.6 * mapAcc;
          mapAcc = 0;
          MapCtl.setCar([lng + d * Math.sin(b) / (111320 * Math.cos(lat * Math.PI / 180)), lat + d * Math.cos(b) / 110540], MapCtl.carBrg, { duration: 260 });
        }
      } else {
        freeRoute.d += step;
        if (freeRoute.d >= freeRoute.route.total - 3) freeRoute.route = null;
        else if (mapAcc > 0.25) {
          mapAcc = 0;
          const p = MapCtl.pointAt(freeRoute.route, freeRoute.d);
          MapCtl.setCar(p.ll, p.brg, { duration: 260 });
        }
      }
    }
    stepPull();
    alClock += dt * 1000; stepAutoLane(alClock);
    // 在应急车道上行驶：Autopilot 会自动打灯并入车流；手动驾驶时定期提醒
    if (car && S.gear === 'D' && car.lane === 2 && !pull && S.speed > 10 && !S.signal) {
      if (S.ap) setSignal('left');
      else if (now - shoulderHintT > 7000) { shoulderHintT = now; banner('正在应急车道行驶 · 请打左灯（←）并入车道', true); }
    }
    // 3D 画面的道路形状跟随路线（导航或自由驾驶），路口处画出横向道路
    if (car) {
      const tr = S.gear === 'D' ? (n.mode === 'active' && n.route ? [n.route, n.d] : freeRoute.route ? [freeRoute.route, freeRoute.d] : null) : null;
      if (tr) {
        const [r, d] = tr;
        // 真实地图的路口要先在路网里核对（过滤掉出入口、辅路等），模拟地图的路口都是真的
        const js = (r.junctions || []).filter(j => j - d > -40 && j - d < 250 && (!MapCtl.junctionOk || MapCtl.junctionOk(r, j))).map(j => j - d);
        const ls = js.map(j => lightState(r, j + d));
        car.setTrack(s => MapCtl.pointAt(r, Math.max(0, Math.min(r.total, d + s))).brg, js, ls.map(l => l.state));
        watchLights(js, ls);
      } else { car.setTrack(null); watchLights([], []); }
      car.setStation(stationX);
    }
    // 自动驻车（到达目的地后）；到达充电站时自动插枪充电
    if (S.nav.autoPark && S.speed === 0 && S.gear === 'D') {
      const charge = S.nav.charge; S.nav.autoPark = false; S.nav.charge = false; shift('P');
      if (charge) setTimeout(() => { toast('已停入充电车位 · 正在连接充电枪', 'bolt'); setTimeout(() => startCharging(true), 1400); }, 600);
    }

    // 电池 / 充电 / 媒体进度（低频更新）
    slowAcc += dt;
    if (slowAcc > 1) {
      if (S.gear !== 'P') S.odometer += S.speed / 3600;
      // 低电量提醒：20% / 10% / 5% 各提醒一次；充到 25% 以上后重置
      for (const th of [20, 10, 5]) if (S.battery <= th && S.lowWarned > th) { S.lowWarned = th; lowBattery(); break; }
      if (S.battery > 25) S.lowWarned = 100;
      if (S.battery > 1) S.emptyWarned = false;
      if (S.charging) { S.battery = Math.min(S.chargeLimit, S.battery + 0.35); if (S.battery >= S.chargeLimit) { S.charging = false; Sound.play('chime'); toast('充电完成', 'bolt'); } }
      if (S.media.playing) { S.media.pos += slowAcc; if (S.media.pos >= TRACKS[S.media.idx].dur) nextTrack(); }
      slowAcc = 0;
      renderCarTop(); renderMiniProgress();
      if (S.sheet && S.sheet.type === 'controls' && S.ctlSec === 'charging') renderSheet();
      if (S.call && S.call.state === 'live') renderCall();
      listeners.forEach(fn => fn(S, 'tick'));
    }
    requestAnimationFrame(sim);
  }
  requestAnimationFrame(sim);

  // ------------------------------------------------------------------ 车辆控制动作
  function setLock(v, silent) {
    S.locked = v;
    if (!silent) { Sound.play(v ? 'lock' : 'unlock'); toast(v ? '车辆已锁定' : '车辆已解锁', v ? 'lock' : 'unlock'); }
    if (v) { S.folded = true; car && car.set('folded', true); } else { S.folded = false; car && car.set('folded', false); }
    commit();
  }
  function toggleKey(k) {
    if ((k === 'frunk' || k === 'trunk') && S.gear !== 'P' && !S[k]) { Sound.play('error'); toast('请先挂入 P 档'); return; }
    S[k] = !S[k];
    if (k === 'frunk' || k === 'trunk') Sound.play(S[k] ? 'frunk' : 'door');
    else if (k === 'port') { Sound.play(S[k] ? 'open' : 'close'); if (!S.port) S.charging = false; }
    else Sound.play('toggle');
    if (k === 'glovebox' && S.glovebox) { toast('手套箱已打开', 'glovebox'); setTimeout(() => { S.glovebox = false; commit('sheet'); }, 1500); }
    if (k === 'folded') toast(S.folded ? '后视镜已折叠' : '后视镜已展开', 'mirror');
    syncCar(); commit();
  }
  function startCharging(on) {
    if (on && S.gear !== 'P') { Sound.play('error'); toast('请先挂入 P 档'); return; }
    if (on && S.battery >= S.chargeLimit) { toast('已达到充电上限'); return; }
    if (on) { S.port = true; Sound.play('charge'); toast('开始充电 · 模拟 250 kW 超充', 'bolt'); }
    S.charging = on; syncCar(); commit();
  }

  // ------------------------------------------------------------------ 主题 / 皮肤
  function applyTheme() {
    const d = isDark();
    stage.classList.toggle('dark', d);
    car && car.setTheme(d);
    MapCtl.setDark(d);
    syncCar();
  }
  function setTheme(p) { S.themePref = p; store.set('theme.v2', p); applyTheme(); commit(); }
  function setSkin(sk) {
    S.skin = sk; store.set('skin', sk);
    $('#tesla').classList.toggle('active', sk === 'tesla');
    $('#carplay').classList.toggle('active', sk === 'carplay');
    if (sk === 'tesla') {
      MapCtl.moveTo($('#teslaMapHost'));
      if (car) car.moveTo($('#car3d'));
    }
    window.CarPlay && (sk === 'carplay' ? CarPlay.activate() : CarPlay.deactivate());
    Sound.play('chime');
    commit();
  }
  function setBody(t) {
    const wasDefault = Object.values(BODY_NAMES).includes(S.carName);
    S.body = t; store.set('body', t);
    if (wasDefault) { S.carName = BODY_NAMES[t]; store.set('carName', S.carName); }
    car && car.setBody(t, S.paint); syncCar(); commit();
  }
  function setPaint(c) { S.paint = c; store.set('paint', c); car && car.setColor(c); commit(); }

  // ------------------------------------------------------------------ 渲染：车辆区
  function renderCarTop() {
    $('#gears').innerHTML = ['P', 'R', 'N', 'D'].map(g => `<button data-gear="${g}" class="${S.gear === g ? 'on' : ''}">${g}</button>`).join('');
    const lightsOn = S.headlights === 'on' || (S.headlights === 'auto' && (isDark() || S.gear !== 'P'));
    $('#indicators').innerHTML = (lightsOn ? I('headlight', 30) : '') + (S.fog ? I('fog', 30) : '') + (S.ap ? `<span class="blue">${I('wheel', 30)}</span>` : '');
    const b = Math.round(S.battery);
    $('#batteryChip').classList.toggle('charging', !!S.charging);
    $('#batteryChip').innerHTML = `<span>${S.showKm ? rangeKm() + ' km' : b + '%'}</span>${S.charging ? I('bolt', 20) : ''}<div class="batt ${S.charging ? 'charging' : ''} ${b < 20 ? 'low' : ''}"><i style="width:${b}%"></i></div>`;
    const hud = $('#driveHud');
    $('#speed').textContent = Math.round(S.speed);
    $('#limit').textContent = S.limit;
    $('#apBtn').innerHTML = I('wheel', 34); $('#apBtn').classList.toggle('on', S.ap);
    $('#sigL').innerHTML = I('signalL', 40); $('#sigR').innerHTML = I('signalR', 40);
    // 注意 toggle 的第二个参数必须是布尔值：传 undefined 会变成“反转”，导致转向灯自己乱闪
    const lit = S.signal || (S.hazard ? 'both' : null);
    $('#sigL').classList.toggle('on', lit === 'left' || lit === 'both'); $('#sigR').classList.toggle('on', lit === 'right' || lit === 'both');
    $$('[data-hazard]').forEach(b => b.classList.toggle('on', !!S.hazard));
    hud.classList.toggle('ap', S.ap);
    $('#carMeta').innerHTML = `<h2>${S.carName}</h2><p>${rangeKm()} km 续航 · ${S.locked ? '已锁定' : '已解锁'}${S.sentry ? ' · 哨兵模式' : ''}</p>`;
    renderLabels();
  }
  $('#gears').addEventListener('click', e => { const b = e.target.closest('[data-gear]'); if (b) shift(b.dataset.gear); });
  $('#batteryChip').addEventListener('click', () => { S.showKm = !S.showKm; Sound.play('tap'); renderCarTop(); });
  $('#apBtn').addEventListener('click', () => setAP(!S.ap));

  // ------------------------------------------------------------------ 渲染：状态栏
  function escH(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
  function renderStatus() {
    const d = new Date();
    $('#statusbar').innerHTML = `
      <button data-act="lock">${I(S.locked ? 'lock' : 'unlock', 26)}</button>
      <span>${clock(d)}</span>
      <span>18°C</span>
      <button class="profile" data-act="profile">${I('user', 24)}<span>${escH(S.owner)}</span></button>
      ${S.sentry ? `<span class="sentry-on">${I('sentry', 24)}</span>` : ''}
      <span class="airbag">${I('airbag', 26)}<em>乘客安全气囊<b>关闭</b></em></span>`;
  }
  $('#statusbar').addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'lock') setLock(!S.locked);
    if (a.dataset.act === 'profile') { Sound.play('tap'); toast(`驾驶员配置 · ${S.owner}（座椅、后视镜、方向盘已记忆）· 在 控制 › 车型与外观 里可以改名字`, 'user'); }
  });
  setInterval(renderStatus, 10000);

  // ------------------------------------------------------------------ 渲染：Dock
  function renderDock() {
    const c = S.climate;
    const temp = side => {
      const v = side === 'L' ? c.left : c.right;
      if (!c.on) return `<div class="temp"><button class="val off" data-act="climate">关闭</button></div>`;
      const txt = v <= 15 ? 'LO' : v >= 28 ? 'HI' : v.toFixed(1);
      return `<div class="temp"><button class="arrow" data-temp="${side}" data-d="-0.5">${I('chevL', 30)}</button><button class="val" data-act="climate">${txt}</button><button class="arrow" data-temp="${side}" data-d="0.5">${I('chevR', 30)}</button></div>`;
    };
    // 应用图标：彩色填充圆角方块（参照新版车机），日历显示当天日期
    const glyph = id => id === 'calendar' ? `<span class="cal"><i></i>${new Date().getDate()}</span>` : id === 'camera' ? '<span class="lens"></span>' : I(APPS[id].i, id === 'phone' || id === 'messages' ? 40 : 30);
    const appBtn = (id, recent) => `<button class="dbtn app-ic t-${id} ${S.sheet && S.sheet.app === id ? 'on' : ''}" data-app="${id}" title="${APPS[id].n}"><span class="tile">${glyph(id)}</span>${recent ? '<span class="recent-dot"></span>' : ''}</button>`;
    $('#dock').innerHTML = `
      <div class="dock-group">
        <button class="dbtn ${S.sheet && S.sheet.type === 'controls' ? 'on' : ''}" data-act="controls" title="控制">${I('car', 44)}</button>
        ${temp('L')}
      </div>
      <div class="dock-group dock-center">
        ${S.dockApps.map(id => appBtn(id)).join('')}
        ${S.recent.length ? '<span class="dock-sep"></span>' + S.recent.map(id => appBtn(id, true)).join('') : ''}
        <button class="dbtn app-ic t-more ${S.launcher ? 'on' : ''}" data-act="launcher" title="全部应用"><span class="tile">${I('dots', 30)}</span></button>
      </div>
      <div class="dock-group">
        <div class="temp"><button class="arrow" data-vol="-1">${I('chevL', 30)}</button><button class="dbtn" data-act="mute" style="min-width:60px">${I(S.muted || S.volume === 0 ? 'volMute' : 'vol', 38)}</button><button class="arrow" data-vol="1">${I('chevR', 30)}</button></div>
      </div>`;
  }
  $('#dock').addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.temp) { setTemp(t.dataset.temp, +t.dataset.d); return; }
    if (t.dataset.seat) { cycleSeat(t.dataset.seat); return; }
    if (t.dataset.vol) { setVolume(S.volume + +t.dataset.vol); return; }
    if (t.dataset.app) { openApp(t.dataset.app); return; }
    const a = t.dataset.act;
    if (a === 'controls') { Sound.play('tap'); toggleSheet({ type: 'controls' }); }
    if (a === 'climate') { Sound.play('tap'); if (!S.climate.on) { S.climate.on = true; } toggleSheet({ type: 'climate' }); }
    if (a === 'launcher') { Sound.play('tap'); S.launcher = !S.launcher; commit('dock', 'launcher'); }
    if (a === 'mute') { S.muted = !S.muted; applyVolume(); Sound.play('tap'); }
  });

  function setTemp(side, d) {
    const c = S.climate;
    if (!c.on) c.on = true;
    const clamp = v => Math.max(15, Math.min(28, v));
    if (side === 'L' || c.sync) c.left = clamp(c.left + d);
    if (side === 'R' || c.sync) c.right = clamp(c.right + d);
    if (side === 'R' && c.sync && d) { c.sync = false; c.right = clamp(c.right); c.left = clamp(c.left - d); }
    Sound.play('tap'); commit('dock', 'sheet', 'cp');
  }
  function cycleSeat(side) {
    const k = side === 'L' ? 'seatL' : 'seatR';
    S.climate[k] = (S.climate[k] + 3) % 4; // 3 → 2 → 1 → 0 → 3（与 Tesla 一致，从最高档开始）
    Sound.play('tap'); commit('dock', 'sheet', 'cp');
  }
  let volT;
  function setVolume(v) {
    S.volume = Math.max(0, Math.min(10, v)); S.muted = false;
    applyVolume(); Sound.play('tap');
    const h = $('#volHud');
    h.innerHTML = `${I(S.volume ? 'vol' : 'volMute', 28)}<div class="bar"><i style="width:${S.volume * 10}%"></i></div><b>${S.volume}</b>`;
    h.classList.add('show'); clearTimeout(volT); volT = setTimeout(() => h.classList.remove('show'), 1500);
  }
  function applyVolume() {
    const v = S.muted ? 0 : (S.volume / 10) ** 2 * 0.7;
    Sound.setMusicVolume(v); NEA.volume = S.muted ? 0 : Math.min(1, (S.volume / 10) ** 2 * 0.9); commit('dock', 'cp');
  }

  // ------------------------------------------------------------------ 媒体
  function playTrack(i) {
    if (NE.live) { NEA.pause(); NE.live = false; NE.playing = false; }
    S.media.idx = (i + TRACKS.length) % TRACKS.length; S.media.pos = 0; S.media.playing = true;
    Sound.music.start(TRACKS[S.media.idx]); applyVolume(); commit('mini', 'sheet', 'cp');
  }
  function togglePlay() {
    if (neActive()) return neCtl('play');
    S.media.playing = !S.media.playing;
    if (S.media.playing) { Sound.music.start(TRACKS[S.media.idx]); applyVolume(); } else Sound.music.stop();
    commit('mini', 'sheet', 'cp');
  }
  function nextTrack() { if (neActive()) return neCtl('next'); playTrack(S.media.idx + 1); }
  function prevTrack() { if (neActive()) return neCtl('prev'); if (S.media.pos > 5) { S.media.pos = 0; commit('mini'); } else playTrack(S.media.idx - 1); }
  function toggleFav() {
    const f = S.media.fav, i = f.indexOf(S.media.idx);
    if (i >= 0) f.splice(i, 1); else f.push(S.media.idx);
    Sound.play('tap'); commit('mini', 'sheet', 'cp');
  }
  function renderMini() {
    const m = S.media, tr = TRACKS[m.idx];
    const el = $('#miniPlayer');
    el.classList.toggle('hidden', !!(S.sheet && S.sheet.type !== 'climate') || S.nav.mode === 'search');
    const ne = neActive() ? NE.queue[NE.i] : null;
    el.innerHTML = `${ne ? `<div class="art" style="background:#2a2d31 url('${esc(neCover(ne.cover))}') center/cover"></div>` : art(m.idx)}
      <div class="mp-info" data-act="expand"><b>${ne ? esc(ne.name) : tr.t}</b><span>${ne ? esc(ne.artist) : tr.a}</span><small>${ne ? '网易云' : m.src} · ${(ne ? NE.playing : m.playing) ? '正在播放' : '已暂停'}</small></div>
      <div class="mp-ctrls">
        <button data-act="prev">${I('prev', 28)}</button>
        <button data-act="play">${I((ne ? NE.playing : m.playing) ? 'pause' : 'play', 32)}</button>
        <button data-act="next">${I('next', 28)}</button>
        <button data-act="fav" class="fav ${m.fav.includes(m.idx) ? 'on' : ''}">${I('heart', 28)}</button>
      </div>
      <div class="mp-progress"><i></i></div>`;
    renderMiniProgress();
  }
  function renderMiniProgress() {
    if (neActive()) return neProgress();
    const w = (S.media.pos / TRACKS[S.media.idx].dur * 100) + '%';
    $$('#miniPlayer .mp-progress i, #widgets .w-prog i').forEach(i => { i.style.width = w; });
  }
  $('#miniPlayer').addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); const art_ = e.target.closest('.art');
    if (art_) return openApp('media');
    if (!a) return;
    ({ play: togglePlay, next: nextTrack, prev: prevTrack, fav: toggleFav, expand: () => openApp('media') })[a.dataset.act]();
  });

  // ------------------------------------------------------------------ 车辆区小组件（新版 UI：左右滑动的卡片）
  const widgets = $('#widgets');
  let wIdx = 0;
  const W_COUNT = 3;
  function renderWidgets() {
    const m = S.media, tr = TRACKS[m.idx], t = S.trip, np = nowInfo();
    const mins = Math.round(t.sec / 60), whkm = t.km > 0.05 ? 138 + Math.round(S.speed / 4) : 0;
    const odo = Math.round(S.odometer + t.km).toLocaleString();
    const tire = (cls, v) => `<span class="tp ${cls}">${v}<small>bar</small></span>`;
    widgets.innerHTML = `<div class="w-track" style="transform:translateX(${-wIdx * 100}%)">
      <div class="w-card w-media">
        <div class="w-head">${np.art()}<div class="w-mi" data-wact="open"><b>${esc(np.t)}</b><span>${I('vol', 18)}${esc(np.a)}</span></div>
          <button data-wact="shuffle" class="w-small">${I('shuffle', 28)}</button><button data-wact="repeat" class="w-small">${I('repeat', 28)}</button></div>
        <div class="w-prog"><i style="width:${np.pos / np.dur * 100}%"></i></div>
        <div class="w-ctrls">
          <button data-wact="prev">${I('prev', 30)}</button>
          <button data-wact="play" class="main">${I(np.playing ? 'pause' : 'play', 34)}</button>
          <button data-wact="next">${I('next', 30)}</button>
          <button data-wact="fav" class="${m.fav.includes(m.idx) ? 'on' : ''}">${I('heart', 28)}</button>
          <button data-wact="open">${I('sliders', 28)}</button>
          <button data-wact="open">${I('search', 28)}</button>
        </div>
      </div>
      <div class="w-card w-trip">
        <div><h4>本次行程</h4><p><b>${t.km.toFixed(1)}</b> km</p><p><b>${mins}</b> 分钟</p><p><b>${whkm || '--'}</b> Wh/km</p></div>
        <div><h4>自上次充电</h4><p><b>${(62.4 + t.km).toFixed(1)}</b> km</p><p><b>${(9.1 + t.km * 0.14).toFixed(1)}</b> kWh</p><p><b>146</b> Wh/km</p></div>
        <div><h4>总里程</h4><p><b>${odo}</b> km</p><p><b>1,874</b> kWh</p><p><b>141</b> Wh/km</p></div>
      </div>
      <div class="w-card w-tires">
        <div class="w-tl"><h4>胎压</h4><p>推荐冷胎压</p><p>前 <b>2.9 bar</b></p><p>后 <b>2.9 bar</b></p></div>
        <div class="w-tcar">${I('carTop', 150)}${tire('fl', '2.9')}${tire('fr', '3.0')}${tire('rl', '3.0')}${tire('rr', '3.0')}</div>
      </div>
    </div>
    <div class="w-dots">${Array.from({ length: W_COUNT }, (_, i) => `<button data-wdot="${i}" class="${i === wIdx ? 'on' : ''}"></button>`).join('')}</div>`;
  }
  function swipeWidgets(i) {
    wIdx = Math.max(0, Math.min(W_COUNT - 1, i));
    widgets.querySelector('.w-track').style.transform = `translateX(${-wIdx * 100}%)`;
    widgets.querySelectorAll('[data-wdot]').forEach((d, k) => d.classList.toggle('on', k === wIdx));
  }
  let wDown = null;
  widgets.addEventListener('pointerdown', e => { wDown = e.clientX; });
  widgets.addEventListener('pointerup', e => {
    if (wDown == null) return;
    const dx = e.clientX - wDown; wDown = null;
    if (Math.abs(dx) > 40) { swipeWidgets(wIdx + (dx < 0 ? 1 : -1)); Sound.play('tap'); }
  });
  widgets.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) < 20) return;
    e.preventDefault(); clearTimeout(widgets._t);
    widgets._t = setTimeout(() => swipeWidgets(wIdx + (e.deltaX > 0 ? 1 : -1)), 40);
  }, { passive: false });
  widgets.addEventListener('click', e => {
    const d = e.target.closest('[data-wdot]'); if (d) return swipeWidgets(+d.dataset.wdot);
    const a = e.target.closest('[data-wact]'); if (!a) return;
    const toggle = () => { a.classList.toggle('on'); Sound.play('tap'); };
    ({ play: togglePlay, next: nextTrack, prev: prevTrack, fav: toggleFav, open: () => openApp('media'), shuffle: toggle, repeat: toggle })[a.dataset.wact]();
  });
  setInterval(() => { if (S.gear !== 'P' || wIdx === 1) renderWidgets(); }, 5000);

  // 展开 / 收起车辆视图：展开后车辆铺满屏幕，可以拖动旋转查看
  function setExpanded(on) {
    if (on && S.gear !== 'P') return;
    if (on === S.carExpanded) return;
    S.carExpanded = on;
    teslaEl.classList.add('split-anim'); clearTimeout(setExpanded.t);
    setExpanded.t = setTimeout(() => teslaEl.classList.remove('split-anim'), 650);
    teslaEl.classList.toggle('car-expanded', on);
    if (car) { car.setExpanded(on); car.setViewShift(on ? 60 : 90); }
    MapCtl.moveTo(on ? $('#miniMap') : $('#teslaMapHost'), on ? -2 : 2); // 展开后地图缩到右上角（看大一点范围），点它再展开
    Sound.play('tap'); renderExpandBtn();
  }
  function renderExpandBtn() {
    const b = $('#carExpand');
    b.title = S.carExpanded ? '收起车辆视图 (Esc)' : '展开车辆视图';
    b.innerHTML = `<svg class="ic" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${S.carExpanded ? '<path d="M15 6l-6 6 6 6"/>' : '<path d="M9 6l6 6-6 6"/>'}</svg>`;
  }
  $('#carExpand').addEventListener('click', () => setExpanded(!S.carExpanded));
  $('#miniMap').addEventListener('click', () => setExpanded(false));
  // 展开视图下方的导航卡片：点击后收起车辆视图再进入导航
  $('#expNav').innerHTML = `<button class="en-search" data-en="search">${I('search', 28)}<span>导航</span></button>
    <div class="nav-quick"><button data-en="0">${I('home', 26)}家</button><i></i><button data-en="1">${I('work', 26)}公司</button></div>`;
  $('#expNav').addEventListener('click', e => {
    const b = e.target.closest('[data-en]'); if (!b) return;
    setExpanded(false);
    if (b.dataset.en === 'search') setTimeout(() => $('#navInput').focus(), 450);
    else navigateTo(MapCtl.PLACES[+b.dataset.en]);
  });

  // 车辆区 / 地图之间的分隔条：拖动调整宽度
  const teslaEl = $('#tesla'), splitH = $('#splitHandle');
  function setSplit(px) {
    S.split = Math.round(Math.max(560, Math.min(1160, px)));
    teslaEl.style.setProperty('--split', S.split + 'px');
    MapCtl.resize();
  }
  setSplit(S.split);
  renderExpandBtn();
  splitH.addEventListener('pointerdown', e => { splitH.setPointerCapture(e.pointerId); splitH.classList.add('drag'); teslaEl.classList.add('dragging'); });
  splitH.addEventListener('pointermove', e => { if (splitH.classList.contains('drag')) setSplit(localXY(e, $('#stage'))[0]); });
  ['pointerup', 'pointercancel'].forEach(ev => splitH.addEventListener(ev, () => {
    if (!splitH.classList.contains('drag')) return;
    splitH.classList.remove('drag'); teslaEl.classList.remove('dragging'); store.set('split', S.split);
  }));
  splitH.addEventListener('dblclick', () => { setSplit(700); store.set('split', 700); });

  // ------------------------------------------------------------------ 导航
  const navBox = $('#navBox');
  navBox.innerHTML = `<div class="nav-main" id="navSearch"><div class="nav-search">${I('search', 30)}<input id="navInput" placeholder="导航" autocomplete="off">${I('mic', 28)}</div>
    <div class="nav-quick" id="navQuick"><button data-quick="0">${I('home', 26)}家</button><i></i><button data-quick="1">${I('work', 26)}公司</button><i></i><button data-quick="charge">${I('bolt', 26)}充电</button></div></div><div id="navDrop"></div><div id="navCard"></div>`;
  $('#navQuick').addEventListener('click', e => {
    const b = e.target.closest('[data-quick]'); if (!b) return;
    if (b.dataset.quick === 'charge') goCharge(); else navigateTo(MapCtl.PLACES[+b.dataset.quick]);
  });
  const navInput = $('#navInput');
  let searchT;
  navInput.addEventListener('focus', () => { if (S.nav.mode === 'idle') { S.nav.mode = 'search'; commit('nav', 'mini'); } });
  navInput.addEventListener('input', () => {
    S.nav.query = navInput.value; clearTimeout(searchT);
    searchT = setTimeout(async () => {
      const q = S.nav.query;
      S.nav.results = q ? await MapCtl.search(q) : [];
      if (q === S.nav.query) renderNavDrop();
    }, 350);
    renderNavDrop();
  });
  navInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && S.nav.results[0]) navigateTo(S.nav.results[0]);
    if (e.key === 'Escape') closeSearch();
  });
  function closeSearch() { S.nav.mode = 'idle'; S.nav.query = ''; navInput.value = ''; navInput.blur(); commit('nav', 'mini'); }
  document.addEventListener('pointerdown', e => {
    if (S.nav.mode === 'search' && !e.target.closest('#navBox')) closeSearch();
    if (S.launcher && !e.target.closest('#launcher') && !e.target.closest('[data-act="launcher"]')) { S.launcher = false; commit('dock', 'launcher'); }
    if (S.chargerCard && !e.target.closest('.charger-card') && !e.target.closest('.charger-pin')) { S.chargerCard = null; renderMapCtrls(); }
  });

  function placeRow(p) {
    return `<button class="place" data-place="${encodeURIComponent(JSON.stringify(p))}"><span class="pi">${I(p.icon || 'pin', 24)}</span><div><b>${p.name}</b><span>${p.addr || ''}</span></div><em>${p.km != null ? p.km.toFixed(1) + ' km' : ''}</em></button>`;
  }
  function renderNavDrop() {
    const n = S.nav, drop = $('#navDrop');
    if (n.mode !== 'search') { drop.innerHTML = ''; return; }
    let html = '';
    if (!n.query) {
      const pl = MapCtl.PLACES.map(p => ({ ...p, km: MapCtl.haversine(MapCtl.carLL, p.ll) / 1000 }));
      html = `<div class="chips"><button class="chip" data-quick="0">${I('home', 22)}家</button><button class="chip" data-quick="1">${I('work', 22)}公司</button><button class="chip" data-quick="chargers">${I('bolt', 22)}充电站</button><button class="chip" data-quick="food">${I('star', 22)}收藏</button></div>
        <div class="drop-title">最近</div>${pl.slice(2).map(placeRow).join('')}`;
    } else if (!n.results.length) {
      html = `<div class="loading">正在搜索“${n.query}”…</div>`;
    } else html = n.results.map(placeRow).join('');
    drop.innerHTML = `<div class="nav-drop">${html}</div>`;
  }
  $('#navDrop').addEventListener('click', e => {
    const p = e.target.closest('[data-place]');
    if (p) return navigateTo(JSON.parse(decodeURIComponent(p.dataset.place)));
    const q = e.target.closest('[data-quick]'); if (!q) return;
    const v = q.dataset.quick;
    if (v === 'chargers') { closeSearch(); S.chargersOn = true; MapCtl.setChargers(true, showCharger); commit('mapctrls'); }
    else if (v === 'food') toast('收藏夹中还没有地点');
    else navigateTo(MapCtl.PLACES[+v]);
  });

  async function navigateTo(place) {
    navInput.blur();
    S.nav = { ...S.nav, mode: 'loading', dest: place, query: '', results: [] };
    navInput.value = '';
    Sound.play('tap'); commit('nav', 'mini');
    const r = await MapCtl.route(place);
    if (S.nav.mode !== 'loading') return;
    S.nav.route = r; S.nav.d = 0; S.nav.mode = 'preview';
    MapCtl.showRoute(r);
    commit('nav', 'cp');
  }
  function startNav() {
    if (!S.nav.route) return;
    S.nav.mode = 'active'; S.nav.d = 0; freeRoute.route = null;
    MapCtl.setNav(true); MapCtl.recenter();
    Sound.play('nav');
    toast(S.gear === 'D' ? '开始导航' : '开始导航 · 挂入 D 档（或按 D）即可模拟驾驶', 'navArrow');
    commit('nav', 'cp', 'mapctrls');
  }
  function endNav() {
    S.nav = { mode: 'idle', query: '', results: [], route: null, d: 0 };
    MapCtl.clearRoute(); MapCtl.setNav(S.gear === 'D'); MapCtl.recenter();
    Sound.play('close'); commit('nav', 'cp', 'mapctrls', 'mini');
  }
  function arrive() {
    const dest = S.nav.route.dest, name = dest.name, charge = isCharger(dest);
    Sound.play('navArrive'); toast(`已到达 ${name}`, 'flag');
    endNav(); endPull(); S.nav.autoPark = true; S.nav.charge = charge; S.cruise = 0; if (S.ap) setAP(false, true);
  }
  const MAN = { left: '左转', right: '右转', 'slight left': '稍向左转', 'slight right': '稍向右转', 'sharp left': '向左急转', 'sharp right': '向右急转', straight: '直行', uturn: '掉头' };
  function manText(s) {
    if (s.type === 'arrive') return '到达目的地';
    if (s.type === 'depart') return '出发';
    if (s.type === 'roundabout' || s.type === 'rotary') return '进入环岛';
    if (s.type === 'fork') return s.mod.includes('left') ? '靠左行驶' : '靠右行驶';
    if (s.type === 'on ramp') return '驶入匝道';
    if (s.type === 'off ramp') return '驶出匝道';
    if (s.type === 'merge') return '汇入';
    return MAN[s.mod] || '继续行驶';
  }
  function manIcon(s) {
    if (s.type === 'arrive') return 'flag';
    if (s.type === 'roundabout' || s.type === 'rotary') return 'roundabout';
    return { left: 'turnL', 'sharp left': 'turnL', right: 'turnR', 'sharp right': 'turnR', 'slight left': 'slightL', 'slight right': 'slightR', uturn: 'uturn' }[s.mod] || 'straight';
  }
  function tripInfo() {
    const r = S.nav.route, remain = Math.max(0, r.total - S.nav.d);
    const secs = r.dur * remain / r.total;
    const eta = new Date(Date.now() + secs * 1000);
    const arriveBatt = Math.max(0, Math.round(S.battery - remain / 1000 * 0.14 / 75 * 100));
    return { remain, mins: Math.max(1, Math.round(secs / 60)), eta: clock(eta), batt: arriveBatt };
  }
  function nextStep() {
    const r = S.nav.route, d = S.nav.d;
    let i = r.steps.findIndex(s => s.start > d + 5);
    if (i < 0) i = r.steps.length - 1;
    return { step: r.steps[i], after: r.steps[i + 1], dist: r.steps[i].start - d };
  }
  const navHelpers = { manText, manIcon, tripInfo, nextStep };
  function renderTurn() {
    if (S.nav.mode !== 'active') return;
    const { step, after, dist } = nextStep(), t = tripInfo();
    const name = step.type === 'arrive' ? S.nav.route.dest.name : (step.name || '无名道路');
    S.limit = /高速|高架|快速|Expressway|Highway|G\d|S\d/.test(step.name) ? 80 : 60;
    $('#navCard').innerHTML = `<div class="turn-card">
      <div class="turn-main">${I(manIcon(step), 66)}<div><b>${fmtDist(dist)}</b><span>${manText(step)}${step.type === 'arrive' ? '' : ' · ' + name}</span></div></div>
      ${after ? `<div class="turn-next">${I(manIcon(after), 26)}<span>然后${manText(after)}${after.name ? ' · ' + after.name : ''}</span></div>` : ''}
      <div class="trip-sum"><div><b>${t.eta}</b>到达</div><div><b>${t.mins} 分钟</b>${fmtDist(t.remain)}</div><div><b>${t.batt}%</b>到达电量</div><button class="end" data-act="end" title="结束导航">${I('close', 26)}</button></div>
    </div>`;
    listeners.forEach(fn => fn(S, 'turn'));
  }
  function renderNav() {
    const n = S.nav;
    $('#navSearch').style.display = (n.mode === 'idle' || n.mode === 'search') ? '' : 'none';
    $('#navQuick').style.display = n.mode === 'idle' ? '' : 'none';
    renderNavDrop();
    const card = $('#navCard');
    if (n.mode === 'loading') card.innerHTML = `<div class="route-card"><div class="loading">正在规划前往“${n.dest.name}”的路线…</div></div>`;
    else if (n.mode === 'preview') {
      const r = n.route, t = { mins: Math.round(r.dur / 60), km: (r.total / 1000).toFixed(1) };
      const eta = clock(new Date(Date.now() + r.dur * 1000));
      const batt = Math.max(0, Math.round(S.battery - r.total / 1000 * 0.14 / 75 * 100));
      card.innerHTML = `<div class="route-card"><h3>${n.dest.name}</h3><div class="addr">${n.dest.addr || ''}</div>
        <div class="route-stats"><div><b>${t.mins} 分钟</b>${t.km} 公里</div><div><b>${eta}</b>预计到达</div><div><b class="${batt > 20 ? 'green' : ''}">${batt}%</b>到达电量</div></div>
        <div class="route-actions"><button class="btn primary" data-act="go">${I('navArrow', 24)}开始导航</button><button class="btn" data-act="cancel">取消</button></div></div>`;
    } else if (n.mode === 'active') renderTurn();
    else card.innerHTML = '';
  }
  $('#navCard').addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'go') startNav();
    if (a.dataset.act === 'cancel' || a.dataset.act === 'end') endNav();
  });

  // ------------------------------------------------------------------ 地图按钮
  function showCharger(c) {
    S.chargerCard = c; Sound.play('tap'); renderMapCtrls();
  }
  function renderMapCtrls() {
    $('#mapCtrls').innerHTML = `
      <button class="mbtn" data-act="north" title="地图朝向">${I(MapCtl.northUp ? 'compass' : 'navArrow', 30)}</button>
      <button class="mbtn ${S.chargersOn ? 'on' : ''}" data-act="chargers" title="充电站">${I('bolt', 30)}</button>
      <button class="mbtn ${S.trafficOn ? 'on' : ''}" data-act="traffic" title="路况">${I('traffic', 30)}</button>
      ${S.nav.mode === 'active' ? `<button class="mbtn" data-act="overview" title="路线全览">${I('route', 30)}</button>` : ''}
      ${MapCtl.follow ? '' : `<button class="mbtn" data-act="recenter" title="回到车辆位置">${I('locate', 30)}</button>`}`;
    $('#zoomCtrls').innerHTML = `<button class="mbtn" data-act="zin">${I('plus', 28)}</button><button class="mbtn" data-act="zout">${I('minus', 28)}</button>`;
    const old = $('#mappane .charger-card'); if (old) old.remove();
    if (S.chargerCard) {
      const c = S.chargerCard, el = document.createElement('div'); el.className = 'charger-card';
      el.innerHTML = `<h4>${c.name}</h4><p>${c.free}/${c.total} 个充电桩可用 · 最高 ${c.kw} kW · ${(MapCtl.haversine(MapCtl.carLL, c.ll) / 1000).toFixed(1)} km</p><div class="route-actions"><button class="btn primary" data-act="navcharger">${I('navArrow', 22)}导航</button></div>`;
      el.querySelector('button').onclick = () => { S.chargerCard = null; navigateTo({ name: c.name, addr: `${c.kw} kW 超级充电`, ll: c.ll, icon: 'bolt' }); renderMapCtrls(); };
      $('#mappane').appendChild(el);
    }
  }
  $('#mappane').addEventListener('click', e => {
    const a = e.target.closest('.map-ctrls [data-act], .zoom-ctrls [data-act]'); if (!a) return;
    Sound.play('tap');
    const k = a.dataset.act;
    if (k === 'north') { const n = MapCtl.toggleNorth(); toast(n ? '地图：北向朝上' : '地图：车头朝上', 'compass'); }
    if (k === 'chargers') { S.chargersOn = !S.chargersOn; MapCtl.setChargers(S.chargersOn, showCharger); }
    if (k === 'traffic') { S.trafficOn = !S.trafficOn; toast(S.trafficOn ? '已显示实时路况（模拟）' : '已隐藏路况', 'traffic'); }
    if (k === 'overview') MapCtl.fitRoute(S.nav.route);
    if (k === 'recenter') MapCtl.recenter();
    if (k === 'zin') MapCtl.zoom(1);
    if (k === 'zout') MapCtl.zoom(-1);
    setTimeout(renderMapCtrls, 50);
  });

  // ------------------------------------------------------------------ 抽屉面板
  const sheet = $('#sheet');
  function toggleSheet(sh) {
    const same = S.sheet && S.sheet.type === sh.type && S.sheet.app === sh.app;
    S.sheet = same ? null : sh; S.launcher = false;
    if (sh.type === 'controls' && sh.sec) S.ctlSec = sh.sec;
    commit('sheet', 'dock', 'launcher', 'mini');
  }
  function closeSheet() { if (!S.sheet) return; S.sheet = null; Sound.play('tap'); commit('sheet', 'dock', 'mini'); }
  function openApp(id) {
    S.launcher = false;
    if (id === 'charge') return toggleSheet({ type: 'controls', sec: 'charging' });
    if (!S.dockApps.includes(id)) { S.recent = [id, ...S.recent.filter(x => x !== id)].slice(0, 2); }
    Sound.play('tap');
    toggleSheet({ type: 'app', app: id });
  }

  let lastSheetKey = '';
  function renderSheet() {
    const sh = S.sheet;
    sheet.classList.toggle('open', !!sh);
    if (!sh) { lastSheetKey = ''; if (neHost) neHost.classList.remove('show'); return; }
    sheet.className = 'sheet open ' + (sh.type === 'climate' ? 'half' : sh.type === 'app' ? 'tall' : '');
    const key = sh.type + (sh.app || '') + (sh.sub || '');
    const keepScroll = key === lastSheetKey ? (sheet.querySelector('.ctl-main, .app-wrap, .media-list') || {}).scrollTop : 0;
    lastSheetKey = key;
    // 素描板 / 相机等有画布的视图不要重复渲染
    if (sheet.dataset.static === key) return;
    sheet.dataset.static = '';
    let html = `<div class="sheet-handle"></div><button class="sheet-close" data-close>${I('close', 30)}</button>`;
    if (sh.type === 'controls') html += controlsHTML();
    else if (sh.type === 'climate') html += climateHTML();
    else html += appHTML(sh.app, sh.sub);
    sheet.innerHTML = html;
    const sc = sheet.querySelector('.ctl-main, .app-wrap, .media-list'); if (sc && keepScroll) sc.scrollTop = keepScroll;
    afterSheet(sh, key);
  }

  // —— 通用控件
  const seg = (key, opts, wide) => `<div class="seg ${wide ? 'wide' : ''}">${opts.map(o => `<button class="${S[key] === o ? 'on' : ''}" data-seg="${key}" data-v="${o}">${o}</button>`).join('')}</div>`;
  const sw = (key, label, desc) => `<div class="row"><div class="lbl">${label}${desc ? `<span>${desc}</span>` : ''}</div><button class="switch ${S[key] ? 'on' : ''}" data-sw="${key}"></button></div>`;
  const segRow = (key, label, opts, desc) => `<div class="row"><div class="lbl">${label}${desc ? `<span>${desc}</span>` : ''}</div>${seg(key, opts)}</div>`;
  const tile = (key, label, ic, alert) => `<button class="tile ${alert ? 'alert' : ''} ${S[key] ? 'on' : ''}" data-tile="${key}">${I(ic, 38)}<span>${label}</span></button>`;
  const range = (key, label, min, max, unit = '') => `<div class="row" style="display:block"><div class="lbl" style="display:flex;justify-content:space-between">${label}<b data-out="${key}">${S[key]}${unit}</b></div><input class="slider" type="range" min="${min}" max="${max}" value="${S[key]}" data-range="${key}" data-unit="${unit}" style="--p:${(S[key] - min) / (max - min) * 100}%;margin-top:18px"></div>`;
  const bodySvg = t => {
    const p = Car3D.PROFILES[t]; const pts = [...p.front, ...p.top, ...p.rear];
    const gl = p.glass;
    const sx = x => 55 + x * 21, sy = y => 34 - y * 17;
    return `<svg viewBox="0 0 110 34"><path d="M${pts.map(([x, y]) => `${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join(' L')} Z" fill="currentColor" opacity=".85"/><path d="M${gl.map(([x, y]) => `${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join(' L')} Z" fill="currentColor" opacity=".5"/><circle cx="${sx(p.wheelX)}" cy="${sy(p.wr)}" r="${p.wr * 17}" fill="currentColor"/><circle cx="${sx(-p.wheelX)}" cy="${sy(p.wr)}" r="${p.wr * 17}" fill="currentColor"/></svg>`;
  };

  function controlsHTML() {
    const f = S.ctlFilter.trim();
    const secs = SECTIONS.filter(s => !f || s[1].includes(f) || I18N.t(s[1]).toLowerCase().includes(f.toLowerCase()));
    return `<div class="sheet-body">
      <nav class="ctl-nav">
        <label class="ctl-search">${I('search', 24)}<input data-filter placeholder="搜索设置" value="${f}"></label>
        ${secs.map(([id, n, ic]) => `<button class="${S.ctlSec === id ? 'on' : ''}" data-sec="${id}">${I(ic, 28)}${n}</button>`).join('')}
      </nav>
      <div class="ctl-main">
        <div class="ctl-head"><h3>${SECTIONS.find(s => s[0] === S.ctlSec)[1]}</h3><div class="icons">${I('user', 26)}${escH(S.owner)} ${I('download', 26)} ${I('bell', 26)} ${I('bt', 26)}</div></div>
        ${SEC[S.ctlSec]()}
      </div></div>`;
  }

  const SEC = {
    quick: () => `
      <div class="tiles">
        ${tile('frunk', S.frunk ? '关闭前备箱' : '打开前备箱', 'frunk')}${tile('trunk', S.trunk ? '关闭后备箱' : '打开后备箱', 'trunk')}
        ${tile('locked', S.locked ? '已锁定' : '锁车', S.locked ? 'lock' : 'unlock')}${tile('port', '充电口', 'chargePort')}
        ${tile('folded', '折叠后视镜', 'mirror')}${tile('childLock', '儿童锁', 'child')}${tile('windowLock', '车窗锁', 'window')}${tile('glovebox', '手套箱', 'glovebox')}
      </div>
      <div class="sec-title">头灯</div>${headSeg()}
      <div class="sec-title">雨刷</div>${seg('wipers', ['关闭', '自动', '1', '2', '3', '4'], true)}
      <div class="sec-title">调节</div>
      <div class="tiles"><button class="tile alert ${S.hazard ? 'on' : ''}" data-act="hazard">${I('hazard', 38)}<span>双闪</span></button><button class="tile" data-act="horn">${I('horn', 38)}<span>鸣笛</span></button><button class="tile" data-act="adjust-wheel">${I('wheel', 38)}<span>方向盘</span></button><button class="tile" data-act="adjust-mirror">${I('mirror', 38)}<span>后视镜</span></button><button class="tile" data-act="clean">${I('sparkle', 38)}<span>屏幕清洁</span></button><button class="tile" data-act="wash">${I('snow', 38)}<span>洗车模式</span></button></div>
      ${range('brightness', '屏幕亮度', 10, 100, '%')}`,
    vehicle: () => `
      <div class="sec-title">车身类型 · 让任何车都拥有这套车机</div>
      <div class="body-pick">${Object.entries(Car3D.PROFILES).filter(([k]) => !HIDDEN_BODIES.includes(k)).map(([k, p]) => `<button class="${S.body === k ? 'on' : ''}" data-body="${k}">${bodySvg(k)}${p.label}</button>`).join('')}</div>
      <div class="sec-title">车漆</div>
      <div class="swatches">${PAINTS.map(([n, c]) => `<button class="swatch ${S.paint === c ? 'on' : ''}" data-paint="${c}" title="${n}" style="background:${c}"></button>`).join('')}</div>
      <div class="sec-title">车衣</div>
      ${segRow('finish', '质感', ['原厂漆', '亮面', '哑光', '缎面', '电镀', '炫彩'])}
      <div class="swatches" style="margin-top:14px">${WRAPS.map(([n, c]) => `<button class="swatch ${S.paint === c ? 'on' : ''}" data-paint="${c}" title="${n}" style="background:${c}"></button>`).join('')}
        <label class="swatch custom ${[...PAINTS, ...WRAPS].some(([, c]) => c === S.paint) ? '' : 'on'}" title="自定义颜色" style="background:${S.paint}"><input type="color" data-wrapcolor value="${S.paint}"></label></div>
      <p class="note">${[...PAINTS, ...WRAPS].find(([, c]) => c === S.paint)?.[0] || '自定义 ' + S.paint} · ${S.finish}</p>
      ${segRow('tail', '尾灯', ['原厂', '熏黑', '亮红'])}
      <div class="row" style="margin-top:20px"><div class="lbl">车辆名称<span>显示在车辆画面与 CarPlay 车辆页</span></div><input class="text-in" data-name value="${escH(S.carName)}" maxlength="16"></div>
      <div class="row" style="margin-top:20px"><div class="lbl">车主名称<span>显示在顶部状态栏与控制页右上角</span></div><input class="text-in" data-owner value="${escH(S.owner)}" maxlength="16"></div>
      ${segRow('skin', '界面风格', ['tesla', 'carplay']).replace('>tesla<', '>Tesla<').replace('>carplay<', '>CarPlay<')}
      <p class="note">Model 3 与 Cybertruck 使用真实 3D 车模（Model 3：“Tesla Model 3 (Realistic Graphics)” by ChoochooLi / “Tesla White car.” by aarajesh，CC BY 4.0；Cybertruck：“Tesla Cybertruck 2025” by Nieve5677，CC BY 4.0，本地改动版；详见 models/CREDITS.md）。其余车身（含 SUV）为程序化生成；真实模型缺失或加载失败时也会退回程序化车身（js/car3d.js 中的 PROFILES）。</p>`,
    lights: () => `
      <div class="sec-title">头灯</div>${headSeg()}
      ${sw('fog', '雾灯', '前雾灯')}${sw('autoHigh', '自适应远光', '检测到对向来车时自动切换近光')}
      ${segRow('hlDelay', '下车后头灯延时', ['关闭', '15 秒', '1 分钟', '2 分钟'])}
      ${sw('ambient', '氛围灯', '中控台与车门氛围灯带')}
      <div class="swatches" style="margin-top:6px">${['#3e6ae1', '#18a957', '#e31937', '#f5a524', '#af52de', '#ffffff'].map(c => `<button class="swatch ${S.ambientColor === c ? 'on' : ''}" data-amb="${c}" style="background:${c};width:52px;height:52px"></button>`).join('')}</div>
      <div class="sec-title">灯光秀</div><button class="btn" data-act="lightshow">${I('sparkle', 24)}播放灯光秀</button>`,
    locks: () => `
      ${sw('locked', '车门锁', S.locked ? '所有车门已锁定' : '所有车门已解锁')}
      ${sw('walkLock', '离车自动上锁', '携带手机钥匙离开车辆后自动上锁')}
      ${sw('parkUnlock', '挂入 P 档时解锁')}
      ${sw('lockSound', '锁车提示音')}
      ${segRow('childSide', '儿童锁', ['关闭', '左侧', '右侧', '双侧'])}
      ${sw('windowLock', '车窗锁', '禁用后排车窗开关')}`,
    display: () => `
      <div class="row"><div class="lbl">外观<span>“自动”会在日落后切换为深色</span></div><div class="seg">${[['light', '浅色'], ['dark', '深色'], ['auto', '自动']].map(([v, n]) => `<button class="${S.themePref === v ? 'on' : ''}" data-theme="${v}">${n}</button>`).join('')}</div></div>
      <div class="row"><div class="lbl">界面风格<span>在 Tesla 与 Apple CarPlay 风格之间切换</span></div><div class="seg">${[['tesla', 'Tesla'], ['carplay', 'CarPlay']].map(([v, n]) => `<button class="${S.skin === v ? 'on' : ''}" data-skin="${v}">${n}</button>`).join('')}</div></div>
      ${range('brightness', '亮度', 10, 100, '%')}
      ${segRow('timeFmt', '时间格式', ['12 小时', '24 小时'])}
      ${segRow('energyFmt', '能耗显示', ['百分比', '里程'])}
      <div class="row"><div class="lbl">屏幕清洁模式<span>暂时关闭触摸屏以便擦拭</span></div><button class="btn" data-act="clean">开始</button></div>`,
    drive: () => `
      ${segRow('accel', '加速模式', ['舒适', '标准', '狂暴'])}
      ${segRow('steering', '转向模式', ['舒适', '标准', '运动'])}
      ${segRow('stopMode', '停车模式', ['蠕行', '溜车', '保持'], '“保持”：松开电门后车辆完全停止并保持')}
      ${segRow('regen', '能量回收', ['低', '标准'])}
      ${sw('traction', '牵引力控制')}
      <p class="note">驾驶模拟：按 <b>D</b> 挂入前进档，<b>A</b> 启用自动辅助驾驶，<b>↑ ↓</b> 调整巡航速度（当前 ${S.cruise} km/h）。</p>`,
    autopilot: () => `
      ${segRow('apMode', '自动辅助驾驶功能', ['交通感知巡航', '自动转向'])}
      ${sw('fsd', '完全自动驾驶能力（模拟）', '在导航路线上自动变道、驶入驶出匝道')}
      ${sw('autoLane', '自动变道', '前方车辆较慢时自动超车并返回原车道，遇障碍优先变道避让（需“自动转向”）')}
      ${segRow('offset', '设定速度偏移', ['+0 km/h', '+5 km/h', '+10%'])}
      <div class="row"><div class="lbl">跟车距离<span>1 = 最近，7 = 最远</span></div><div class="seg">${[1, 2, 3, 4, 5, 6, 7].map(v => `<button style="min-width:60px" class="${S.followDist === v ? 'on' : ''}" data-num="followDist" data-v="${v}">${v}</button>`).join('')}</div></div>
      ${sw('blindCam', '自动显示盲区摄像头', '打转向灯时显示侧后方画面')}
      ${segRow('laneWarn', '车道偏离预警', ['关闭', '警告', '辅助'])}
      ${segRow('fcw', '前方碰撞预警', ['关闭', '晚', '中', '早'])}`,
    charging: () => `
      <div class="charge-bar"><i class="${S.charging ? 'striped' : ''}" style="width:${S.battery}%"></i><span class="limit-mark" style="left:${S.chargeLimit}%"></span><b>${Math.round(S.battery)}%</b></div>
      <div class="kv"><div>预估续航<b>${rangeKm()} km</b></div><div>${S.charging ? '充电中 · 剩余时间' : '充电状态'}<b>${S.charging ? Math.max(1, Math.round((S.chargeLimit - S.battery) / 0.35 / 60 * 10)) + ' 分钟' : (S.port ? '充电口已打开' : '未连接')}</b></div></div>
      <div class="route-actions" style="margin:20px 0">
        <button class="btn ${S.charging ? 'danger' : 'primary'}" data-act="charge">${I('bolt', 24)}${S.charging ? '停止充电' : '开始充电'}</button>
        <button class="btn" data-tile="port">${I('chargePort', 24)}${S.port ? '关闭充电口' : '打开充电口'}</button>
      </div>
      ${range('chargeLimit', '充电上限', 50, 100, '%')}
      ${segRow('energyMul', '能耗（演示）', ['真实', '×10', '×30'], '按真实能耗计算再乘以倍率，倍率越大电量下降越快')}
      <div class="row"><div class="lbl">最近的充电站<span>${(() => { const c = nearestChargers(1)[0]; return c ? `${c.name} · ${c.km.toFixed(1)} km` : '—'; })()}</span></div><button class="btn" data-act="go-charge">导航前往</button></div>
      <div class="row"><div class="lbl">充电电流</div><div class="temp"><button class="arrow" data-amps="-1">${I('chevL', 28)}</button><b style="min-width:90px;text-align:center;font-size:26px">${S.chargeAmps} A</b><button class="arrow" data-amps="1">${I('chevR', 28)}</button></div></div>
      ${sw('scheduled', '预约充电', '在谷电时段（23:00）开始充电')}`,
    trips: () => `
      <div class="sec-title">自上次充电</div>
      <div class="kv"><div>行驶里程<b>${(S.odometer - 12780).toFixed(1)} km</b></div><div>能耗<b>9.2 kWh</b></div><div>平均能耗<b>143 Wh/km</b></div><div>行驶时间<b>1 小时 24 分</b></div></div>
      <div class="sec-title">总里程</div><div class="kv"><div>里程表<b>${Math.floor(S.odometer).toLocaleString()} km</b></div><div>行程 A<b>326.4 km</b></div></div>
      <div style="margin-top:20px"><button class="btn" data-act="reset-trip">重置行程 A</button></div>`,
    nav: () => `
      ${segRow('mapMode', '地图', ['模拟地图', '真实地图'], '模拟地图：无限生成的城市，与驾驶画面同步；真实地图：OpenStreetMap')}
      ${range('navVol', '导航音量', 0, 10)}
      ${sw('autoNav', '自动导航', '根据日历自动设置目的地')}
      ${sw('avoidHwy', '避开高速公路')}
      ${sw('trafficOn', '显示实时路况')}
      ${sw('chargersOn', '在地图上显示充电站')}
      <div class="row"><div class="lbl">家<span>${MapCtl.PLACES[0].addr}</span></div><button class="btn" data-act="go-home">导航回家</button></div>`,
    safety: () => `
      ${sw('sentry', '哨兵模式', '车辆锁定后使用摄像头监控周围环境')}
      ${segRow('overspeed', '超速提醒', ['关闭', '显示', '提示音'])}
      ${segRow('fcw', '前方碰撞预警', ['关闭', '晚', '中', '早'])}
      ${sw('pinDrive', 'PIN 码驾驶', '需要输入 4 位 PIN 码才能驾驶')}
      <div class="row"><div class="lbl">宠物模式 / 露营模式<span>在空调面板中开启</span></div><button class="btn" data-act="open-climate">打开空调</button></div>`,
    service: () => `
      <div class="sec-title">胎压</div>
      <div style="display:flex;justify-content:center;padding:10px 0 20px">
        <svg viewBox="0 0 360 420" width="300" style="color:var(--sub)"><rect x="100" y="30" width="160" height="360" rx="70" fill="none" stroke="currentColor" stroke-width="3"/><path d="M118 140 Q180 110 242 140 M118 290 Q180 320 242 290" fill="none" stroke="currentColor" stroke-width="2"/>
        ${[[60, 110, '2.9'], [300, 110, '2.9'], [60, 310, '3.0'], [300, 310, '2.9']].map(([x, y, v]) => `<rect x="${x - 18}" y="${y - 40}" width="36" height="80" rx="10" fill="var(--panel3)"/><text x="${x < 180 ? x - 30 : x + 30}" y="${y + 8}" text-anchor="${x < 180 ? 'end' : 'start'}" font-size="26" font-weight="600" fill="var(--text)">${v}</text><text x="${x < 180 ? x - 30 : x + 30}" y="${y + 34}" text-anchor="${x < 180 ? 'end' : 'start'}" font-size="16" fill="var(--muted)">bar</text>`).join('')}</svg>
      </div>
      <div class="row"><div class="lbl">洗车模式<span>关闭车窗、锁定充电口、关闭雨刷</span></div><button class="btn" data-act="wash">开启</button></div>
      <div class="row"><div class="lbl">预约服务</div><button class="btn" data-act="service">预约</button></div>`,
    software: () => `
      <div class="version">v2026.38.4</div><div class="note">DriveOS · 车辆已是最新版本</div>
      ${segRow('updatePref', '软件更新偏好', ['标准', '高级'], '“高级”将更早收到新功能')}
      <div class="sec-title">版本说明</div>
      <div class="note">· 全新程序化 3D 车辆，支持轿车 / SUV / 掀背 / 皮卡<br>· 实时矢量地图与路线规划（OpenStreetMap 数据）<br>· 驾驶可视化：车道线、周围车辆与 Autopilot 路径<br>· Apple CarPlay 风格界面（显示 › 界面风格）<br>· 全合成车机音效与生成式音乐</div>
      <div class="row" style="margin-top:12px"><div class="lbl">车辆识别号</div><span class="note">LRW3E7EK0SC000000</span></div>`,
  };
  function headSeg() {
    return `<div class="seg wide">${[['off', '关闭'], ['park', '驻车灯'], ['on', '开启'], ['auto', '自动']].map(([v, n]) => `<button class="${S.headlights === v ? 'on' : ''}" data-seg="headlights" data-v="${v}">${n}</button>`).join('')}</div>`;
  }
  // —— 空调
  function climateHTML() {
    const c = S.climate;
    const t = v => c.on ? (v <= 15 ? 'LO' : v >= 28 ? 'HI' : v.toFixed(1) + '°') : '关闭';
    const flows = side => {
      const [fx, fy] = side === 'L' ? c.focusL : c.focusR;
      const base = side === 'L' ? [150, 330] : [470, 650];
      const n = Math.max(2, Math.min(7, c.fan));
      let p = '';
      for (let i = 0; i < n; i++) {
        const sx = base[0] + (base[1] - base[0]) * (i / (n - 1));
        const spread = (i - (n - 1) / 2) * 16;
        p += `<path class="flow" style="animation-duration:${2.4 - c.fan * 0.18}s" d="M${sx} 380 C ${sx} 290, ${fx + spread} ${fy + 120}, ${fx + spread * 1.6} ${fy}"/>`;
      }
      return p;
    };
    const modeBtn = (m, ic, n) => `<button class="cl-btn ${c.mode === m ? 'on' : ''}" data-cl-mode="${m}">${I(ic, 30)}${n}</button>`;
    const heat = (k, ic, n) => `<button class="cl-btn heat ${c[k] ? 'on' : ''}" data-cl-seat="${k}">${I(ic, 30)}${n}${typeof c[k] === 'number' && c[k] ? ' ' + c[k] : ''}</button>`;
    return `<div class="sheet-title">空调 ${c.mode ? `<span style="font-size:20px;color:var(--accent)">· ${({ keep: '保持模式', dog: '宠物模式', camp: '露营模式' })[c.mode]}已开启</span>` : ''}<div class="cl-modes">${modeBtn('keep', 'keep', '保持')}${modeBtn('dog', 'dog', '宠物')}${modeBtn('camp', 'tent', '露营')}</div></div>
      <div class="climate">
        <div class="cl-side"><div class="cl-temp"><button data-cl-temp="L" data-d="-0.5">${I('chevL', 34)}</button><b class="${c.on ? '' : 'off'}">${t(c.left)}</b><button data-cl-temp="L" data-d="0.5">${I('chevR', 34)}</button></div><div class="note">主驾</div></div>
        <div class="cl-viz ${c.on ? '' : 'off'} ${c.ac ? '' : 'ac-off'}" id="clViz">
          <svg viewBox="0 0 800 420" preserveAspectRatio="xMidYMid meet">
            <path d="M40 420 C 60 360, 120 350, 400 350 C 680 350, 740 360, 760 420 Z" fill="var(--panel3)"/>
            <rect x="140" y="368" width="200" height="12" rx="6" fill="var(--muted)" opacity=".5"/><rect x="460" y="368" width="200" height="12" rx="6" fill="var(--muted)" opacity=".5"/>
            <circle cx="250" cy="250" r="70" fill="none" stroke="var(--muted)" stroke-width="10" opacity=".25"/>
            <rect x="180" y="40" width="140" height="150" rx="40" fill="var(--muted)" opacity=".15"/><rect x="480" y="40" width="140" height="150" rx="40" fill="var(--muted)" opacity=".15"/>
            ${c.on ? flows('L') + flows('R') : ''}
          </svg>
        </div>
        <div class="cl-side"><div class="cl-temp"><button data-cl-temp="R" data-d="-0.5">${I('chevL', 34)}</button><b class="${c.on ? '' : 'off'}">${t(c.right)}</b><button data-cl-temp="R" data-d="0.5">${I('chevR', 34)}</button></div><div class="note">${c.sync ? '同步' : '副驾'}</div></div>
      </div>
      <div class="cl-bottom">
        <button class="cl-btn power ${c.on ? 'on' : ''}" data-cl="on">${I('power', 30)}${c.on ? '开' : '关'}</button>
        <button class="cl-btn ${c.auto ? 'on' : ''}" data-cl="auto"><b style="font-size:20px;color:inherit">AUTO</b>自动</button>
        <div class="fan-ctl">${I('fan', 30)}<input class="slider" type="range" min="1" max="10" value="${c.fan}" data-fan style="--p:${(c.fan - 1) / 9 * 100}%"><b>${c.fan}</b></div>
        <button class="cl-btn ${c.ac ? 'on' : ''}" data-cl="ac">${I('snow', 30)}A/C</button>
        <button class="cl-btn ${c.recirc ? 'on' : ''}" data-cl="recirc">${I(c.recirc ? 'recirc' : 'freshAir', 30)}${c.recirc ? '内循环' : '外循环'}</button>
        <button class="cl-btn ${c.defF ? 'on' : ''}" data-cl="defF">${I('defrostF', 30)}前除雾</button>
        <button class="cl-btn ${c.defR ? 'on' : ''}" data-cl="defR">${I('defrostR', 30)}后除雾</button>
        ${heat('seatL', 'seatHeat', '主驾')}${heat('seatR', 'seatHeat', '副驾')}${heat('wheel', 'wheelHeat', '方向盘')}
      </div>`;
  }

  // —— 应用
  const EVENTS = [
    ['09:30', '10:30', '产品评审会', '公司 · 18F 会议室', '#3e6ae1', 1],
    ['12:00', '13:00', '和 Lily 午餐', '前滩太古里', '#18a957', 7],
    ['15:00', '15:45', '车辆保养预约', '特斯拉服务中心', '#f5a524', null],
    ['19:30', '21:00', '外滩夜跑', '外滩', '#e31937', 2],
  ];
  const CONTACTS = [['妈妈', '#e8433d', '手机', '昨天'], ['Lily Chen', '#3e6ae1', '手机', '12:41'], ['张伟', '#18a957', '工作', '星期一'], ['快递员', '#f5a524', '未知号码', '星期日'], ['Kevin', '#af52de', '手机', '10/21']];
  function appHTML(id, sub) {
    const title = `<div class="sheet-title"><span class="c-${id}">${I(APPS[id].i, 34)}</span>${APPS[id].n}</div>`;
    switch (id) {
      case 'media': {
        const m = S.media, tr = TRACKS[m.idx];
        const srcs = `<div class="media-src">${[['流媒体', 'music'], ['网易云', 'music'], ['收音机', 'radio'], ['播客', 'podcast'], ['蓝牙', 'bluetoothAudio'], ['收藏', 'heart']].map(([n, ic]) => `<button class="${m.src === n ? 'on' : ''}" data-src="${n}">${n === '网易云' ? '<span class="ne-logo"></span>' : I(ic, 26)}${n}</button>`).join('')}</div>`;
        if (m.src === '网易云') return `${title}<div class="media-full">${srcs}${neteaseHTML()}</div>`;
        return `${title}<div class="media-full">
          <div class="media-src">${[['流媒体', 'music'], ['网易云', 'music'], ['收音机', 'radio'], ['播客', 'podcast'], ['蓝牙', 'bluetoothAudio'], ['收藏', 'heart']].map(([n, ic]) => `<button class="${m.src === n ? 'on' : ''}" data-src="${n}">${n === '网易云' ? '<span class="ne-logo"></span>' : I(ic, 26)}${n}</button>`).join('')}</div>
          <div class="media-list">${TRACKS.map((t, i) => (m.src !== '收藏' || m.fav.includes(i)) ? `<button class="track ${i === m.idx ? 'on' : ''}" data-track="${i}">${art(i)}<div><b>${t.t}</b><span>${t.a}</span></div><em>${fmtDur(t.dur)}</em></button>` : '').join('')}</div>
          <div class="now-big">${art(m.idx)}<h3>${tr.t}</h3><p>${tr.a}</p>
            <div class="scrub"><span>${fmtDur(m.pos)}</span><div class="bar"><i style="width:${m.pos / tr.dur * 100}%"></i></div><span>-${fmtDur(tr.dur - m.pos)}</span></div>
            <div class="big-ctrls"><button data-mact="shuffle">${I('shuffle', 28)}</button><button data-mact="prev">${I('prev', 32)}</button><button class="play" data-mact="play">${I(m.playing ? 'pause' : 'play', 36)}</button><button data-mact="next">${I('next', 32)}</button><button data-mact="fav" class="${m.fav.includes(m.idx) ? 'fav on' : ''}" style="${m.fav.includes(m.idx) ? 'color:var(--red)' : ''}">${I('heart', 28)}</button></div>
            <p class="note" style="margin:0">音乐由 WebAudio 实时生成</p>
          </div></div>`;
      }
      case 'camera':
        return `${title}<div class="app-wrap" style="display:flex;flex-direction:column"><div class="cam-tabs">${[['rear', '后视'], ['front', '前视'], ['left', '左侧'], ['right', '右侧']].map(([v, n]) => `<button class="btn ${(sub || 'rear') === v ? 'primary' : ''}" style="flex:none" data-cam="${v}">${n}</button>`).join('')}</div><div class="cam-view" style="flex:1"><canvas></canvas><div class="cam-tag">模拟摄像头画面</div></div></div>`;
      case 'calendar':
        return `${title}<div class="app-wrap"><div class="note" style="margin-bottom:14px">今天 · ${new Date().toLocaleDateString(I18N.locale(), { month: 'long', day: 'numeric', weekday: 'long' })}</div><div class="list">${EVENTS.map(([a, b, n, loc, c, pl]) => `<div class="li"><span class="ev-bar" style="background:${c}"></span><div class="time">${a}<br><span class="sub">${b}</span></div><div class="grow"><div>${n}</div><div class="sub">${loc}</div></div>${pl != null ? `<button class="btn" data-goplace="${pl}">${I('navArrow', 22)}导航</button>` : `<button class="btn" data-call="特斯拉服务中心">${I('phone', 22)}致电</button>`}</div>`).join('')}</div></div>`;
      case 'phone':
        return `${title}<div class="app-wrap"><div class="two-col"><div><div class="sec-title" style="margin-top:0">最近通话</div><div class="list">${CONTACTS.map(([n, c, t, d]) => `<div class="li"><span class="av" style="background:${c}">${n[0]}</span><div class="grow"><div>${n}</div><div class="sub">${t}</div></div><span class="time">${d}</span><button class="btn" data-call="${n}">${I('phone', 22)}</button></div>`).join('')}</div></div>
          <div><div class="dial-num" id="dialNum"></div><div class="keypad">${'123456789*0#'.split('').map(k => `<button data-key="${k}">${k}</button>`).join('')}</div><button class="btn primary" style="width:100%;margin-top:14px;background:var(--green)" data-call="dial">${I('phone', 24)}拨打</button></div></div></div>`;
      case 'energy': {
        const pts = []; let s = 3;
        for (let i = 0; i <= 50; i++) { s = (s * 9301 + 49297) % 233280; pts.push(120 + Math.sin(i / 5) * 25 + (s / 233280) * 30 + (i > 30 && i < 38 ? 45 : 0)); }
        const path = pts.map((v, i) => `${i ? 'L' : 'M'}${(40 + i * 18).toFixed(0)} ${(330 - (v - 80) * 2.2).toFixed(0)}`).join(' ');
        const avg = Math.round(pts.reduce((a, b) => a + b) / pts.length);
        return `${title}<div class="app-wrap"><div class="seg" style="margin-bottom:18px"><button class="on">驾驶</button><button>消耗</button></div>
          <div class="chart"><svg viewBox="0 0 960 360"><g stroke="var(--line)" stroke-width="1">${[0, 1, 2, 3].map(i => `<line x1="40" x2="940" y1="${60 + i * 90}" y2="${60 + i * 90}"/>`).join('')}</g>
          <path d="${path} L940 330 L40 330 Z" fill="var(--accent)" opacity=".12"/><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linejoin="round"/>
          <line x1="40" x2="940" y1="${330 - (avg - 80) * 2.2}" y2="${330 - (avg - 80) * 2.2}" stroke="var(--green)" stroke-width="2" stroke-dasharray="8 8"/>
          ${[0, 10, 20, 30, 40, 50].map(k => `<text x="${40 + k * 18}" y="356" font-size="15" fill="var(--muted)" text-anchor="middle">${50 - k} km</text>`).join('')}
          <text x="944" y="${325 - (avg - 80) * 2.2}" font-size="15" fill="var(--green)" text-anchor="end">平均 ${avg} Wh/km</text></svg></div>
          <div class="kv" style="margin-top:18px"><div>最近 50 km 平均<b>${avg} Wh/km</b></div><div>按当前能耗预估续航<b>${Math.round(S.battery * 0.75 * 1000 / avg)} km</b></div></div>
          <p class="note">提示：高架路段（30–38 km）能耗上升，主要来自较高车速与空调制冷。</p></div>`;
      }
      case 'toybox':
        if (sub === 'sketch') return `${title}<div class="app-wrap" style="display:flex;flex-direction:column;gap:14px"><div style="display:flex;gap:10px">${['#171a20', '#e31937', '#3e6ae1', '#18a957', '#f5a524'].map((c, i) => `<button class="swatch ${i ? '' : 'on'}" data-ink="${c}" style="background:${c};width:52px;height:52px"></button>`).join('')}<button class="btn" data-sketch="clear" style="margin-left:auto">清除</button><button class="btn" data-sub="">返回</button></div><canvas class="sketch" style="flex:1"></canvas></div>`;
        if (sub === 'romance') return `${title}<div class="app-wrap" style="display:flex;flex-direction:column;gap:14px"><div style="display:flex"><button class="btn" data-sub="">返回</button></div><div class="fireplace" style="flex:1">${[10, 22, 34, 46, 58, 70, 82].map((x, i) => `<i style="left:${x}%;animation-delay:${i * 0.23}s;height:${200 + (i % 3) * 60}px"></i>`).join('')}</div></div>`;
        return `${title}<div class="app-wrap"><div class="toy-grid">
          ${[['lightshow', '灯光秀', '车灯随音乐闪烁', 'sparkle', 'linear-gradient(135deg,#1a1a40,#7a1fa2)'], ['fart', '排放测试模式', '体验“特殊”音效', 'wind', 'linear-gradient(135deg,#5d4037,#a1887f)'], ['rainbow', S.rainbow ? '彩虹路（已开启）' : '彩虹路', '启用自动辅助驾驶时车道变成彩虹', 'rainbow', 'linear-gradient(135deg,#ff6b6b,#ffd166,#06d6a0,#118ab2)'], ['sketch', '素描板', '随手画点什么', 'brush', 'linear-gradient(135deg,#0f766e,#14b8a6)'], ['romance', '浪漫模式', '虚拟壁炉', 'fire', 'linear-gradient(135deg,#7c2d12,#ea580c)'], ['santa', '圣诞模式', '把车变成雪橇', 'snow', 'linear-gradient(135deg,#14532d,#dc2626)']].map(([k, n, d, ic, bg]) => `<button class="toy" data-toy="${k}" style="background:${bg}">${I(ic, 42)}<div>${n}<small>${d}</small></div></button>`).join('')}
        </div></div>`;
      case 'theater':
        return `${title}<div class="app-wrap"><p class="note" style="margin-top:0">仅在驻车（P 档）时可用</p><div class="video-tiles">${[['在线视频', '#e31937'], ['电影', '#111827'], ['短视频', '#ff2d55'], ['动漫', '#3e6ae1'], ['直播', '#18a957'], ['纪录片', '#a16207'], ['新闻', '#334155'], ['儿童', '#f59e0b']].map(([n, c]) => `<button style="background:linear-gradient(160deg,${c},#000a)" data-video="${n}">${n}</button>`).join('')}</div></div>`;
      case 'game':
        return `${title}<div class="app-wrap"><div class="video-tiles">${[['赛车', '#e31937'], ['棋类', '#334155'], ['消除', '#af52de'], ['飞行', '#0ea5e9']].map(([n, c]) => `<button style="background:linear-gradient(160deg,${c},#000a)" data-video="${n}">${n}</button>`).join('')}</div><p class="note">可使用方向盘按键或蓝牙手柄游玩（演示）。</p></div>`;
      case 'browser':
        return `${title}<div class="app-wrap"><div class="browser-bar">${I('search', 22)}搜索或输入网址</div><div class="browser-page"><div>${I('browser', 64)}<p style="font-size:22px">浏览器仅在驻车时可用</p><p class="note">演示环境不加载外部网页</p></div></div></div>`;
      case 'dashcam':
        return `${title}<div class="app-wrap"><div class="seg" style="margin-bottom:18px"><button class="on">行车记录仪</button><button>哨兵模式</button><button>已保存</button></div><div class="list">${['今天 08:42', '今天 08:15', '昨天 19:03', '昨天 18:47', '10/26 14:20'].map((d, i) => `<div class="li"><span class="av" style="background:#222;border-radius:10px">${I('camera', 26)}</span><div class="grow"><div>${d}</div><div class="sub">${['前视', '后视', '左侧', '右侧', '四路'][i]} · ${60 - i * 7} 秒</div></div><button class="btn" data-video="回放">${I('play', 20)}</button></div>`).join('')}</div></div>`;
      case 'messages':
        return `${title}<div class="app-wrap"><div class="list">${[['Lily Chen', '#3e6ae1', '中午老地方见～', '12:01'], ['妈妈', '#e8433d', '周末回家吃饭吗？', '昨天'], ['张伟', '#18a957', '评审材料已经发群里了', '星期一']].map(([n, c, m, t]) => `<div class="li"><span class="av" style="background:${c}">${n[0]}</span><div class="grow"><div>${n}</div><div class="sub">${m}</div></div><span class="time">${t}</span><button class="btn" data-speak="${n}：${m}">${I('vol', 22)}朗读</button></div>`).join('')}</div></div>`;
      case 'manual':
        return `${title}<div class="app-wrap manual">
          <h4>换挡</h4><p>在车辆画面的左边缘向上滑动挂入 R 档、向下滑动挂入 D 档；点击顶部的 P 挂入驻车档。也可以使用键盘 P / R / N / D。</p>
          <h4>驾驶</h4><p>挂入 D 档后按住 ↑ 加速、按住 ↓ 减速，松开保持车速。按 ← → 打转向灯即可变道；如果目标车道盲区有车，屏幕对应一侧会亮起红色光晕并暂缓变道。手动驾驶离前车过近会触发碰撞预警与自动紧急制动。</p>
          <h4>自动辅助驾驶</h4><p>在 D 档时点击速度旁的方向盘图标或按 A 键启用，车辆会自动跟车。按住 ↑ ↓ 调整设定速度，按空格刹车退出。在玩具箱开启“彩虹路”后，启用自动辅助驾驶时车道线会变成彩虹色。</p>
          <h4>导航</h4><p>点击地图左上角“导航”搜索地点，或选择“家 / 公司”。规划路线后点击“开始导航”，挂入 D 档即可模拟行驶。</p>
          <h4>车型适配</h4><p>在 控制 › 车型与外观 中可选择轿车、SUV、掀背或皮卡车身，并修改车漆与车辆名称。</p>
          <h4>界面风格</h4><p>在 控制 › 显示 › 界面风格 中切换到 Apple CarPlay 风格。</p></div>`;
    }
    return title;
  }

  // —— 渲染后绑定（画布类视图）
  // —— 网易云音乐：官方外链播放器（music.163.com/outchain），不涉及登录。
  // 播放器 iframe 常驻在抽屉外，盖在媒体页的占位区域上；关掉媒体页时只隐藏，音乐不中断。
  // —— 网易云登录态（本机侧车 netease-api/，经 serve.py 的 /api/ne/* 转发）。
  // 扫码登录后可浏览自己的歌单 / 每日推荐，用页面自带的 <audio> 播放（和迷你播放器联动）。
  // 登录 cookie 只存在 ~/.driveos/netease-cookie.json，不在项目目录里。
  const neGet = async (p) => { const r = await fetch('api/ne/' + p); const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || r.status), { status: r.status }); return j; };
  const neCover = u => u ? u + (u.includes('?') ? '' : '?param=200y200') : '';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  async function neProbe() {
    NE.probed = true;
    try { NE.auth = await neGet('status'); NE.side = true; if (NE.auth.loggedIn) neLoadLists(); } catch (e) { NE.side = false; }
    if (S.sheet && S.sheet.app === 'media') commit('sheet');
  }
  async function neLoadLists() {
    try { NE.lists = (await neGet('playlists')).lists; } catch (e) { if (e.status === 401) { NE.auth = { loggedIn: false }; } else toast('读取歌单失败：' + e.message); }
    if (S.sheet && S.sheet.app === 'media') commit('sheet');
  }
  async function neOpenList(id, name) {
    toast('正在读取歌单…');
    try {
      const d = id === 'daily' ? await neGet('daily') : await neGet('playlist?id=' + id);
      NE.view = { name: d.name || name, songs: d.songs, total: d.total || d.songs.length };
      commit('sheet');
    } catch (e) { toast('读取失败：' + e.message); }
  }
  async function neSearch(q, type) {
    q = (q || '').trim(); if (!q) return;
    NE.q = q; NE.stype = type || NE.stype; toast('搜索中…');
    try {
      const d = await neGet('search?type=' + NE.stype + '&q=' + encodeURIComponent(q));
      if (NE.stype === 'playlist') { NE.view = { name: `搜索歌单：${q}`, lists: d.lists, songs: [], search: true }; }
      else NE.view = { name: `搜索：${q}`, songs: d.songs, total: d.songs.length, search: true };
      commit('sheet');
    } catch (e) { toast('搜索失败：' + e.message); }
  }
  async function neQR() {
    clearInterval(NE.qrTimer);
    try {
      const q = await neGet('qr/new');
      NE.qr = { img: q.qrimg, key: q.key, msg: '请用网易云 App 扫码' };
      commit('sheet');
      NE.qrTimer = setInterval(async () => {
        if (!sheet.querySelector('.ne-qr')) { clearInterval(NE.qrTimer); return; }
        try {
          const c = await neGet('qr/check?key=' + encodeURIComponent(NE.qr.key));
          if (c.code === 803) { clearInterval(NE.qrTimer); NE.qr = null; NE.probed = false; NE.auth = null; toast('网易云登录成功'); return neProbe(); }
          if (c.code === 800) { clearInterval(NE.qrTimer); NE.qr.msg = '二维码已过期，请重新获取'; NE.qr.expired = true; }
          else NE.qr.msg = c.code === 802 ? '已扫码，请在手机上点「确认登录」' : '请用网易云 App 扫码';
          const m = sheet.querySelector('.ne-qr-msg'); if (m) m.textContent = NE.qr.msg;
          if (NE.qr.expired) commit('sheet');
        } catch (e) {}
      }, 2000);
    } catch (e) { toast('获取二维码失败：' + e.message); }
  }
  // 当前播放信息：网易云在播时用网易云，否则用内置合成音乐（Tesla 组件、CarPlay 组件、迷你播放器共用）
  function nowInfo() {
    if (neActive()) {
      const x = NE.queue[NE.i];
      return { ne: true, t: x.name, a: x.artist, dur: NEA.duration || x.dur || 1, pos: NEA.currentTime || 0, playing: NE.playing, src: '网易云',
        art: cls => `<div class="art ${cls || ''}" style="background:#2a2d31 url('${esc(neCover(x.cover))}') center/cover"></div>` };
    }
    const m = S.media, tr = TRACKS[m.idx];
    return { t: tr.t, a: tr.a, dur: tr.dur, pos: m.pos, playing: m.playing, src: m.src, art: cls => art(m.idx, cls) };
  }
  function neActive() { return !!(NE && NE.live && NE.queue && NE.queue[NE.i]); }
  async function neLoadSong(i, queue) {
    if (queue) NE.queue = queue;
    if (!NE.queue.length) return;
    NE.i = (i + NE.queue.length) % NE.queue.length;
    const song = NE.queue[NE.i], my = ++NE.token;
    if (S.media.playing) { S.media.playing = false; Sound.music.stop(); }
    if (S.netease) { S.netease = null; store.set('netease', null); neFrame(true); }
    NE.live = true; NE.playing = false; NE.loading = true; neSync();
    try {
      const u = await neGet('url?id=' + song.id);
      if (my !== NE.token) return;
      if (!u.url) { toast(`《${song.name}》无法播放（VIP 或无版权），已跳过`); NE.fails++; if (NE.fails < 4) return neLoadSong(NE.i + 1); NE.fails = 0; NE.loading = false; return neSync(); }
      NEA.src = u.url; applyVolume(); await NEA.play(); NE.fails = 0;
    } catch (e) {
      if (my !== NE.token) return;
      NE.fails++; if (NE.fails < 4) return neLoadSong(NE.i + 1);
      NE.fails = 0; NE.loading = false; toast('播放失败：' + e.message); neSync();
    }
  }
  function neCtl(a) {
    if (a === 'play') { if (NEA.paused) NEA.play().catch(() => {}); else NEA.pause(); }
    else if (a === 'next') neLoadSong(NE.i + 1);
    else if (a === 'prev') { if (NEA.currentTime > 5) NEA.currentTime = 0; else neLoadSong(NE.i - 1); }
  }
  NEA.addEventListener('playing', () => { NE.playing = true; NE.loading = false; neSync(); });
  NEA.addEventListener('pause', () => { NE.playing = false; neSync(); });
  NEA.addEventListener('ended', () => neCtl('next'));
  NEA.addEventListener('timeupdate', () => neProgress());
  function neProgress() {
    if (!neActive()) return;
    const d = NEA.duration || NE.queue[NE.i].dur || 1, p = Math.min(100, NEA.currentTime / d * 100) + '%';
    $$('#miniPlayer .mp-progress i, #widgets .w-prog i, .ne-np-bar i, .cp-scrub .bar i').forEach(i => { i.style.width = p; });
    const a = sheet.querySelector('.ne-np-t0'), b = sheet.querySelector('.ne-np-t1');
    if (a) a.textContent = fmtDur(NEA.currentTime); if (b) b.textContent = fmtDur(d);
  }
  // 切歌 / 暂停：只局部更新，不重绘整个抽屉，歌单滚动位置不会丢
  function neSync() {
    commit('mini', 'cp');
    const np = sheet.querySelector('.ne-np'); if (np) np.outerHTML = neNowHTML();
    sheet.querySelectorAll('.ne-song').forEach(b => b.classList.toggle('on', neActive() && NE.queue === (NE.view && NE.view.songs) && +b.dataset.i === NE.i));
    neProgress();
  }
  function neNowHTML() {
    if (!neActive()) return '<div class="ne-np hidden"></div>';
    const s = NE.queue[NE.i];
    return `<div class="ne-np"><div class="art" style="background:#2a2d31 url('${esc(neCover(s.cover))}') center/cover"></div>
      <div class="ne-np-i"><b>${esc(s.name)}</b><span>${esc(s.artist)}${NE.loading ? ' · 加载中…' : ''}</span></div>
      <div class="ne-np-c"><button data-ne2="ctl" data-v="prev">${I('prev', 30)}</button><button class="play" data-ne2="ctl" data-v="play">${I(NE.playing ? 'pause' : 'play', 34)}</button><button data-ne2="ctl" data-v="next">${I('next', 30)}</button></div>
      <div class="ne-np-bar" data-ne2="seek"><span class="ne-np-t0">0:00</span><div class="bar"><i></i></div><span class="ne-np-t1">${fmtDur(s.dur)}</span></div></div>`;
  }
  function neMineHTML() {
    if (NE.auth === null) return '<div class="ne-empty"><b>连接中…</b></div>';
    if (!NE.auth.loggedIn) {
      if (NE.qr) return `<div class="ne-login ne-qr"><img src="${NE.qr.img}" alt="二维码"><div><b class="ne-qr-msg">${esc(NE.qr.msg)}</b><span>打开网易云音乐 App，扫一扫登录。登录信息只保存在这台电脑上。</span>${NE.qr.expired ? '<button class="btn primary" data-ne2="qr">重新获取二维码</button>' : ''}</div></div>`;
      return `<div class="ne-empty">${I('music', 64)}<b>登录网易云，播放你自己的歌单</b><span>扫码即可，不需要输入密码。登录信息只保存在这台电脑上（~/.driveos），不会进入项目文件。</span><button class="btn primary" data-ne2="qr">扫码登录</button></div>`;
    }
    const a = NE.auth;
    const sbar = `<div class="ne-bar"><input class="ne-input ne-search" placeholder="搜索歌曲、歌手" value="${esc(NE.q)}"><button class="chip ${NE.stype === 'song' ? 'on' : ''}" data-ne2="stype" data-v="song">歌曲</button><button class="chip ${NE.stype === 'playlist' ? 'on' : ''}" data-ne2="stype" data-v="playlist">歌单</button><button class="btn primary" data-ne2="search">搜索</button></div>`;
    const head = `${sbar}<div class="ne-user">${a.avatar ? `<img src="${esc(a.avatar)}?param=80y80">` : ''}<b>${esc(a.nickname)}</b><button class="btn" data-ne2="logout">退出登录</button></div>`;
    if (NE.view && NE.view.lists) {
      return `${head}<div class="ne-viewbar"><button class="btn" data-ne2="back">${I('chevL', 22)}返回</button><b>${esc(NE.view.name)}</b><span class="note">${NE.view.lists.length} 个</span></div>
        <div class="ne-lists">${NE.view.lists.map(l => `<button class="ne-list" data-ne2="list" data-id="${l.id}" data-name="${esc(l.name)}"><div class="cv" style="background-image:url('${esc(neCover(l.cover))}')"></div><b>${esc(l.name)}</b><span>${l.count} 首${l.by ? ' · ' + esc(l.by) : ''}</span></button>`).join('') || '<div class="note">没有搜到歌单</div>'}</div>${neNowHTML()}`;
    }
    if (NE.view) {
      return `${head}<div class="ne-viewbar"><button class="btn" data-ne2="back">${I('chevL', 22)}${NE.view.search ? '返回' : '歌单'}</button><b>${esc(NE.view.name)}</b><span class="note">${NE.view.songs.length} 首${NE.view.total > NE.view.songs.length ? `（共 ${NE.view.total} 首，仅载入前 ${NE.view.songs.length} 首）` : ''}</span>
        <button class="btn primary" data-ne2="playall">${I('play', 22)}播放全部</button></div>
        <div class="ne-songs">${NE.view.songs.length ? '' : '<div class="note" style="padding:20px">没有搜到结果</div>'}${NE.view.songs.map((s, i) => `<button class="ne-song ${neActive() && NE.queue === NE.view.songs && NE.i === i ? 'on' : ''}" data-ne2="song" data-i="${i}" data-id="${s.id}"><em>${i + 1}</em><div><b>${esc(s.name)}</b><span>${esc(s.artist)}</span></div>${s.fee === 1 ? '<i class="vip">VIP</i>' : ''}<small>${fmtDur(s.dur)}</small></button>`).join('')}</div>${neNowHTML()}`;
    }
    const lists = NE.lists;
    return `${head}<div class="ne-lists"><button class="ne-list daily" data-ne2="list" data-id="daily" data-name="每日推荐"><div class="cv">${I('sparkle', 46)}</div><b>每日推荐</b><span>为你推荐</span></button>
      ${lists ? lists.map(l => `<button class="ne-list" data-ne2="list" data-id="${l.id}" data-name="${esc(l.name)}"><div class="cv" style="background-image:url('${esc(neCover(l.cover))}')"></div><b>${esc(l.name)}</b><span>${l.count} 首</span></button>`).join('') : '<div class="note">正在读取歌单…</div>'}</div>${neNowHTML()}`;
  }
  function neteaseHTML() {
    if (!NE.probed) neProbe();
    if (!NE.side) return neLinkHTML();
    const t = NE.tab;
    return `<div class="ne-pane ne-main"><div class="ne-tabs"><button class="chip ${t === 'mine' ? 'on' : ''}" data-ne2="tab" data-v="mine">我的网易云</button><button class="chip ${t === 'link' ? 'on' : ''}" data-ne2="tab" data-v="link">链接播放（无需登录）</button></div>
      ${t === 'mine' ? `<div class="ne-mine">${neMineHTML()}</div>` : neLinkHTML().replace('class="ne-pane"', 'class="ne-pane inner"')}</div>`;
  }
  function neAct(a, d) {
    Sound.play('tap');
    if (a === 'tab') { NE.tab = d.v; if (d.v === 'link') NE.view = null; return commit('sheet'); }
    if (a === 'qr') return neQR();
    if (a === 'stype') { NE.stype = d.v; const i = sheet.querySelector('.ne-search'); if (i) NE.q = i.value; if (NE.q.trim()) return neSearch(NE.q, d.v); return commit('sheet'); }
    if (a === 'search') return neSearch((sheet.querySelector('.ne-search') || {}).value);
    if (a === 'logout') { neGet('logout').catch(() => {}); NEA.pause(); NE.live = false; NE.queue = []; NE.auth = { loggedIn: false }; NE.lists = null; NE.view = null; commit('sheet', 'mini'); return; }
    if (a === 'list') return neOpenList(d.id, d.name);
    if (a === 'back') { NE.view = null; return commit('sheet'); }
    if (a === 'song') return neLoadSong(+d.i, NE.view.songs);
    if (a === 'playall') return neLoadSong(0, NE.view.songs);
    if (a === 'ctl') return neCtl(d.v);
    if (a === 'seek') return;
  }
  const NE_PRESETS = [['热歌榜', 0, '3778678'], ['新歌榜', 0, '3779629'], ['飙升榜', 0, '19723756'], ['原创榜', 0, '2884035']];
  const NE_TYPES = { playlist: 0, album: 1, song: 2 };
  // 支持：完整链接（网页 / 手机版 / 带 #/ 和各种参数）、整段分享文字、纯数字 ID
  function parseNetease(v) {
    v = (v || '').trim(); if (!v) return null;
    if (/^\d{3,}$/.test(v)) return { type: 0, id: v }; // 纯数字默认当作歌单 ID
    const m = v.match(/(playlist|album|song)[^\s]*?[?&]id=(\d+)/) || v.match(/(playlist|album|song)\/(\d+)/);
    if (m) return { type: NE_TYPES[m[1]], id: m[2] };
    const id = v.match(/music\.163\.com[^\s]*?[?&]id=(\d+)/);
    return id ? { type: 0, id: id[1] } : null;
  }
  const NE_SHORT = /https?:\/\/(?:www\.)?163cn\.(?:tv|link)\/[A-Za-z0-9]+/;
  // 短链接需要跟一次跳转，交给本地 serve.py 展开
  async function loadNetease(v) {
    const r = parseNetease(v);
    if (r) return setNetease(r);
    const short = (v || '').match(NE_SHORT);
    if (!short) return toast('没认出这个链接：请粘贴网易云的歌单 / 专辑 / 单曲链接');
    toast('正在解析分享链接…');
    try {
      const res = await fetch('api/netease-resolve?u=' + encodeURIComponent(short[0]));
      const r2 = res.ok && parseNetease((await res.json()).url);
      if (r2) return setNetease(r2);
      toast('这个分享链接没有指向歌单 / 专辑 / 单曲，可能已失效');
    } catch (e) {
      toast('短链接需要用 python3 serve.py 启动才能解析；也可以在浏览器打开它，再粘贴完整地址');
    }
  }
  function setNetease(r) {
    S.netease = r; store.set('netease', r);
    if (r && S.media.playing) togglePlay();
    neFrame(true); commit('sheet');
  }
  function neLinkHTML() {
    const ne = S.netease, cur = ne && NE_PRESETS.find(p => p[2] === ne.id);
    return `<div class="ne-pane">
      <div class="ne-bar">
        <input class="ne-input" placeholder="粘贴网易云歌单 / 专辑 / 单曲链接，或歌单 ID" value="${ne && !cur ? ne.id : ''}">
        <button class="btn primary" data-act="ne-load">载入</button>
        ${ne ? '<button class="btn" data-act="ne-clear">停止</button>' : ''}
      </div>
      <div class="ne-presets">${NE_PRESETS.map(([n, t, id]) => `<button class="chip ${ne && ne.id === id ? 'on' : ''}" data-ne="${t}:${id}">${n}</button>`).join('')}</div>
      ${ne ? `<div class="ne-slot" style="height:${ne.type === 2 ? 86 : 430}px"></div>` : `<div class="ne-empty">${I('music', 64)}<b>播放你的网易云歌单</b><span>在网易云里点「分享 › 复制链接」，粘贴到上面；或者直接选一个榜单。<br>使用网易云官方外链播放器，无需登录。会员 / 版权受限的歌曲可能只能试听或无法播放。</span></div>`}
    </div>`;
  }
  let neHost = null, neKey = '';
  function neFrame(load) {
    const ne = S.netease;
    if (!neHost) { neHost = document.createElement('div'); neHost.className = 'ne-host'; sheet.parentNode.appendChild(neHost); }
    const key = ne ? ne.type + ':' + ne.id : '';
    if (!ne) { neHost.innerHTML = ''; neKey = ''; return; }
    if (load && key !== neKey) {
      neKey = key;
      const h = ne.type === 2 ? 86 : 430; // 单曲播放器只有一行高
      neHost.innerHTML = `<iframe frameborder="no" border="0" allow="autoplay" src="https://music.163.com/outchain/player?type=${ne.type}&id=${ne.id}&auto=1&height=${h - 20}" style="height:${h}px"></iframe>`;
    }
  }
  function placeNetease() {
    if (!neHost && !S.netease) return;
    neFrame(true);
    const slot = sheet.querySelector('.ne-slot');
    if (!slot || !S.sheet) { neHost.classList.remove('show'); return; }
    // 抽屉有滑入动画，等它停稳再对齐
    const place = () => {
      const slotNow = sheet.querySelector('.ne-slot'); if (!slotNow || !S.sheet) return neHost.classList.remove('show');
      const pr = sheet.parentNode.getBoundingClientRect(), r = slotNow.getBoundingClientRect(), k = sheet.parentNode.offsetWidth / pr.width;
      Object.assign(neHost.style, { left: (r.left - pr.left) * k + 'px', top: (r.top - pr.top) * k + 'px', width: r.width * k + 'px' });
      neHost.classList.add('show');
    };
    place(); setTimeout(place, 460);
  }

  function afterSheet(sh, key) {
    placeNetease();
    if (sh.type === 'app' && sh.app === 'camera') { startCamLoop(sheet.querySelector('.cam-view canvas'), () => S.sheet && S.sheet.sub || 'rear'); sheet.dataset.static = key; }
    if (sh.type === 'app' && sh.app === 'toybox' && sh.sub === 'sketch') { initSketch(sheet.querySelector('canvas.sketch')); sheet.dataset.static = key; }
  }

  // —— 抽屉内事件（事件委托）
  sheet.addEventListener('keydown', e => { if (e.key !== 'Enter') return; if (e.target.matches('.ne-search')) neSearch(e.target.value); else if (e.target.matches('.ne-input')) loadNetease(e.target.value); });
  sheet.addEventListener('click', e => {
    const t = e.target.closest('button, [data-close]'); if (!t) return;
    const d = t.dataset;
    if ('close' in d) return closeSheet();
    if (d.sec) { S.ctlSec = d.sec; Sound.play('tap'); return commit('sheet'); }
    if (d.seg) { S[d.seg] = d.v; Sound.play('tap'); onSet(d.seg); return commit(); }
    if (d.num) { S[d.num] = +d.v; Sound.play('tap'); return commit('sheet'); }
    if (d.sw) {
      if (d.sw === 'locked') return setLock(!S.locked);
      S[d.sw] = !S[d.sw]; Sound.play('toggle'); onSet(d.sw); return commit();
    }
    if (d.tile) { if (d.tile === 'locked') return setLock(!S.locked); return toggleKey(d.tile); }
    if (d.theme) return setTheme(d.theme);
    if (d.skin) return setSkin(d.skin);
    if (d.body) { Sound.play('tap'); return setBody(d.body); }
    if (d.paint) { Sound.play('tap'); return setPaint(d.paint); }
    if (d.amb) { S.ambientColor = d.amb; Sound.play('tap'); return commit('sheet'); }
    if (d.amps) { S.chargeAmps = Math.max(5, Math.min(48, S.chargeAmps + +d.amps)); Sound.play('tap'); return commit('sheet'); }
    if (d.act) return sheetAction(d.act);
    // 空调
    if (d.clTemp) return setTemp(d.clTemp, +d.d);
    if (d.cl) {
      const c = S.climate; c[d.cl] = !c[d.cl]; Sound.play('toggle');
      if (d.cl === 'on' && !c.on) c.mode = null;
      if (d.cl === 'defF' && c.defF) { c.fan = 10; toast('前挡除雾：风量最大', 'defrostF'); }
      return commit('sheet', 'dock', 'cp');
    }
    if (d.clSeat) { if (d.clSeat === 'wheel') { S.climate.wheel = !S.climate.wheel; Sound.play('toggle'); return commit('sheet', 'cp'); } return cycleSeat(d.clSeat === 'seatL' ? 'L' : 'R'); }
    if (d.clMode) {
      const c = S.climate; c.mode = c.mode === d.clMode ? null : d.clMode; c.on = true;
      Sound.play('toggle');
      if (c.mode) toast({ keep: '保持模式：离车后持续运行空调', dog: '宠物模式：屏幕将显示“我的主人很快回来”', camp: '露营模式：保持空调、灯光与音乐' }[c.mode], { keep: 'keep', dog: 'dog', camp: 'tent' }[c.mode]);
      return commit('sheet', 'dock', 'cp');
    }
    // 媒体
    if (d.src) {
      S.media.src = d.src; Sound.play('tap');
      if (d.src === '网易云' && S.media.playing) togglePlay(); // 两个声源不同时播放
      return commit('sheet', 'mini');
    }
    if (d.ne2) return neAct(d.ne2, d);
    if (d.ne) { const [type, id] = d.ne.split(':'); return setNetease({ type: +type, id }); }
    if (d.track) return playTrack(+d.track);
    if (d.mact) return ({ play: togglePlay, next: nextTrack, prev: prevTrack, fav: toggleFav, shuffle: () => { playTrack(Math.floor(Math.random() * TRACKS.length)); toast('随机播放', 'shuffle'); } })[d.mact]();
    // 应用
    if (d.cam) { S.sheet.sub = d.cam; sheet.dataset.static = ''; Sound.play('tap'); return renderSheet(); }
    if (d.goplace) { closeSheet(); return navigateTo(MapCtl.PLACES[+d.goplace]); }
    if (d.call) return startCall(d.call === 'dial' ? ($('#dialNum').textContent || '10086') : d.call);
    if (d.key) { Sound.play('keypad'); $('#dialNum').textContent += d.key; return; }
    if (d.toy) return toy(d.toy);
    if (d.sub != null) { S.sheet.sub = d.sub || undefined; sheet.dataset.static = ''; return renderSheet(); }
    if (d.ink) { sketchInk = d.ink; sheet.querySelectorAll('[data-ink]').forEach(b => b.classList.toggle('on', b === t)); return; }
    if (d.sketch) { const cv = sheet.querySelector('canvas.sketch'); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); return; }
    if (d.video) { if (S.gear !== 'P') { Sound.play('error'); return toast('仅在驻车时可用'); } Sound.play('tap'); return toast(`${d.video}：演示环境未接入内容源`, 'theater'); }
    if (d.speak) { Sound.play('chime'); return toast(d.speak, 'message'); }
  });
  sheet.addEventListener('input', e => {
    const t = e.target;
    // 自定义车衣颜色：拖动取色器时实时预览，松手（change）后保存
    if ('wrapcolor' in t.dataset) { car && car.setColor(t.value); t.parentElement.style.background = t.value; return; }
    if (t.dataset.range) {
      const k = t.dataset.range; S[k] = +t.value;
      t.style.setProperty('--p', (t.value - t.min) / (t.max - t.min) * 100 + '%');
      const o = sheet.querySelector(`[data-out="${k}"]`); if (o) o.textContent = t.value + (t.dataset.unit || '');
      if (k === 'brightness') stage.style.filter = `brightness(${0.55 + S.brightness / 100 * 0.45})`;
    }
    if ('fan' in t.dataset) {
      S.climate.fan = +t.value; t.style.setProperty('--p', (t.value - 1) / 9 * 100 + '%'); t.nextElementSibling.textContent = t.value;
      sheet.querySelectorAll('.flow').forEach(f => f.style.animationDuration = (2.4 - S.climate.fan * 0.18) + 's');
    }
    if ('filter' in t.dataset) {
      S.ctlFilter = t.value;
      const nav = sheet.querySelector('.ctl-nav');
      nav.querySelectorAll('[data-sec]').forEach(b => { b.style.display = b.textContent.includes(t.value.trim()) ? '' : 'none'; });
    }
    if ('owner' in t.dataset) { S.owner = t.value.trim() || 'Tim'; store.set('owner', S.owner); renderStatus(); const ic = sheet.querySelector('.ctl-head .icons'); if (ic) ic.childNodes.forEach(n => { if (n.nodeType === 3 && n.textContent.trim()) n.textContent = S.owner + ' '; }); }
    if ('name' in t.dataset) { S.carName = t.value || BODY_NAMES[S.body]; store.set('carName', S.carName); renderCarTop(); listeners.forEach(fn => fn(S)); }
  });
  sheet.addEventListener('change', e => {
    if ('wrapcolor' in e.target.dataset) return setPaint(e.target.value);
    if (e.target.dataset.range) { Sound.play('tap'); if (e.target.dataset.range === 'chargeLimit') commit('sheet'); }
    if ('fan' in e.target.dataset) commit('sheet', 'cp');
  });
  // 点击空调可视化：调整出风方向
  sheet.addEventListener('pointerdown', e => {
    const viz = e.target.closest('#clViz'); if (!viz) return;
    const svg = viz.querySelector('svg'), [x, y] = localXY(e, svg);
    const sx = x / svg.clientWidth * 800, sy = y / svg.clientHeight * 420;
    const k = sx < 400 ? 'focusL' : 'focusR';
    S.climate[k] = [Math.max(sx < 400 ? 60 : 420, Math.min(sx < 400 ? 380 : 740, sx)), Math.max(30, Math.min(300, sy))];
    Sound.play('tap'); commit('sheet');
  });
  // 下拉把手关闭抽屉
  (function sheetDrag() {
    let y0 = null, dy = 0;
    sheet.addEventListener('pointerdown', e => { if (!e.target.closest('.sheet-handle')) return; y0 = localXY(e, stage)[1]; dy = 0; sheet.style.transition = 'none'; e.target.setPointerCapture(e.pointerId); });
    sheet.addEventListener('pointermove', e => { if (y0 == null) return; dy = Math.max(0, localXY(e, stage)[1] - y0); sheet.style.transform = `translateY(${dy}px)`; });
    const up = () => { if (y0 == null) return; y0 = null; sheet.style.transition = ''; sheet.style.transform = ''; if (dy > 120) closeSheet(); };
    sheet.addEventListener('pointerup', up); sheet.addEventListener('pointercancel', up);
  })();

  function onSet(k) {
    if (k === 'autoLane') { store.set('autoLane', S.autoLane); if (!S.autoLane) autoLaneReset(); }
    if (k === 'headlights' || k === 'fog') syncCar();
    if (k === 'sentry') { Sound.play(S.sentry ? 'chime' : 'tap'); toast(S.sentry ? '哨兵模式已开启' : '哨兵模式已关闭', 'sentry'); }
    if (k === 'skin') setSkin(S.skin);
    if (k === 'mapMode') { store.set('mapMode', S.mapMode === '真实地图' ? 'real' : 'sim'); toast('正在切换地图…'); setTimeout(() => location.reload(), 500); }
    if (k === 'finish') { store.set('finish', S.finish); car && car.setFinish(S.finish); }
    if (k === 'tail') { store.set('tail', S.tail); car && car.setTail(S.tail); }
    if (k === 'chargersOn') MapCtl.setChargers(S.chargersOn, showCharger);
    if (k === 'accel' && S.accel === '狂暴') toast('狂暴模式：0-100 km/h 2.9 秒 🚀', 'gauge');
  }
  function sheetAction(a) {
    Sound.play('tap');
    if (a === 'lightshow') { closeSheet(); return toy('lightshow'); }
    if (a === 'charge') return startCharging(!S.charging);
    if (a === 'horn') return honkTap();
    if (a === 'hazard') return toggleHazard();
    if (a === 'adjust-wheel') return toast('使用方向盘左侧滚轮调节方向盘位置', 'wheel');
    if (a === 'adjust-mirror') return toast('使用方向盘左侧滚轮调节后视镜', 'mirror');
    if (a === 'clean') { const o = document.createElement('div'); o.style.cssText = 'position:absolute;inset:0;background:#000;z-index:80;display:grid;place-items:center;color:#555;font-size:22px'; o.textContent = '屏幕清洁模式 · 双击退出'; o.ondblclick = () => o.remove(); stage.appendChild(o); setTimeout(() => o.remove(), 8000); return; }
    if (a === 'wash') return toast('洗车模式已开启：车窗已关闭、充电口已锁定', 'snow');
    if (a === 'service') return toast('已为你预约最近的服务中心（演示）', 'wrench');
    if (a === 'reset-trip') return toast('行程 A 已重置');
    if (a === 'ne-load') {
      return loadNetease(sheet.querySelector('.ne-input').value);
    }
    if (a === 'ne-clear') return setNetease(null);
    if (a === 'go-charge') { closeSheet(); return goCharge(); }
    if (a === 'go-home') { closeSheet(); return navigateTo(MapCtl.PLACES[0]); }
    if (a === 'open-climate') return toggleSheet({ type: 'climate' });
  }
  function toy(k) {
    if (k === 'lightshow') { car && car.lightshow(9); Sound.play('lightshow'); setTimeout(() => Sound.play('lightshow'), 1500); toast('灯光秀开始 ✨', 'sparkle'); closeSheet(); }
    if (k === 'fart') { Sound.play('fart'); toast('💨 排放测试完成', 'wind'); }
    if (k === 'rainbow') { S.rainbow = !S.rainbow; syncCar(); Sound.play('chime'); toast(S.rainbow ? '彩虹路已开启 · 启用自动辅助驾驶后可见 🌈' : '彩虹路已关闭', 'rainbow'); commit('sheet'); }
    if (k === 'sketch' || k === 'romance') { S.sheet.sub = k; sheet.dataset.static = ''; renderSheet(); if (k === 'romance') Sound.play('chime'); }
    if (k === 'santa') { Sound.play('lightshow'); toast('🎅 圣诞模式：转向灯声音已换成铃铛（演示）', 'snow'); }
  }

  // —— 素描板
  let sketchInk = '#171a20';
  function initSketch(cv) {
    const fitCv = () => { cv.width = cv.clientWidth; cv.height = cv.clientHeight; };
    requestAnimationFrame(fitCv);
    let drawing = false, last = null;
    cv.addEventListener('pointerdown', e => { drawing = true; last = localXY(e, cv); cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => {
      if (!drawing) return;
      const p = localXY(e, cv), g = cv.getContext('2d');
      g.strokeStyle = sketchInk; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(...last); g.lineTo(...p); g.stroke(); last = p;
    });
    cv.addEventListener('pointerup', () => { drawing = false; });
  }

  // —— 模拟摄像头画面
  const camCanvases = new Map();
  function startCamLoop(cv, getView) {
    if (!cv) return;
    camCanvases.set(cv, getView);
    if (camCanvases.size === 1) requestAnimationFrame(camFrame);
  }
  function camFrame(now) {
    for (const [cv, getView] of camCanvases) {
      if (!cv.isConnected) { camCanvases.delete(cv); continue; }
      if (!cv.offsetParent) continue;
      drawCam(cv, getView(), now);
    }
    if (camCanvases.size) requestAnimationFrame(camFrame);
  }
  function drawCam(cv, view, now) {
    // 新渲染器（js/rearcam.js）：程序生成的 3D 停车场 + 广角畸变 + 动态辅助线；缺失时退回下面的简易画面
    if (window.RearCam) return RearCam.draw(cv, view, now, { gear: S.gear, speed: S.speed, panel: !!(cv.closest && cv.closest('#revCam')) });
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const g = cv.getContext('2d'), hz = h * 0.4, cx = w / 2;
    const tint = { rear: ['#4b5560', '#2a2f35'], front: ['#7f93a6', '#3b434b'], left: ['#59636b', '#30363c'], right: ['#5d6670', '#2d3238'] }[view];
    let gr = g.createLinearGradient(0, 0, 0, hz); gr.addColorStop(0, tint[0]); gr.addColorStop(1, tint[1]);
    g.fillStyle = gr; g.fillRect(0, 0, w, hz);
    gr = g.createLinearGradient(0, hz, 0, h); gr.addColorStop(0, '#3b3e42'); gr.addColorStop(1, '#5a5e62');
    g.fillStyle = gr; g.fillRect(0, hz, w, h - hz);
    // 远处建筑 / 车辆剪影
    g.fillStyle = 'rgba(0,0,0,.35)';
    for (let i = 0; i < 9; i++) { const bw = 60 + (i * 37) % 90, bh = 40 + (i * 53) % 120; g.fillRect((i * 173) % w, hz - bh, bw, bh); }
    g.fillStyle = 'rgba(20,22,25,.85)';
    g.beginPath(); g.roundRect(w * 0.07, hz + 10, w * 0.2, h * 0.16, 24); g.fill();
    // 车位线（透视）
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 5;
    const drift = view === 'rear' || view === 'front' ? Math.sin(now / 3000) * 8 : 0;
    for (const xb of [-1.6, 1.6, -4.8, 4.8]) { g.beginPath(); g.moveTo(cx + xb * 30 + drift, hz); g.lineTo(cx + xb * w * 0.22 + drift, h); g.stroke(); }
    // 倒车辅助线
    if (view === 'rear') {
      const seg = (c, y0, y1) => {
        g.strokeStyle = c; g.lineWidth = 7;
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * (w * 0.32 - (h - y0) * 0.55), y0); g.quadraticCurveTo(cx + s * (w * 0.3 - (h - (y0 + y1) / 2) * 0.5) + 30, (y0 + y1) / 2, cx + s * (w * 0.32 - (h - y1) * 0.55) + 40, y1); g.stroke(); }
        g.beginPath(); g.moveTo(cx - (w * 0.32 - (h - y0) * 0.55) + 6, y0); g.lineTo(cx + (w * 0.32 - (h - y0) * 0.55) - 6, y0); g.lineWidth = 4; g.stroke();
      };
      seg('#18c964', hz + 40, hz + 110); seg('#f5c518', hz + 110, h - 120); seg('#ff3b30', h - 120, h - 20);
    }
    // 噪点 + 鱼眼暗角
    g.fillStyle = 'rgba(255,255,255,.04)';
    for (let i = 0; i < 300; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    gr = g.createRadialGradient(cx, h / 2, h * 0.3, cx, h / 2, w * 0.7);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.7)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.8)'; g.font = '500 18px Inter, sans-serif';
    g.fillText(I18N.t({ rear: '后视摄像头', front: '前视摄像头', left: '左侧 B 柱', right: '右侧 B 柱' }[view]) + '  ' + new Date().toLocaleTimeString(I18N.locale(), { hour12: false }), 24, h - 24);
  }
  if (window.RearCam) RearCam.buildPanel($('#revCam'));
  else $('#revCam').innerHTML = '<canvas></canvas><div class="cam-tag">倒车影像 · 模拟画面</div>';

  // —— 通话
  let callT;
  function startCall(name) {
    if (S.call) return;
    S.call = { name, state: 'ring', t0: 0 };
    Sound.play('ring'); renderCall();
    callT = setTimeout(() => { if (!S.call) return; S.call.state = 'live'; S.call.t0 = Date.now(); Sound.play('chime'); renderCall(); listeners.forEach(fn => fn(S)); }, 2600);
    listeners.forEach(fn => fn(S));
  }
  function endCall() { clearTimeout(callT); S.call = null; Sound.play('hangup'); renderCall(); listeners.forEach(fn => fn(S)); }
  function renderCall() {
    const b = $('#callBanner'), c = S.call;
    b.classList.toggle('show', !!c);
    if (!c) return;
    const t = c.state === 'live' ? fmtDur((Date.now() - c.t0) / 1000) : '正在呼叫…';
    b.innerHTML = `<span class="av">${c.name[0]}</span><div><b>${c.name}</b><span>${t}</span></div><button class="hang" data-act="hang">${I('hangup', 30)}</button>`;
  }
  $('#callBanner').addEventListener('click', e => { if (e.target.closest('[data-act="hang"]')) endCall(); });

  // ------------------------------------------------------------------ 启动器
  function renderLauncher() {
    const l = $('#launcher');
    l.classList.toggle('open', S.launcher);
    l.innerHTML = `<div class="launcher-grid">${Object.entries(APPS).map(([id, a]) => `<button data-app="${id}"><span class="c-${id}">${I(a.i, 46)}</span>${a.n}</button>`).join('')}</div><div class="launcher-tip">长按应用可添加到底栏</div>`;
  }
  (function launcherEvents() {
    const l = $('#launcher'); let pressT, long = false;
    l.addEventListener('pointerdown', e => {
      const b = e.target.closest('[data-app]'); if (!b) return; long = false;
      pressT = setTimeout(() => {
        long = true; const id = b.dataset.app;
        if (!S.dockApps.includes(id)) { S.dockApps = [...S.dockApps, id].slice(-7); S.recent = S.recent.filter(x => x !== id); Sound.play('toggle'); toast(`已将「${APPS[id].n}」添加到底栏`); }
        else { S.dockApps = S.dockApps.filter(x => x !== id); Sound.play('toggle'); toast(`已从底栏移除「${APPS[id].n}」`); }
        commit('dock');
      }, 650);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => l.addEventListener(ev, () => clearTimeout(pressT)));
    l.addEventListener('click', e => { const b = e.target.closest('[data-app]'); if (b && !long) openApp(b.dataset.app); });
  })();

  // ------------------------------------------------------------------ 渲染调度
  function render(regions) {
    const all = regions.includes('all'), has = r => all || regions.includes(r);
    if (has('car')) renderCarTop();
    if (has('status')) renderStatus();
    if (has('dock')) renderDock();
    if (has('mini')) { renderMini(); renderWidgets(); }
    if (has('nav')) renderNav();
    if (has('mapctrls')) renderMapCtrls();
    if (has('sheet')) {
      renderSheet();
      // 打开设置等面板时，车辆区临时缩回默认宽度（参照新版车机）
      const t = $('#tesla'), open = !!S.sheet;
      if (t.classList.contains('sheet-open') !== open) { t.classList.toggle('sheet-open', open); setTimeout(() => MapCtl.resize(), 480); }
    }
    if (has('launcher')) renderLauncher();
    renderCall();
  }

  // ------------------------------------------------------------------ 键盘
  window.addEventListener('keydown', e => {
    if (e.target.matches && e.target.matches('input, textarea')) return;
    const k = e.key;
    if ('PRND'.includes(k.toUpperCase()) && k.length === 1) return shift(k.toUpperCase());
    if (k === 'a' || k === 'A') return setAP(!S.ap);
    if (k === 'ArrowUp') { pedal.up = true; e.preventDefault(); return; }
    if (k === 'ArrowDown') { pedal.down = true; e.preventDefault(); return; }
    if (S.carExpanded && (k === 'ArrowLeft' || k === 'ArrowRight')) { e.preventDefault(); return car && car.rotate((k === 'ArrowLeft' ? -5 : 5) * Math.PI / 180); }
    if (S.carExpanded && k === 'Home') return car && car.resetView();
    if (k === 'ArrowLeft') return setSignal('left');
    if (k === 'ArrowRight') return setSignal('right');
    if (k === ' ') { e.preventDefault(); S.braking = true; if (S.ap) setAP(false); return; }
    if (k === 'h' || k === 'H') { if (!e.repeat) honk(true); return; }
    if (k === 'z' || k === 'Z') return toggleHazard();
    if (k === 'o' || k === 'O') return pullOver();
    if (k === 'l' || k === 'L') return setLock(!S.locked);
    if (k === 'm' || k === 'M') return togglePlay();
    if (k === '-') return setVolume(S.volume - 1);
    if (k === '=' || k === '+') return setVolume(S.volume + 1);
    if (k === 'Escape') { if (S.sheet) closeSheet(); else if (S.carExpanded) setExpanded(false); }
  });
  window.addEventListener('keyup', e => {
    if (e.key === ' ') S.braking = false;
    if (e.key === 'ArrowUp') pedal.up = false;
    if (e.key === 'ArrowDown') pedal.down = false;
    if (e.key === 'h' || e.key === 'H') honk(false);
  });
  window.addEventListener('blur', () => { pedal.up = pedal.down = false; S.braking = false; honk(false); });
  $$('[data-horn]').forEach(b => {
    b.addEventListener('pointerdown', e => { honk(true); b.setPointerCapture(e.pointerId); });
    ['pointerup', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => honk(false)));
  });
  // 触屏：车辆画面底部的电门 / 刹车踏板，转向灯箭头可点击
  $$('[data-pedal]').forEach(b => {
    const k = b.dataset.pedal;
    b.addEventListener('pointerdown', e => { pedal[k] = true; b.setPointerCapture(e.pointerId); });
    ['pointerup', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => { pedal[k] = false; }));
  });
  $$('[data-hazard]').forEach(b => b.addEventListener('click', toggleHazard));
  $$('[data-pull]').forEach(b => b.addEventListener('click', () => pullOver()));
  $('#sigL').addEventListener('click', () => setSignal('left'));
  $('#sigR').addEventListener('click', () => setSignal('right'));

  // ------------------------------------------------------------------ 演示工具条
  function renderDevbar() {
    $$('#devSkin button').forEach(b => b.classList.toggle('on', b.dataset.skin === S.skin));
    $$('#devTheme button').forEach(b => b.classList.toggle('on', b.dataset.theme === S.themePref));
    const sel = $('#devBody');
    if (!sel.options.length) sel.innerHTML = Object.entries(Car3D.PROFILES).filter(([k]) => !HIDDEN_BODIES.includes(k)).map(([k, p]) => `<option value="${k}">车身：${p.label}</option>`).join('');
    sel.value = S.body;
    $('#devSound').textContent = Sound.enabled ? '🔊 音效开' : '🔇 音效关';
  }
  $('#devSkin').addEventListener('click', e => { const b = e.target.closest('[data-skin]'); if (b) setSkin(b.dataset.skin); });
  $('#devTheme').addEventListener('click', e => { const b = e.target.closest('[data-theme]'); if (b) setTheme(b.dataset.theme); });
  $('#devBody').addEventListener('change', e => setBody(e.target.value));
  $('#devSound').addEventListener('click', () => { Sound.setEnabled(!Sound.enabled); if (!Sound.enabled) Sound.music.stop(); else if (S.media.playing) Sound.music.start(TRACKS[S.media.idx]); renderDevbar(); });
  $('#devKeys').addEventListener('click', () => $('#keysPop').classList.toggle('show'));
  listeners.push(renderDevbar);

  // ------------------------------------------------------------------ 对外接口（供 CarPlay 皮肤使用）
  const App = window.App = {
    S, TRACKS, APPS, PAINTS, art, nowInfo, I, toast, commit, fmtDur, fmtDist, clock, rangeKm,
    subscribe: fn => listeners.push(fn),
    shift, setAP, setTemp, cycleSeat, setVolume, togglePlay, nextTrack, prevTrack, playTrack, toggleFav,
    navigateTo, startNav, endNav, honkTap, toggleHazard, setLock, toggleKey, setTheme, setSkin, setBody, setPaint, startCall, endCall, toy,
    nav: () => navHelpers, isDark, localXY, car: null,
  };

  // 切换语言：界面文字由 js/i18n.js 的观察器统一翻译；这里整体重绘一次，让日期格式等渲染时取值的内容跟着换
  I18N.onChange(() => commit());

  // ------------------------------------------------------------------ 启动
  MapCtl.init({ onUserMove: () => renderMapCtrls() });
  applyTheme();
  setInterval(() => { if (S.themePref === 'auto') applyTheme(); }, 60000);
  $('#tesla').classList.toggle('active', S.skin === 'tesla');
  $('#carplay').classList.toggle('active', S.skin === 'carplay');
  commit();
  if (/[?&]rev=1\b/.test(location.search)) setTimeout(() => shift('R'), 600); // 调试：地址后加 ?rev=1 直接进入倒车影像
  setTimeout(() => { if (S.skin === 'carplay' && window.CarPlay) CarPlay.activate(); });
})();
