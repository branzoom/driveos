/* 模拟地图：程序生成、无限延伸的城市，和左侧 3D 驾驶画面完全同步。
 * - 路网是“扭曲过的网格”：路口位置随机错开、整片城市有大尺度弯曲、每段路略带弧度，部分路段断开形成丁字路口
 * - 可行驶的道路都是双向 6 车道（单向 3 车道，与 3D 画面一致）；街区内部还有窄支路和沿街排布的建筑
 * - 车辆只在可行驶道路上走；路口直行或转弯，变道时地图上的箭头也会换到相应车道
 * - 接口与真实地图（map.js 的 MapCtl）一致，app.js 不需要区分两种地图
 * 世界坐标用米（x 向东，y 向北），对外换算成以上海陆家嘴为原点的“伪经纬度”，方便复用导航逻辑。
 */
(function () {
  const store = k => { try { return JSON.parse(localStorage.getItem('driveos.' + k)); } catch (e) { return null; } };
  const MODE = store('mapMode') || 'real';

  // ---------------- 坐标 ----------------
  const ORIGIN = [121.4995, 31.2397];
  const MX = 111320 * Math.cos(ORIGIN[1] * Math.PI / 180), MY = 110540;
  const toLL = ([x, y]) => [ORIGIN[0] + x / MX, ORIGIN[1] + y / MY];
  const toXY = ([lng, lat]) => [(lng - ORIGIN[0]) * MX, (lat - ORIGIN[1]) * MY];
  const haversine = (a, b) => { const p = toXY(a), q = toXY(b); return Math.hypot(q[0] - p[0], q[1] - p[1]); };
  const brgXY = (a, b) => (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI + 360) % 360;

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const norm = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  const right = d => [d[1], -d[0]]; // 前进方向的右侧
  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const mod = (n, m) => ((n % m) + m) % m;
  function hash(a, b, s = 0) {
    let h = (a * 374761393 + b * 668265263 + s * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177; h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // ---------------- 路网 ----------------
  const G = 760;               // 路口平均间距
  const LANE = 3.6, MEDIAN = 3;
  const HALF_AVE = MEDIAN / 2 + LANE * 3; // 道路半宽 12.3 m
  const STREET = 8;
  const laneOff = lane => MEDIAN / 2 + LANE * (lane + 1.5); // lane: -1 内侧 / 0 中间 / 1 外侧
  const LANE0 = laneOff(0);
  const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // 北 东 南 西（网格方向，实际道路是弯的）

  // 整座城市的大尺度弯曲
  const WARP = ([x, y]) => [x + 150 * Math.sin(y / 1900 + 0.7) + 55 * Math.sin(y / 610 + 2), y + 150 * Math.sin(x / 2100 + 2.1) + 55 * Math.sin(x / 690 + 1)];
  const nodeRaw = (i, j) => [i * G + (hash(i, j, 51) - 0.5) * 0.36 * G, j * G + (hash(i, j, 52) - 0.5) * 0.36 * G];
  const nodeCache = new Map(), edgeCache = new Map();
  function node(i, j) {
    const k = i + ',' + j; let p = nodeCache.get(k);
    if (!p) { p = WARP(nodeRaw(i, j)); nodeCache.set(k, p); }
    return p;
  }
  const isMajor = (k, i, j) => k % 2 === 0 ? mod(i, 3) === 0 : mod(j, 3) === 0;
  // 某个路口往某方向有没有路。每个路口最多断掉一条横向、一条纵向的路，所以不会出现死胡同
  function hasEdge(i, j, k) {
    if (k === 2) return hasEdge(i, j - 1, 0);
    if (k === 3) return hasEdge(i - 1, j, 1);
    if (isMajor(k, i, j)) return true;
    return k === 1 ? !(mod(i + j, 2) === 0 && hash(i, j, 61) < 0.22) : !(mod(i + j, 2) === 1 && hash(i, j, 62) < 0.22);
  }
  // 从路口 (i,j) 沿方向 k 到下一个路口的道路中心线
  function edge(i, j, k) {
    const ni = i + DIRS[k][0], nj = j + DIRS[k][1];
    const flip = k >= 2;
    const ai = flip ? ni : i, aj = flip ? nj : j, bi = flip ? i : ni, bj = flip ? j : nj;
    const key = ai + ',' + aj + ',' + (k % 2);
    let pts = edgeCache.get(key);
    if (!pts) {
      if (edgeCache.size > 30000) edgeCache.clear();
      const a = nodeRaw(ai, aj), b = nodeRaw(bi, bj);
      const bend = (hash(ai, aj, 70 + k % 2) - 0.5) * 0.18, n = [-(b[1] - a[1]), b[0] - a[0]];
      pts = [];
      for (let s = 0; s <= 12; s++) {
        const t = s / 12, w = 4 * t * (1 - t) * bend;
        pts.push(WARP([a[0] + (b[0] - a[0]) * t + n[0] * w, a[1] + (b[1] - a[1]) * t + n[1] * w]));
      }
      edgeCache.set(key, pts);
    }
    return flip ? pts.slice().reverse() : pts;
  }
  const polyLen = pts => { let l = 0; for (let s = 1; s < pts.length; s++) l += dist(pts[s - 1], pts[s]); return l; };
  function projPoly(pts, p) {
    let best = null, acc = 0;
    for (let s = 1; s < pts.length; s++) {
      const a = pts[s - 1], ab = sub(pts[s], a), L = Math.hypot(ab[0], ab[1]) || 1;
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / (L * L)));
      const q = [a[0] + ab[0] * t, a[1] + ab[1] * t], d = dist(q, p);
      if (!best || d < best.d) best = { d, p: q, along: acc + L * t, dir: [ab[0] / L, ab[1] / L] };
      acc += L;
    }
    best.len = acc; return best;
  }
  function subPoly(pts, d0, d1) {
    const out = []; let acc = 0;
    for (let s = 1; s < pts.length; s++) {
      const a = pts[s - 1], b = pts[s], L = dist(a, b) || 1e-6, s0 = acc, s1 = acc + L;
      if (s1 >= d0 && s0 <= d1) {
        if (!out.length) out.push(lerp2(a, b, (Math.max(d0, s0) - s0) / L));
        out.push(lerp2(a, b, (Math.min(d1, s1) - s0) / L));
      }
      acc = s1;
    }
    return out.length ? out : [pts[pts.length - 1]];
  }
  const V_NAMES = ['世纪', '银城', '东方', '张杨', '浦明', '花木', '锦绣', '民生', '源深', '崂山', '福山', '栖霞', '潍坊', '乳山', '商城', '浦电', '杨高', '罗山', '芳甸', '樱花'];
  const H_NAMES = ['滨江', '陆家嘴', '龙阳', '金桥', '云台', '高科', '博山', '峨山', '白莲泾', '前滩', '耀华', '海阳', '长清', '雪野', '西营', '御桥'];
  const roadName = (axis, i) => axis === 'v' ? V_NAMES[mod(i, V_NAMES.length)] + '路' : H_NAMES[mod(i, H_NAMES.length)] + '大道';
  const edgeName = (i, j, k) => k % 2 === 0 ? roadName('v', i) : roadName('h', k === 1 ? j : j);

  // 离某点最近的道路。给了朝向就返回同向的那一侧（i,j 为起点路口，k 为方向，along 为从起点量起的距离）
  function nearestEdge(p, brg) {
    const ci = Math.round(p[0] / G), cj = Math.round(p[1] / G);
    const hd = brg == null ? null : [Math.sin(brg * Math.PI / 180), Math.cos(brg * Math.PI / 180)];
    let best = null;
    for (let i = ci - 2; i <= ci + 2; i++) for (let j = cj - 2; j <= cj + 2; j++) for (const k of [0, 1]) {
      if (!hasEdge(i, j, k)) continue;
      const pr = projPoly(edge(i, j, k), p);
      let r = { i, j, k, along: pr.along, len: pr.len, proj: pr.p, dir: pr.dir, score: pr.d };
      if (hd) {
        const c = hd[0] * pr.dir[0] + hd[1] * pr.dir[1];
        if (c < 0) r = { ...r, i: i + DIRS[k][0], j: j + DIRS[k][1], k: k + 2, along: pr.len - pr.along, dir: [-pr.dir[0], -pr.dir[1]] };
        r.score += 45 * (1 - Math.abs(c));
      }
      if (!best || r.score < best.score) best = r;
    }
    return best;
  }

  // 一条蜿蜒的江，从城市南侧横穿而过（道路从桥上通过）
  const riverY = x => -1150 + 380 * Math.sin(x / 1400) + 150 * Math.sin(x / 530 + 1.3);
  const RIVER_W = 150;

  // 地点：都放在路边，导航终点就是路边
  function place(name, gx, gy, side, no, icon) {
    const e = nearestEdge([gx, gy]), n = right(e.dir), o = side * (HALF_AVE + 26);
    return { name, addr: `${edgeName(e.i, e.j, e.k)} ${no} 号`, ll: toLL([e.proj[0] + n[0] * o, e.proj[1] + n[1] * o]), icon };
  }
  const PLACES = [
    place('家', 1.5 * G, 1 * G, 1, 88, 'home'),
    place('公司', -3 * G, 2.4 * G, -1, 1266, 'work'),
    place('滨江公园', -0.6 * G, -1 * G, -1, 1, 'star'),
    place('世纪广场', 2 * G, -0.45 * G, 1, 300, 'pin'),
    place('星河购物中心', 3.5 * G, 3 * G, 1, 1500, 'pin'),
    place('东方体育中心', 6 * G, -2.3 * G, 1, 753, 'star'),
    place('国际机场', 9.5 * G, -6 * G, 1, 1, 'pin'),
    place('火车站', -8 * G, 0.6 * G, 1, 1500, 'pin'),
    place('中心医院', -1.4 * G, 2 * G, -1, 160, 'pin'),
    place('科技园', 4 * G, 4.6 * G, 1, 2000, 'pin'),
  ];
  const charger = (name, gx, gy, side, free, total, kw) => ({ name, ll: place(name, gx, gy, side, 0).ll, free, total, kw });
  const CHARGERS = [
    charger('超级充电站 · 世纪广场', 2 * G, -0.2 * G, -1, 9, 12, 250),
    charger('超级充电站 · 星河', 3.2 * G, 3 * G, -1, 4, 10, 250),
    charger('超级充电站 · 科技园', 4 * G, 4.3 * G, 1, 2, 8, 150),
    charger('超级充电站 · 滨江', -1.3 * G, -1 * G, 1, 14, 20, 250),
    charger('超级充电站 · 公司', -3 * G, 2.1 * G, 1, 6, 12, 250),
    charger('目的地充电 · 体育中心', 6 * G, -2.6 * G, -1, 3, 4, 11),
  ];

  // 程序生成的超充站：整座无限城市里大约每 15 个街区一座，开到哪里附近都有
  const genCache = new Map();
  function genCharger(i, j) {
    const key = i + ',' + j;
    if (genCache.has(key)) return genCache.get(key);
    let c = null;
    const k = hash(i, j, 92) < 0.5 ? 0 : 1;
    if (hash(i, j, 91) < 0.07 && Math.abs(i) + Math.abs(j) > 4 && hasEdge(i, j, k)) {
      const pts = edge(i, j, k), mid = pts[6], n = right(norm(sub(pts[7], pts[5]))), o = HALF_AVE + 26;
      const total = 8 + 4 * Math.floor(hash(i, j, 93) * 4);
      c = { name: `超级充电站 · ${edgeName(i, j, k)}${(mod(i * 7 + j * 13, 9) + 1) * 100}号`, ll: toLL([mid[0] + n[0] * o, mid[1] + n[1] * o]), free: 1 + Math.floor(hash(i, j, 94) * (total - 1)), total, kw: hash(i, j, 95) < 0.8 ? 250 : 150 };
    }
    genCache.set(key, c);
    return c;
  }
  function chargersNear(p, cells) {
    const ci = Math.round(p[0] / G), cj = Math.round(p[1] / G);
    const out = CHARGERS.filter(c => dist(toXY(c.ll), p) < (cells + 1) * G);
    for (let i = ci - cells; i <= ci + cells; i++) for (let j = cj - cells; j <= cj + cells; j++) { const c = genCharger(i, j); if (c) out.push(c); }
    return out;
  }
  function nearestChargers(ll, n = 3) {
    const p = toXY(ll); let cells = 6, list;
    do { list = chargersNear(p, cells); cells += 6; } while (list.length < n && cells < 40);
    return list.map(c => ({ ...c, km: dist(toXY(c.ll), p) / 1000 })).sort((a, b) => a.km - b.km).slice(0, n);
  }

  // ---------------- 状态 ----------------
  let host = null, layer = null, cv = null, ctx = null, onUserMove = null;
  let follow = true, northUp = false, dark = false, navMode = false, lastUserMove = 0;
  // 起点：世纪路上，朝北，中间车道
  const startPos = (() => {
    const pts = edge(0, 0, 0), pr = projPoly(pts, lerp2(pts[0], pts[12], 0.35)), n = right(pr.dir);
    return { p: [pr.p[0] + n[0] * LANE0, pr.p[1] + n[1] * LANE0], b: brgXY([0, 0], pr.dir) };
  })();
  // 车辆：base 为“中间车道”上的位置（导航 / 自由驾驶给出），显示时再加上 3D 画面里的横向偏移
  let carLL = toLL(startPos.p), carBrg = startPos.b;
  let from = { p: startPos.p, b: carBrg }, to = { p: startPos.p, b: carBrg }, moveT0 = 0, moveDur = 1;
  // 相机（平滑跟随）
  const cam = { x: from.p[0], y: from.p[1], rot: carBrg, z: 15.4 };
  const camT = { x: cam.x, y: cam.y, rot: carBrg, z: 15.4 };
  let routeR = null, doneD = 0, dest = null, showChargers = false, chargerClick = null, visibleChargers = [];

  const lerpAng = (a, b, t) => { const d = ((b - a + 540) % 360) - 180; return a + d * t; };
  const scaleOf = z => 0.6 * Math.pow(2, z - 15); // 像素 / 米

  function init(opts) {
    onUserMove = opts.onUserMove;
    host = document.getElementById('map');
    host.innerHTML = ''; host.classList.add('sim-map');
    layer = document.createElement('div'); layer.className = 'sim-layer';
    cv = document.createElement('canvas'); layer.appendChild(cv);
    host.appendChild(layer);
    ctx = cv.getContext('2d');
    resize(); new ResizeObserver(resize).observe(host);
    bindInput();
    requestAnimationFrame(frame);
  }
  function resize() {
    if (!host) return;
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    const W = Math.round(w * 1.6), H = Math.round(h * 1.8);
    if (cv.width === W && cv.height === H) return;
    cv.width = W; cv.height = H;
    draw(performance.now()); // 改尺寸会清空画布，立刻重画，避免拖动分隔条时闪白
  }

  // ---------------- 交互：拖动平移、滚轮缩放、点击充电站 ----------------
  function bindInput() {
    let drag = null;
    host.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      drag = { x: e.clientX, y: e.clientY, moved: false }; host.setPointerCapture(e.pointerId);
    });
    host.addEventListener('pointermove', e => {
      if (!drag) return;
      const k = host.offsetWidth / host.getBoundingClientRect().width; // 舞台缩放
      const dx = (e.clientX - drag.x) * k, dy = (e.clientY - drag.y) * k;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      drag.moved = true; drag.x = e.clientX; drag.y = e.clientY;
      if (follow) { follow = false; onUserMove && onUserMove(); }
      lastUserMove = Date.now();
      const s = scaleOf(cam.z), r = cam.rot * Math.PI / 180;
      // 屏幕位移换算回世界坐标（考虑地图旋转）
      const wx = (-dx * Math.cos(r) - dy * Math.sin(r)) / s, wy = (-dx * Math.sin(r) + dy * Math.cos(r)) / s;
      camT.x += wx; camT.y += wy; cam.x += wx; cam.y += wy;
    });
    host.addEventListener('pointerup', e => {
      if (drag && !drag.moved) hitTest(e);
      drag = null;
    });
    host.addEventListener('wheel', e => { e.preventDefault(); camT.z = Math.max(11, Math.min(18, camT.z - e.deltaY * 0.0025)); }, { passive: false });
  }
  function hitTest(e) {
    if (!showChargers || navMode) return;
    const r = host.getBoundingClientRect(), k = host.offsetWidth / r.width;
    const sx = (e.clientX - r.left) * k + cv.width * 0.1875, sy = (e.clientY - r.top) * k + cv.height * (0.8 / 1.8);
    for (const c of visibleChargers) {
      const p = project(toXY(c.ll));
      if (Math.abs(sx - p[0]) < 46 && sy > p[1] - 56 && sy < p[1] + 4) { chargerClick && chargerClick(c); return; }
    }
  }

  // ---------------- 投影 ----------------
  let AX = 0, AY = 0;
  function project([x, y]) {
    const s = scaleOf(cam.z), r = -cam.rot * Math.PI / 180;
    const dx = (x - cam.x) * s, dy = -(y - cam.y) * s;
    return [AX + dx * Math.cos(r) - dy * Math.sin(r), AY + dx * Math.sin(r) + dy * Math.cos(r)];
  }

  // ---------------- 绘制 ----------------
  const PAL = {
    light: { ground: '#eef0f2', block: '#e6e8eb', bldg: ['#dadde1', '#d5d8dd', '#dfe1e5'], bldgLine: '#cdd1d6', park: '#d5ead2', water: '#bcd7ef', street: '#ffffff', streetCase: '#dfe2e6', ave: '#ffffff', aveMajor: '#fff3c9', aveCase: '#cfd3d8', mark: 'rgba(120,125,135,.45)', median: '#e2c66b', text: '#5f646b', textHalo: 'rgba(255,255,255,.92)', route: '#3e7bfa', routeCase: '#1d47b8', done: '#a3aab5' },
    dark: { ground: '#151515', block: '#1a1a1a', bldg: ['#232323', '#262626', '#202020'], bldgLine: '#2c2c2c', park: '#19251b', water: '#13202c', street: '#262626', streetCase: '#151515', ave: '#363636', aveMajor: '#41403a', aveCase: '#0d0d0d', mark: 'rgba(255,255,255,.22)', median: 'rgba(214,180,80,.55)', text: '#8d8d8d', textHalo: 'rgba(0,0,0,.78)', route: '#3e7bfa', routeCase: '#1a3d9c', done: '#555b66' },
  };

  function frame(now) {
    requestAnimationFrame(frame);
    draw(now);
  }
  function draw(now) {
    if (!ctx || !host.isConnected || !host.clientWidth) return;
    const P = dark ? PAL.dark : PAL.light;

    // 车辆位置插值（导航逻辑每 0.25 秒给一个新位置）
    const t = Math.min(1, (now - moveT0) / moveDur);
    const base = [from.p[0] + (to.p[0] - from.p[0]) * t, from.p[1] + (to.p[1] - from.p[1]) * t];
    const heading = lerpAng(from.b, to.b, t);
    // 叠加 3D 画面里的横向位置（变道），向右为正
    const off = window.App && App.car && App.car.egoOffset != null ? App.car.egoOffset : 0;
    const hr = heading * Math.PI / 180;
    const car = [base[0] + Math.cos(hr) * off, base[1] - Math.sin(hr) * off];

    // 相机
    if (follow) { camT.x = car[0]; camT.y = car[1]; camT.rot = northUp ? 0 : heading; if (navMode) camT.z = 16.6; }
    if (!follow && navMode && Date.now() - lastUserMove > 8000) { follow = true; onUserMove && onUserMove(); }
    if (follow) { cam.x = car[0] + (cam.x - car[0]) * 0.5; cam.y = car[1] + (cam.y - car[1]) * 0.5; } else { cam.x += (camT.x - cam.x) * 0.16; cam.y += (camT.y - cam.y) * 0.16; }
    cam.rot = lerpAng(cam.rot, camT.rot, 0.12); cam.z += (camT.z - cam.z) * 0.1;
    layer.classList.toggle('tilt', navMode && follow);

    const W = cv.width, H = cv.height;
    AX = W / 2; AY = H * 0.71;
    const s = scaleOf(cam.z);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = P.ground; ctx.fillRect(0, 0, W, H);

    // 世界坐标变换（单位：米）
    ctx.setTransform(1, 0, 0, 1, AX, AY);
    ctx.rotate(-cam.rot * Math.PI / 180);
    ctx.scale(s, -s);
    ctx.translate(-cam.x, -cam.y);

    const rad = Math.hypot(W, H) / s * 0.62;
    const x0 = cam.x - rad, x1 = cam.x + rad, y0 = cam.y - rad, y1 = cam.y + rad;
    const i0 = Math.floor(x0 / G) - 1, i1 = Math.ceil(x1 / G) + 1, j0 = Math.floor(y0 / G) - 1, j1 = Math.ceil(y1 / G) + 1;
    const detail = s > 0.4, fine = s > 1.1;

    // 街区：建筑 / 公园 / 支路
    for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) drawCell(i, j, P, detail);

    // 江
    ctx.fillStyle = P.water; ctx.beginPath();
    const st = Math.max(20, 6 / s);
    for (let x = x0; x <= x1 + st; x += st) ctx.lineTo(x, riverY(x) + RIVER_W / 2);
    for (let x = x1 + st; x >= x0 - st; x -= st) ctx.lineTo(x, riverY(x) - RIVER_W / 2);
    ctx.fill();

    // 可行驶道路
    const edges = [];
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const k of [0, 1]) if (hasEdge(i, j, k)) edges.push({ i, j, k, pts: edge(i, j, k), major: isMajor(k, i, j) });
    const path = list => { const p = new Path2D(); list.forEach(e => e.pts.forEach((q, n) => n ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]))); return p; };
    const all = path(edges), majors = path(edges.filter(e => e.major));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = P.aveCase; ctx.lineWidth = HALF_AVE * 2 + Math.max(2, 3 / s); ctx.stroke(all);
    ctx.strokeStyle = P.ave; ctx.lineWidth = HALF_AVE * 2; ctx.stroke(all);
    ctx.strokeStyle = P.aveMajor; ctx.stroke(majors);
    if (fine) {
      ctx.lineCap = 'butt';
      const offPath = (o) => { const p = new Path2D(); edges.forEach(e => offsetPoly(e.pts, o).forEach((q, n) => n ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]))); return p; };
      ctx.lineWidth = 0.25; ctx.strokeStyle = P.mark; ctx.setLineDash([6, 9]);
      for (const o of [-laneOff(0.5), -laneOff(-0.5), laneOff(-0.5), laneOff(0.5)]) ctx.stroke(offPath(o));
      ctx.setLineDash([]); ctx.strokeStyle = P.median; ctx.lineWidth = 0.35;
      for (const o of [-MEDIAN / 2, MEDIAN / 2]) ctx.stroke(offPath(o));
      // 路口中央不画车道线
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const p = node(i, j);
        ctx.fillStyle = (isMajor(0, i, j) || isMajor(1, i, j)) && hasEdge(i, j, 0) && hasEdge(i, j, 2) && isMajor(0, i, j) ? P.aveMajor : P.ave;
        ctx.beginPath(); ctx.arc(p[0], p[1], HALF_AVE + 2, 0, 7); ctx.fill();
      }
    }

    // 路线
    if (routeR) {
      const strokeRoute = (list, color, w) => { ctx.strokeStyle = color; ctx.lineWidth = w / s; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); list.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); };
      const cut = cutAt(routeR, doneD);
      strokeRoute(cut.rest, P.routeCase, 16); strokeRoute(cut.rest, P.route, 11);
      if (cut.done.length > 1) strokeRoute(cut.done, P.done, 11);
    }

    // ---- 屏幕空间：文字、图标、车辆 ----
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawLabels(P, edges, s, x0, x1);
    if (showChargers) { visibleChargers = chargersNear([cam.x, cam.y], Math.ceil(rad / G) + 1); visibleChargers.forEach(c => drawCharger(project(toXY(c.ll)), c)); }
    PLACES.slice(0, 2).forEach(p => drawPOI(project(toXY(p.ll)), p, P));
    if (dest) drawDest(project(toXY(dest.ll)));
    drawCar(project(car), heading - cam.rot);
  }

  function offsetPoly(pts, o) {
    return pts.map((p, n) => {
      const a = pts[Math.max(0, n - 1)], b = pts[Math.min(pts.length - 1, n + 1)], r = right(norm(sub(b, a)));
      return [p[0] + r[0] * o, p[1] + r[1] * o];
    });
  }

  // 一个街区：四个路口围成的弯曲四边形，用双线性插值在里面布置支路和建筑
  function drawCell(i, j, P, detail) {
    const a = node(i, j), b = node(i + 1, j), c = node(i + 1, j + 1), d = node(i, j + 1);
    const f = (u, v) => [a[0] * (1 - u) * (1 - v) + b[0] * u * (1 - v) + c[0] * u * v + d[0] * (1 - u) * v, a[1] * (1 - u) * (1 - v) + b[1] * u * (1 - v) + c[1] * u * v + d[1] * (1 - u) * v];
    const quad = (u0, v0, u1, v1) => { ctx.beginPath(); const p = [f(u0, v0), f(u1, v0), f(u1, v1), f(u0, v1)]; ctx.moveTo(p[0][0], p[0][1]); for (let n = 1; n < 4; n++) ctx.lineTo(p[n][0], p[n][1]); ctx.closePath(); };
    const ctr = f(0.5, 0.5), nearRiver = Math.abs(ctr[1] - riverY(ctr[0])) < RIVER_W / 2 + 260;
    const kind = hash(i, j, 3);
    if (kind < 0.09) { ctx.fillStyle = P.park; quad(0, 0, 1, 1); ctx.fill(); return; } // 整块公园
    if (!detail) return;
    // 支路：u、v 方向各 1~3 条，位置随机
    const cutsU = cuts(i, j, 4), cutsV = cuts(i, j, 5);
    ctx.strokeStyle = P.streetCase; ctx.lineWidth = STREET + 1.5; drawStreets(f, cutsU, cutsV);
    ctx.strokeStyle = P.street; ctx.lineWidth = STREET; drawStreets(f, cutsU, cutsV);
    // 地块
    const us = [0, ...cutsU, 1], vs = [0, ...cutsV, 1];
    const mU = 22 / dist(a, b), mV = 22 / dist(a, d), sU = 8 / dist(a, b), sV = 8 / dist(a, d);
    for (let p = 0; p < us.length - 1; p++) for (let q = 0; q < vs.length - 1; q++) {
      const u0 = us[p] + (p ? sU : mU), u1 = us[p + 1] - (p + 1 < us.length - 1 ? sU : mU);
      const v0 = vs[q] + (q ? sV : mV), v1 = vs[q + 1] - (q + 1 < vs.length - 1 ? sV : mV);
      if (u1 <= u0 || v1 <= v0) continue;
      const r = hash(i * 7 + p, j * 7 + q, 9);
      const lc = f((u0 + u1) / 2, (v0 + v1) / 2);
      const wet = Math.abs(lc[1] - riverY(lc[0]));
      if (wet < RIVER_W / 2 + 10) continue;
      if (r < 0.1 || (nearRiver && wet < RIVER_W / 2 + 90)) { ctx.fillStyle = P.park; quad(u0, v0, u1, v1); ctx.fill(); continue; }
      if (r < 0.16) continue; // 广场 / 停车场
      ctx.fillStyle = P.block; quad(u0, v0, u1, v1); ctx.fill();
      // 沿街的楼：沿较长的一边排成一排，偶尔一栋大楼占满整个地块
      const n = r > 0.85 ? 1 : 2 + Math.floor(hash(i * 7 + p, j * 7 + q, 10) * 3);
      const du = u1 - u0, dv = v1 - v0, alongU = du * dist(a, b) > dv * dist(a, d);
      ctx.strokeStyle = P.bldgLine; ctx.lineWidth = 1;
      for (let k = 0; k < n; k++) {
        const h1 = hash(i * 7 + p, j * 7 + q, 20 + k), h2 = hash(i * 7 + p, j * 7 + q, 30 + k);
        ctx.fillStyle = P.bldg[k % 3];
        const gap = 0.06, w = (1 - gap * (n + 1)) / n, s0 = gap + k * (w + gap), dep = n === 1 ? 0.8 : 0.35 + h1 * 0.35, inset = 0.08 + h2 * 0.08;
        if (alongU) quad(u0 + du * s0, v0 + dv * inset, u0 + du * (s0 + w), v0 + dv * Math.min(0.92, inset + dep));
        else quad(u0 + du * inset, v0 + dv * s0, u0 + du * Math.min(0.92, inset + dep), v0 + dv * (s0 + w));
        ctx.fill(); ctx.stroke();
      }
    }
  }
  function cuts(i, j, salt) {
    const n = 1 + Math.floor(hash(i, j, salt) * 3), out = [];
    for (let k = 0; k < n; k++) out.push((k + 0.5 + (hash(i, j, salt * 10 + k) - 0.5) * 0.5) / n);
    return out;
  }
  function drawStreets(f, cu, cv) {
    ctx.beginPath();
    for (const u of cu) for (let k = 0; k <= 6; k++) { const p = f(u, k / 6); k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    for (const v of cv) for (let k = 0; k <= 6; k++) { const p = f(k / 6, v); k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    ctx.stroke();
  }

  function drawLabels(P, edges, s, x0, x1) {
    ctx.font = `600 ${s > 1.1 ? 22 : 19}px Inter, "PingFang SC", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 5; ctx.strokeStyle = P.textHalo; ctx.fillStyle = P.text;
    const put = (p, ang, text) => {
      let a = ang; while (a > 90) a -= 180; while (a <= -90) a += 180;
      ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(a * Math.PI / 180);
      ctx.strokeText(text, 0, 0); ctx.fillText(text, 0, 0); ctx.restore();
    };
    for (const e of edges) {
      const L = polyLen(e.pts) * s;
      // 每段路标一次名字；缩小后只给主干道隔段标
      if (L < 150) continue;
      if (L < 320 && !(e.major && mod(e.k % 2 ? e.i : e.j, 2) === 0)) continue;
      const pa = project(e.pts[5]), pb = project(e.pts[7]), mid = project(e.pts[6]);
      if (offscreen(mid)) continue;
      put(mid, Math.atan2(pb[1] - pa[1], pb[0] - pa[0]) * 180 / Math.PI, I18N.t(edgeName(e.i, e.j, e.k)));
    }
    // 江名
    const rp = project([cam.x, riverY(cam.x)]);
    if (!offscreen(rp)) { ctx.fillStyle = dark ? '#3c5a78' : '#6c93b8'; put(rp, -cam.rot, I18N.t('黄浦江')); }
  }
  const offscreen = p => p[0] < -100 || p[1] < -100 || p[0] > cv.width + 100 || p[1] > cv.height + 100;

  function drawCar(p, rot) {
    ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(rot * Math.PI / 180);
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#e82127'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(22, 26); ctx.lineTo(0, 15); ctx.lineTo(-22, 26); ctx.closePath();
    ctx.fill(); ctx.shadowColor = 'transparent'; ctx.stroke();
    ctx.restore();
  }
  function drawPOI(p, poi, P) {
    if (offscreen(p)) return;
    ctx.fillStyle = '#3e6ae1'; ctx.beginPath(); ctx.arc(p[0], p[1], 9, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
    ctx.font = '600 20px Inter, "PingFang SC", sans-serif'; ctx.textAlign = 'left';
    ctx.lineWidth = 5; ctx.strokeStyle = P.textHalo; ctx.fillStyle = dark ? '#cfcfcf' : '#2b2f36';
    ctx.strokeText(poi.name, p[0] + 16, p[1]); ctx.fillText(poi.name, p[0] + 16, p[1]);
    ctx.textAlign = 'center';
  }
  function drawDest(p) {
    ctx.save(); ctx.translate(p[0], p[1]);
    ctx.fillStyle = '#e31937'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-6, -14, -18, -22, -18, -36); ctx.arc(0, -36, 18, Math.PI, 0); ctx.bezierCurveTo(18, -22, 6, -14, 0, 0); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -36, 6, 0, 7); ctx.fill();
    ctx.restore();
  }
  function drawCharger(p, c) {
    if (offscreen(p)) return;
    const txt = `⚡ ${c.free}/${c.total}`;
    ctx.font = '700 18px Inter, sans-serif';
    const w = ctx.measureText(txt).width + 22;
    ctx.fillStyle = '#e31937';
    ctx.beginPath(); ctx.roundRect(p[0] - w / 2, p[1] - 46, w, 36, 14); ctx.fill();
    ctx.beginPath(); ctx.moveTo(p[0] - 7, p[1] - 11); ctx.lineTo(p[0] + 7, p[1] - 11); ctx.lineTo(p[0], p[1] - 3); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, p[0], p[1] - 28);
  }

  // ---------------- 路线几何 ----------------
  // 由道路中心线生成行驶线：整体向右偏到中间车道，并把路口处的急弯改成圆弧
  function buildLine(centers) {
    const c = centers.filter((p, i) => i === 0 || dist(p, centers[i - 1]) > 0.5);
    if (c.length < 2) c.push([c[0][0] + 1e-3, c[0][1] + 1]);
    const pts = c.map((p, k) => {
      const dIn = k > 0 ? norm(sub(p, c[k - 1])) : null, dOut = k < c.length - 1 ? norm(sub(c[k + 1], p)) : null;
      const rIn = dIn && right(dIn), rOut = dOut && right(dOut);
      let o;
      if (rIn && rOut) { const dot = 1 + rIn[0] * rOut[0] + rIn[1] * rOut[1]; o = dot > 0.2 ? [(rIn[0] + rOut[0]) / dot, (rIn[1] + rOut[1]) / dot] : rIn; }
      else o = rIn || rOut;
      return [p[0] + o[0] * LANE0, p[1] + o[1] * LANE0];
    });
    const out = [pts[0]];
    for (let k = 1; k < pts.length - 1; k++) {
      const a = pts[k - 1], b = pts[k], cc = pts[k + 1];
      const d1 = norm(sub(b, a)), d2 = norm(sub(cc, b));
      const turn = d1[0] * d2[1] - d1[1] * d2[0];
      if (Math.abs(turn) < 0.3) { out.push(b); continue; }
      const r = Math.min(turn < 0 ? 10 : 18, dist(a, b) / 2, dist(b, cc) / 2); // 右转半径小，左转半径大
      const p0 = [b[0] - d1[0] * r, b[1] - d1[1] * r], p2 = [b[0] + d2[0] * r, b[1] + d2[1] * r];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8, u = 1 - t;
        out.push([u * u * p0[0] + 2 * u * t * b[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * b[1] + t * t * p2[1]]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  function finishRoute(xy, steps, destPlace, dur) {
    const r = { xy, coords: xy.map(toLL), steps, dest: destPlace };
    r.cum = [0];
    for (let i = 1; i < xy.length; i++) r.cum.push(r.cum[i - 1] + dist(xy[i - 1], xy[i]));
    r.total = r.cum[r.cum.length - 1] || 1; r.dist = r.total; r.dur = dur || r.total / 13;
    return r;
  }
  function pointAt(r, d) {
    const c = r.cum; let i = 1;
    while (i < c.length - 1 && c[i] < d) i++;
    const a = r.xy[i - 1], b = r.xy[i], t = Math.max(0, Math.min(1, (d - c[i - 1]) / ((c[i] - c[i - 1]) || 1)));
    return { ll: toLL([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]), brg: brgXY(a, b), idx: i };
  }
  function cutAt(r, d) {
    if (d <= 0) return { done: [], rest: r.xy };
    const p = toXY(pointAt(r, d).ll); let i = 1;
    while (i < r.cum.length - 1 && r.cum[i] < d) i++;
    return { done: [...r.xy.slice(0, i), p], rest: [p, ...r.xy.slice(i)] };
  }

  // 车辆当前所在路段（同向一侧）
  const carEdge = () => nearestEdge(toXY(carLL), carBrg);
  const step = (n, k) => [n[0] + DIRS[k][0], n[1] + DIRS[k][1]];

  // 自由驾驶：沿道路往前开，路口大多直行，偶尔左右转
  function roadRoute(len = 3200) {
    const e = carEdge();
    const centers = subPoly(edge(e.i, e.j, e.k), e.along, e.len);
    let n = step([e.i, e.j], e.k), d = e.k, total = e.len - e.along;
    const js = [];
    while (total < len) {
      js.push(total);
      const opts = [0, 1, 3].map(t => (d + t) % 4).filter(k => hasEdge(n[0], n[1], k));
      const nd = opts.includes(d) && Math.random() < 0.72 ? d : opts[Math.floor(Math.random() * opts.length)];
      const pts = edge(n[0], n[1], nd);
      centers.push(...pts.slice(1)); total += polyLen(pts);
      n = step(n, nd); d = nd;
    }
    const xy = buildLine(centers);
    xy[0] = toXY(carLL); // 起点就是车辆当前所在位置，衔接无跳动
    const r = finishRoute(xy, [{ start: 0, dist: total, name: edgeName(e.i, e.j, e.k), type: 'depart', mod: '' }], { name: '自由驾驶', ll: toLL(centers[centers.length - 1]) });
    r.junctions = js.map(j => j * r.total / total);
    return r;
  }

  // 导航：在路网上找最短路线（不允许掉头），转弯有少量惩罚
  async function route(destPlace) {
    const e = carEdge(), tg = nearestEdge(toXY(destPlace.ll));
    const cur = edge(e.i, e.j, e.k);
    // segs：依次经过的路段（中心线 + 路名），最后统一生成行驶线和转弯指示
    let segs = null;
    // 目的地就在当前这段路的前方
    const sameEdge = (e.k < 2 ? e.i === tg.i && e.j === tg.j && e.k === tg.k : step([e.i, e.j], e.k)[0] === tg.i && step([e.i, e.j], e.k)[1] === tg.j && e.k - 2 === tg.k);
    const destAlong = sameEdge ? (e.k < 2 ? tg.along : tg.len - tg.along) : 0;
    if (sameEdge && destAlong > e.along + 20) segs = [{ pts: subPoly(cur, e.along, destAlong), name: edgeName(e.i, e.j, e.k) }];
    else {
      // 终点所在路段两端的路口，以及从那里出发的方向和剩余距离
      const B = step([tg.i, tg.j], tg.k);
      const goals = [{ n: [tg.i, tg.j], k: tg.k, len: tg.along }, { n: B, k: tg.k + 2, len: tg.len - tg.along }];
      const start = step([e.i, e.j], e.k);
      const key = (n, d) => n[0] + ',' + n[1] + ',' + d;
      const open = [{ n: start, d: e.k, cost: e.len - e.along, prev: null }];
      const seen = new Set();
      let best = null, guard = 0;
      while (open.length && guard++ < 30000) {
        let bi = 0; for (let q = 1; q < open.length; q++) if (open[q].cost < open[bi].cost) bi = q;
        const c = open.splice(bi, 1)[0];
        if (best && c.cost >= best.cost) break;
        const k = key(c.n, c.d); if (seen.has(k)) continue; seen.add(k);
        for (const g of goals) {
          if (g.n[0] !== c.n[0] || g.n[1] !== c.n[1] || g.k === (c.d + 2) % 4) continue;
          const total = c.cost + g.len + (g.k === c.d ? 0 : 150);
          if (!best || total < best.cost) best = { ...c, cost: total, goal: g };
        }
        for (const turn of [0, 1, 3]) {
          const nd = (c.d + turn) % 4;
          if (!hasEdge(c.n[0], c.n[1], nd)) continue;
          const nn = step(c.n, nd);
          if (Math.abs(nn[0] - start[0]) > 30 || Math.abs(nn[1] - start[1]) > 30) continue;
          open.push({ n: nn, d: nd, cost: c.cost + polyLen(edge(c.n[0], c.n[1], nd)) + (turn ? 150 : 0), prev: c, from: c.n, via: nd });
        }
      }
      if (!best) return roadRoute();
      const chain = []; for (let c = best; c && c.prev; c = c.prev) chain.unshift(c);
      segs = [{ pts: subPoly(cur, e.along, e.len), name: edgeName(e.i, e.j, e.k) }];
      chain.forEach(c => segs.push({ pts: edge(c.from[0], c.from[1], c.via), name: edgeName(c.from[0], c.from[1], c.via) }));
      const g = best.goal, gp = edge(g.n[0], g.n[1], g.k);
      segs.push({ pts: subPoly(gp, 0, g.len), name: edgeName(g.n[0], g.n[1], g.k) });
    }
    // 拼接中心线、计算转弯
    const centers = [], steps = [], js = [];
    let acc = 0;
    steps.push({ start: 0, dist: 0, name: segs[0].name, type: 'depart', mod: '' });
    segs.forEach((sg, n) => {
      if (n > 0) js.push(acc);
      if (n > 0 && centers.length > 1 && sg.pts.length > 1) {
        const p = sg.pts;
        const d1 = norm(sub(centers[centers.length - 1], centers[Math.max(0, centers.length - 3)])), d2 = norm(sub(p[Math.min(2, p.length - 1)], p[0]));
        const cr = d1[0] * d2[1] - d1[1] * d2[0], dot = d1[0] * d2[0] + d1[1] * d2[1];
        if (dot < 0.8) steps.push({ start: acc, dist: 0, name: sg.name, type: 'turn', mod: cr > 0 ? (dot > 0.45 ? 'slight left' : 'left') : (dot > 0.45 ? 'slight right' : 'right') });
      }
      sg.pts.forEach((p, k) => { if (centers.length && k === 0) return; if (centers.length) acc += dist(centers[centers.length - 1], p); centers.push(p); });
    });
    steps.push({ start: acc, dist: 0, name: destPlace.name, type: 'arrive', mod: '' });
    for (let i = 0; i < steps.length - 1; i++) steps[i].dist = steps[i + 1].start - steps[i].start;
    const xy = buildLine(centers);
    xy[0] = toXY(carLL);
    const r = finishRoute(xy, steps, destPlace, acc / 12.5);
    const k = r.total / (acc || 1); r.steps.forEach(s => { s.start *= k; s.dist *= k; });
    r.junctions = js.map(j => j * k);
    return r;
  }

  // ---------------- 搜索 ----------------
  async function search(q) {
    q = q.trim();
    const c = toXY(carLL);
    const near = chargersNear(c, 10).map(ch => ({ name: ch.name, addr: `${ch.kw} kW 超级充电 · ${ch.free}/${ch.total} 可用`, ll: ch.ll, icon: 'bolt' }));
    const all = [...PLACES, ...near];
    let res = all.filter(p => p.name.includes(q) || (p.addr || '').includes(q));
    // 道路名：导航到这条路上离车最近的一段
    const vi = V_NAMES.findIndex(n => q && (n + '路').includes(q)), hi = H_NAMES.findIndex(n => q && (n + '大道').includes(q));
    const nearIdx = (idx, len, cur) => idx + Math.round((cur - idx) / len) * len;
    if (vi >= 0) { const i = nearIdx(vi, V_NAMES.length, Math.round(c[0] / G)), j = Math.round(c[1] / G) + 2; res.push({ name: V_NAMES[vi] + '路', addr: '道路', ll: toLL(lerp2(node(i, j), node(i, j + 1), 0.5)), icon: 'pin' }); }
    if (hi >= 0) { const j = nearIdx(hi, H_NAMES.length, Math.round(c[1] / G)), i = Math.round(c[0] / G) + 2; res.push({ name: H_NAMES[hi] + '大道', addr: '道路', ll: toLL(lerp2(node(i, j), node(i + 1, j), 0.5)), icon: 'pin' }); }
    // 模拟城市里搜不到的名称：在 2~6 公里外“生成”一个同名地点，任何搜索都能导航
    if (!res.length && q) {
      let h = 0; for (const ch of q) h = (h * 31 + ch.charCodeAt(0)) | 0;
      const ang = hash(h, 1) * Math.PI * 2, km = 2 + hash(h, 2) * 4;
      const p = place(q, c[0] + Math.cos(ang) * km * 1000, c[1] + Math.sin(ang) * km * 1000, 1, 100 + Math.floor(hash(h, 4) * 1800), 'pin');
      res.push(p);
    }
    return res.map(p => ({ ...p, km: haversine(carLL, p.ll) / 1000 })).sort((a, b) => a.km - b.km).slice(0, 12);
  }

  // ---------------- 对外接口（与 map.js 一致） ----------------
  function setCar(ll, brg, opt = {}) {
    const now = performance.now();
    const t = Math.min(1, (now - moveT0) / moveDur);
    from = { p: [from.p[0] + (to.p[0] - from.p[0]) * t, from.p[1] + (to.p[1] - from.p[1]) * t], b: lerpAng(from.b, to.b, t) };
    to = { p: toXY(ll), b: brg };
    moveT0 = now; moveDur = Math.max(1, opt.duration ?? 600);
    if (dist(from.p, to.p) > 300) from = { ...to }; // 大跳跃（如重置）不做插值
    carLL = ll; carBrg = brg;
  }
  function recenter() { follow = true; camT.z = navMode ? 16.6 : 15.4; }
  function showRoute(r) { routeR = r; doneD = 0; dest = r.dest; fitRoute(r); }
  function fitRoute(r) {
    let ax = Infinity, ay = Infinity, bx = -Infinity, by = -Infinity;
    r.xy.forEach(([x, y]) => { ax = Math.min(ax, x); ay = Math.min(ay, y); bx = Math.max(bx, x); by = Math.max(by, y); });
    follow = false; lastUserMove = Date.now();
    camT.x = (ax + bx) / 2; camT.y = (ay + by) / 2; camT.rot = 0;
    const span = Math.max(bx - ax, (by - ay) * 1.2, 600);
    camT.z = Math.max(11, Math.min(16, 15 + Math.log2(host.clientWidth * 0.75 / (span * 0.6))));
    onUserMove && onUserMove();
  }
  function clearRoute() { routeR = null; dest = null; }
  function progress(r, d) { doneD = d; }
  function setChargers(on, onClick) {
    showChargers = on; chargerClick = onClick;
    if (on) { camT.z = 13.2; }
  }

  const api = {
    init, search, route, pointAt, showRoute, fitRoute, clearRoute, progress, setCar, recenter, setChargers,
    PLACES, CHARGERS, haversine, roadRoute, nearestChargers, sim: true,
    get ok() { return true; },
    get carLL() { return carLL; },
    get carBrg() { return carBrg; },
    get follow() { return follow; },
    setNav(on) { navMode = on; follow = true; camT.z = on ? 16.6 : 15.4; },
    toggleNorth() { northUp = !northUp; recenter(); return northUp; },
    get northUp() { return northUp; },
    setDark(v) { dark = v; },
    zoom(d) { camT.z = Math.max(11, Math.min(18, camT.z + d)); },
    resize,
    moveTo(parent, dz = 0) { parent.appendChild(host); if (dz) { follow = true; camT.z = Math.max(11, Math.min(18, camT.z + dz)); } setTimeout(resize, 30); },
    lookAt(ll, z) { follow = false; lastUserMove = Date.now(); const p = toXY(ll); camT.x = p[0]; camT.y = p[1]; camT.z = z || 15; onUserMove && onUserMove(); },
  };
  window.SimMap = api;
  if (MODE === 'sim') window.MapCtl = api;
})();
