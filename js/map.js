/* 地图与导航：MapLibre + OpenFreeMap 矢量瓦片（免 Key），OSRM 路线规划，Nominatim 地点搜索。
 * 任何网络服务不可用时都会自动降级（离线示意地图 / 模拟路线），界面不会卡住。
 */
(function () {
  const HOME = [121.4995, 31.2397]; // 默认位置：上海陆家嘴
  const R = 6371000;
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;

  function haversine(a, b) {
    const dLat = rad(b[1] - a[1]), dLng = rad(b[0] - a[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function bearing(a, b) {
    const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
    const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
    return (deg(Math.atan2(y, x)) + 360) % 360;
  }

  const PLACES = [
    { name: '家', addr: '浦东新区 · 世纪大道 88 号', ll: [121.5260, 31.2275], icon: 'home' },
    { name: '公司', addr: '静安区 · 南京西路 1266 号', ll: [121.4530, 31.2290], icon: 'work' },
    { name: '外滩', addr: '黄浦区 · 中山东一路', ll: [121.4903, 31.2400], icon: 'star' },
    { name: '上海虹桥站', addr: '闵行区 · 申贵路 1500 号', ll: [121.3203, 31.1946], icon: 'pin' },
    { name: '浦东国际机场', addr: '浦东新区 · 迎宾大道', ll: [121.8053, 31.1443], icon: 'pin' },
    { name: '上海迪士尼度假区', addr: '浦东新区 · 申迪西路 753 号', ll: [121.6573, 31.1440], icon: 'star' },
    { name: '特斯拉上海超级工厂', addr: '浦东新区 · 临港新片区', ll: [121.7731, 30.8796], icon: 'bolt' },
    { name: '前滩太古里', addr: '浦东新区 · 东育路 500 弄', ll: [121.4775, 31.1530], icon: 'pin' },
  ];
  const CHARGERS = [
    { name: '超级充电站 · 陆家嘴', ll: [121.5052, 31.2350], free: 9, total: 12, kw: 250 },
    { name: '超级充电站 · 新天地', ll: [121.4740, 31.2185], free: 4, total: 10, kw: 250 },
    { name: '超级充电站 · 静安寺', ll: [121.4460, 31.2240], free: 2, total: 8, kw: 150 },
    { name: '超级充电站 · 世博源', ll: [121.4940, 31.1880], free: 14, total: 20, kw: 250 },
    { name: '超级充电站 · 五角场', ll: [121.5140, 31.3010], free: 6, total: 12, kw: 250 },
    { name: '目的地充电 · 浦东嘉里', ll: [121.5600, 31.2120], free: 3, total: 4, kw: 11 },
  ];

  let map = null, ok = false, carMarker = null, carEl = null, destMarker = null, chargerMarkers = [];
  let follow = true, northUp = false, dark = false, navMode = false, onUserMove = null, lastUserMove = 0;
  let carLL = HOME.slice(), carBrg = 0;
  // 缓存地图节点：CarPlay 切换视图时它可能暂时不在文档中
  let mapEl = null;
  const host = () => mapEl || (mapEl = document.getElementById('map'));

  function init(opts) {
    onUserMove = opts.onUserMove;
    carEl = document.createElement('div');
    carEl.className = 'car-marker';
    carEl.innerHTML = '<div class="halo"></div><svg viewBox="0 0 24 24"><path d="M12 2.5 19.5 20 12 16l-7.5 4z"/></svg>';
    if (!window.maplibregl) return fallback();
    try {
      map = new maplibregl.Map({
        container: host(), style: 'https://tiles.openfreemap.org/styles/positron',
        center: HOME, zoom: 14.6, pitch: 0, bearing: 0, attributionControl: false,
        fadeDuration: 150, maxPitch: 70,
      });
    } catch (e) { return fallback(); }
    const failTimer = setTimeout(() => { if (!ok) fallback(); }, 9000);
    map.on('load', () => {
      ok = true; clearTimeout(failTimer);
      localizeLabels(); addRouteLayers(); applyPalette();
      carMarker = new maplibregl.Marker({ element: carEl, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat(carLL).addTo(map);
      map.resize();
      map.once('idle', placeStart);
    });
    map.on('error', e => { if (!ok && /style|Failed to fetch|NetworkError/i.test(String(e && e.error && e.error.message))) fallback(); });
    ['dragstart', 'rotatestart', 'pitchstart'].forEach(ev => map.on(ev, e => { if (e.originalEvent) { follow = false; lastUserMove = Date.now(); onUserMove && onUserMove(); } }));
    map.on('wheel', () => { /* 缩放不取消跟随 */ });
  }

  // 深色地图：把浅色底图逐层改成特斯拉导航那种深灰配色（比整体反色自然），切回浅色时还原
  let lightPaint = null;
  const DARK_SKIP = /^(route|done)/;
  function darkPaint(l) {
    const id = l.id;
    switch (l.type) {
      case 'background': return { 'background-color': '#17181a' };
      case 'fill':
        if (/water/.test(id)) return { 'fill-color': '#1b2129' };
        if (/park|wood|grass|landcover|landuse_park/.test(id)) return { 'fill-color': '#1a201c' };
        if (/building/.test(id)) return { 'fill-color': '#232427', 'fill-outline-color': '#2b2c30' };
        return { 'fill-color': '#1c1d1f' };
      case 'fill-extrusion': return { 'fill-extrusion-color': '#232427' };
      case 'line':
        if (/water|river|waterway/.test(id)) return { 'line-color': '#1b2129' };
        if (/boundary|admin/.test(id)) return { 'line-color': '#3a3a3c' };
        if (/rail|transit/.test(id)) return { 'line-color': '#2b2c30' };
        if (/casing/.test(id)) return { 'line-color': '#111213' };
        if (/motorway|trunk|primary|major/.test(id)) return { 'line-color': '#45464b' };
        return { 'line-color': '#333438' };
      case 'symbol': return { 'text-color': '#9a9ca1', 'text-halo-color': 'rgba(0,0,0,.85)', 'icon-opacity': 0.6 };
    }
    return {};
  }
  function applyPalette() {
    if (!ok) return;
    const layers = map.getStyle().layers.filter(l => !DARK_SKIP.test(l.id));
    if (!lightPaint) { lightPaint = {}; layers.forEach(l => { lightPaint[l.id] = { ...(l.paint || {}) }; }); }
    layers.forEach(l => {
      const dp = darkPaint(l), orig = lightPaint[l.id] || {};
      Object.keys(dp).forEach(k => {
        try { map.setPaintProperty(l.id, k, dark ? dp[k] : orig[k]); } catch (e) { /* 该图层不支持这个属性 */ }
      });
    });
  }

  // 起始位置：在默认位置附近的主干道上找一段最长的直路，车停在它中间、车头顺着道路
  // （固定坐标容易落在弯道或路口边；路网数据不变，所以每次刷新都停在同一个地方）
  function placeStart() {
    const l = map.getStyle().layers.find(l => l['source-layer'] === 'transportation');
    if (!l || haversine(carLL, HOME) > 1) return; // 已经开走了就不动
    const cands = [];
    for (const f of map.querySourceFeatures(l.source, { sourceLayer: 'transportation' })) {
      const pr = f.properties;
      if (!['trunk', 'primary', 'secondary'].includes(pr.class) || pr.brunnel || pr.ramp) continue;
      const g = f.geometry, lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
      for (const ln of lines) {
        let i0 = 0, len = 0;
        for (let i = 1; i <= ln.length; i++) {
          const bend = i < ln.length && i - i0 > 1 && angDiff(bearing(ln[i - 2], ln[i - 1]), bearing(ln[i - 1], ln[i])) > 3;
          if (i === ln.length || bend) { // 一段直线结束
            const a = ln[i0], b = ln[i - 1], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
            const far = haversine(mid, HOME), score = len - far * 0.4;
            if (len > 250 && far < 700) cands.push({ score, mid, brg: bearing(a, b) });
            i0 = i - 1; len = 0;
          }
          if (i < ln.length) len += haversine(ln[i - 1], ln[i]);
        }
      }
    }
    // 离路口至少 70 米（道路数据里一条线常常直接穿过路口，中点可能刚好落在路口边）
    const nodes = roadGraph(), junc = nodes ? [...nodes.values()].filter(n => n.nb.size >= 3) : [];
    const best = cands.sort((a, b) => b.score - a.score).find(c => junc.every(n => haversine(n.ll, c.mid) > 70)) || cands[0];
    if (!best) return;
    carLL = best.mid; carBrg = best.brg;
    carMarker.setLngLat(carLL).setRotation(carBrg);
    map.jumpTo({ center: carLL, bearing: northUp ? 0 : carBrg });
  }

  // 显示中文名称
  function localizeLabels() {
    map.getStyle().layers.forEach(l => {
      if (l.type === 'symbol' && l.layout && l.layout['text-field']) {
        try { map.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']]); } catch (e) {}
      }
    });
  }
  function addRouteLayers() {
    map.addSource('route', { type: 'geojson', data: line([]) });
    map.addSource('done', { type: 'geojson', data: line([]) });
    map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1d47b8', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 6, 16, 14] } });
    map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#3e7bfa', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4, 16, 10] } });
    map.addLayer({ id: 'done-line', type: 'line', source: 'done', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#9aa3b0', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4, 16, 10] } });
  }
  const line = coords => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } });

  // 离线降级：画一张示意地图
  function fallback() {
    if (map) { try { map.remove(); } catch (e) {} map = null; }
    ok = false;
    const el = host(); el.innerHTML = '';
    el.classList.add('offline-map');
    const c = document.createElement('canvas'); el.appendChild(c);
    const draw = () => {
      const w = el.clientWidth, h = el.clientHeight; c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.fillStyle = '#eef0f1'; g.fillRect(0, 0, w, h);
      let s = 7; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
      g.fillStyle = '#dceadb';
      for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 60 + rnd() * 120, 40 + rnd() * 80, rnd() * 3, 0, 7); g.fill(); }
      g.strokeStyle = '#c9dceb'; g.lineWidth = 46; g.beginPath(); g.moveTo(w * 0.62, -20); g.bezierCurveTo(w * 0.5, h * 0.4, w * 0.85, h * 0.6, w * 0.7, h + 20); g.stroke();
      g.strokeStyle = '#ffffff';
      for (let i = 0; i < 26; i++) {
        g.lineWidth = i < 5 ? 12 : 6;
        g.beginPath(); const vert = rnd() > 0.5, p = rnd();
        if (vert) { g.moveTo(p * w, 0); g.lineTo(p * w + (rnd() - 0.5) * 200, h); } else { g.moveTo(0, p * h); g.lineTo(w, p * h + (rnd() - 0.5) * 200); }
        g.stroke();
      }
      g.fillStyle = '#9aa1a8'; g.font = '500 15px Inter, sans-serif';
      ['陆家嘴', '外滩', '世纪大道', '人民广场', '黄浦江'].forEach((n, i) => g.fillText(I18N.t(n), 80 + i * 210 % (w - 160), 120 + (i * 173) % (h - 200)));
    };
    draw(); new ResizeObserver(draw).observe(el);
    carEl.classList.add('static'); el.appendChild(carEl);
    const note = document.createElement('div'); note.className = 'offline-note'; note.textContent = '离线示意地图 · 联网后显示实时矢量地图';
    el.appendChild(note);
  }

  // ---------------- 地点搜索 ----------------
  async function search(q) {
    q = q.trim();
    const local = PLACES.filter(p => p.name.includes(q) || p.addr.includes(q));
    let remote = [];
    if (q.length >= 2) {
      try {
        const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 5000);
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=${I18N.locale()}&q=${encodeURIComponent(q)}&viewbox=120.8,31.9,122.2,30.6`;
        const res = await fetch(url, { signal: ctrl.signal });
        const js = await res.json();
        remote = js.map(r => ({ name: r.name || r.display_name.split(',')[0], addr: r.display_name.split(',').slice(1, 4).join(' · '), ll: [+r.lon, +r.lat], icon: 'pin' }));
      } catch (e) { /* 离线 */ }
    }
    return [...local, ...remote].map(p => ({ ...p, km: haversine(carLL, p.ll) / 1000 }));
  }

  // ---------------- 路线规划 ----------------
  async function route(dest) {
    let r = null;
    try {
      const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 7000);
      const url = `https://router.project-osrm.org/route/v1/driving/${carLL[0]},${carLL[1]};${dest.ll[0]},${dest.ll[1]}?overview=full&geometries=geojson&steps=true`;
      const js = await (await fetch(url, { signal: ctrl.signal })).json();
      const rt = js.routes && js.routes[0];
      if (rt) {
        let acc = 0;
        const steps = rt.legs[0].steps.map(s => {
          const st = { start: acc, dist: s.distance, name: s.name || s.ref || '', type: s.maneuver.type, mod: s.maneuver.modifier || '' };
          acc += s.distance; return st;
        });
        r = { coords: rt.geometry.coordinates, dist: rt.distance, dur: rt.duration, steps };
        // 路口：OSRM 每一步都带途经的交叉口，三条路以上相交的算路口（画红绿灯、斑马线）
        r.ix = rt.legs[0].steps.flatMap(s => s.intersections || []).filter(x => x.bearings && x.bearings.length >= 3).map(x => x.location);
      }
    } catch (e) { /* 降级 */ }
    if (!r) r = fakeRoute(dest);
    r.dest = dest;
    measure(r);
    if (r.ix) { r.junctions = sparse(r.ix.map(ll => alongRoute(r, ll))); delete r.ix; }
    return r;
  }
  // 候选路口：去掉挨得很近的重复点。是不是真的路口，开到附近时再用地图路网核对（junctionOk）
  function sparse(ds) {
    const out = [];
    ds.sort((a, b) => a - b).forEach(d => { if (d > 30 && (!out.length || d - out[out.length - 1] > 25)) out.push(d); });
    return out;
  }

  // 核对路口：OSRM 把小区 / 停车场出入口、辅路、匝道汇入都算作路口，地图上看不出来。
  // 车开到附近时（这一带的矢量瓦片已加载），在地图路网里找这个点，只有确实有机动车道路
  // 从左或右横向接入（夹角 45°～135°）才算路口；相邻路口至少隔 120 米，免得到处是红绿灯
  let graph = null, graphT = 0;
  function junctionOk(r, d) {
    const c = r._jc || (r._jc = new Map());
    if (c.has(d)) return c.get(d);
    if (!ok || haversine(carLL, pointAt(r, d).ll) > 320) return false; // 太远：瓦片可能没加载，先不判断
    const now = performance.now();
    if (!graph || now - graphT > 2000) { graph = roadGraph(); graphT = now; }
    if (!graph) return false;
    const p = pointAt(r, d), h = p.brg;
    let node = null, best = 22; // 22 米内最近的路网节点
    for (const n of graph.values()) { if (n.nb.size < 3) continue; const dd = haversine(p.ll, n.ll); if (dd < best) { best = dd; node = n; } }
    let cross = false;
    if (node) for (const m of node.nb) { const t = angDiff(bearing(node.ll, m.ll), h); if (t > 45 && t < 135) { cross = true; break; } }
    const v = r._jv || (r._jv = []);
    const res = cross && !v.some(x => Math.abs(x - d) < 120);
    if (res) v.push(d);
    c.set(d, res);
    return res;
  }
  // 某点在路线上的里程（取最近的折线顶点）
  function alongRoute(r, ll) {
    let bi = 0, bd = Infinity;
    r.coords.forEach((c, i) => { const d = (c[0] - ll[0]) ** 2 + (c[1] - ll[1]) ** 2; if (d < bd) { bd = d; bi = i; } });
    return r.cum[bi];
  }
  function measure(r) {
    r.cum = [0];
    for (let i = 1; i < r.coords.length; i++) r.cum.push(r.cum[i - 1] + haversine(r.coords[i - 1], r.coords[i]));
    r.total = r.cum[r.cum.length - 1] || 1;
    // 用几何长度修正步骤起点比例
    const k = r.total / (r.dist || r.total);
    r.steps.forEach(s => { s.start *= k; s.dist *= k; });
    return r;
  }

  // ---------------- 沿真实道路“自由驾驶” ----------------
  // 不依赖路线服务：读取地图已加载的矢量瓦片里的道路，拼成路网，从当前位置顺着路往前开
  // （路口大多直行，偶尔左右转；走到已加载区域的边缘就结束，下一段会在地图跟上后重新生成）
  const DRIVABLE = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor']);
  let roadSrc;
  const angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  function roadGraph() {
    if (roadSrc === undefined) { const l = map.getStyle().layers.find(l => l['source-layer'] === 'transportation'); roadSrc = l ? l.source : null; }
    if (!roadSrc) return null;
    const nodes = new Map();
    const key = p => Math.round(p[0] * 2e4) + ',' + Math.round(p[1] * 2e4); // 约 5 米的网格：合并瓦片边界处断开的端点
    const node = p => { const k = key(p); let n = nodes.get(k); if (!n) nodes.set(k, n = { k, ll: p, nb: new Set() }); return n; };
    for (const f of map.querySourceFeatures(roadSrc, { sourceLayer: 'transportation' })) {
      if (!DRIVABLE.has(f.properties.class)) continue;
      const g = f.geometry;
      const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
      for (const ln of lines) for (let i = 1; i < ln.length; i++) {
        const a = node(ln[i - 1]), b = node(ln[i]);
        if (a !== b) { a.nb.add(b); b.nb.add(a); }
      }
    }
    return nodes;
  }
  function roadRoute(len = 2500) {
    if (!ok) return null;
    const nodes = roadGraph(); if (!nodes || !nodes.size) return null;
    // 起点：离车最近、且能顺着当前朝向开出去的路网节点
    let cur = null, best = Infinity;
    for (const n of nodes.values()) {
      const d = haversine(carLL, n.ll); if (d > 220) continue;
      let turn = 180;
      for (const m of n.nb) turn = Math.min(turn, angDiff(bearing(n.ll, m.ll), carBrg));
      const score = d + turn * 1.5;
      if (score < best) { best = score; cur = n; }
    }
    if (!cur) return null;
    const coords = [carLL.slice(), cur.ll], seen = new Set([cur.k]);
    let prev = null, h = carBrg, total = haversine(carLL, cur.ll);
    const js = [];
    while (total < len) {
      if (cur.nb.size >= 3) js.push(total);
      const opts = [...cur.nb].filter(m => m !== prev).map(m => { const b = bearing(cur.ll, m.ll); return { m, b, t: angDiff(b, h) }; }).sort((a, b) => a.t - b.t);
      if (!opts.length) break;
      let pick = opts[0];
      // 真正的路口：有一定概率左转或右转
      const turns = opts.filter(o => o.t > 50 && o.t < 130);
      if (turns.length && opts[0].t < 35 && Math.random() < 0.2) pick = turns[Math.floor(Math.random() * turns.length)];
      if (pick.t > 150 || seen.has(pick.m.k)) break; // 只剩掉头或绕回原处
      prev = cur; cur = pick.m; h = pick.b; seen.add(cur.k);
      total += haversine(prev.ll, cur.ll); coords.push(cur.ll);
    }
    if (total < 80) return null;
    const r = measure({ coords, dist: total, dur: total / 12, steps: [{ start: 0, dist: total, name: '', type: 'depart', mod: '' }], dest: { name: '自由驾驶', ll: cur.ll } });
    r.junctions = sparse(js);
    return r;
  }
  // 没有网络时：生成一条“曼哈顿式”折线路线
  function fakeRoute(dest) {
    const a = carLL, b = dest.ll, mid1 = [a[0] + (b[0] - a[0]) * 0.35, a[1]], mid2 = [a[0] + (b[0] - a[0]) * 0.35, b[1]];
    const coords = [];
    const seg = (p, q, n) => { for (let i = 0; i < n; i++) coords.push([p[0] + (q[0] - p[0]) * i / n, p[1] + (q[1] - p[1]) * i / n]); };
    seg(a, mid1, 30); seg(mid1, mid2, 30); seg(mid2, b, 30); coords.push(b);
    const d1 = haversine(a, mid1), d2 = haversine(mid1, mid2), d3 = haversine(mid2, b);
    const turn1 = (b[1] > a[1]) === (b[0] > a[0]) ? 'left' : 'right';
    return {
      fake: true, coords, dist: d1 + d2 + d3, dur: (d1 + d2 + d3) / 9,
      steps: [
        { start: 0, dist: d1, name: '世纪大道', type: 'depart', mod: '' },
        { start: d1, dist: d2, name: '浦东南路', type: 'turn', mod: turn1 },
        { start: d1 + d2, dist: d3, name: '目的地道路', type: 'turn', mod: turn1 === 'left' ? 'right' : 'left' },
        { start: d1 + d2 + d3, dist: 0, name: dest.name, type: 'arrive', mod: '' },
      ],
    };
  }
  // 沿路线距离 d 处的坐标与朝向
  function pointAt(r, d) {
    const c = r.cum; let i = 1;
    while (i < c.length - 1 && c[i] < d) i++;
    const a = r.coords[i - 1], b = r.coords[i], segLen = (c[i] - c[i - 1]) || 1;
    const t = Math.max(0, Math.min(1, (d - c[i - 1]) / segLen));
    return { ll: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], brg: bearing(a, b), idx: i };
  }

  function showRoute(r) {
    if (!ok) return;
    map.getSource('route').setData(line(r.coords));
    map.getSource('done').setData(line([]));
    if (destMarker) destMarker.remove();
    const el = document.createElement('div'); el.className = 'dest-marker'; el.innerHTML = window.icon('flag', 18);
    destMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(r.dest.ll).addTo(map);
    fitRoute(r);
  }
  function fitRoute(r) {
    if (!ok) return;
    const b = new maplibregl.LngLatBounds(r.coords[0], r.coords[0]);
    r.coords.forEach(c => b.extend(c));
    follow = false; lastUserMove = Date.now();
    map.fitBounds(b, { padding: { top: 160, bottom: 200, left: 520, right: 120 }, duration: 1200, bearing: 0, pitch: 0 });
  }
  function clearRoute() {
    if (!ok) return;
    map.getSource('route').setData(line([])); map.getSource('done').setData(line([]));
    if (destMarker) { destMarker.remove(); destMarker = null; }
  }
  function progress(r, d) {
    if (!ok) return;
    const p = pointAt(r, d);
    map.getSource('done').setData(line([...r.coords.slice(0, p.idx), p.ll]));
  }

  function setCar(ll, brg, opt = {}) {
    carLL = ll; carBrg = brg;
    if (!ok) { carEl.style.transform = `rotate(${brg}deg)`; return; }
    carMarker && carMarker.setLngLat(ll).setRotation(brg);
    // 行驶中拖动地图后，8 秒无操作自动回到跟随车辆
    if (!follow && navMode && Date.now() - lastUserMove > 8000) { follow = true; onUserMove && onUserMove(); }
    if (follow) {
      map.easeTo({
        center: ll, bearing: northUp ? 0 : brg, // 默认车头朝上：地图旋转，车标始终指向上方
        pitch: navMode ? 52 : 0, zoom: opt.zoom || (navMode ? 16.6 : map.getZoom()),
        duration: opt.duration ?? 600, easing: t => t, padding: navMode ? { top: 260, bottom: 0, left: 0, right: 0 } : { top: 0, bottom: 0, left: 0, right: 0 },
      });
    }
  }
  function recenter() {
    follow = true;
    if (ok) map.easeTo({ center: carLL, zoom: navMode ? 16.6 : 15, bearing: northUp ? 0 : carBrg, pitch: navMode ? 52 : 0, duration: 900 });
  }

  function setChargers(on, onClick) {
    chargerMarkers.forEach(m => m.remove()); chargerMarkers = [];
    if (!on || !ok) return;
    CHARGERS.forEach(c => {
      const el = document.createElement('button'); el.className = 'charger-pin';
      el.innerHTML = window.icon('bolt', 16) + `<span>${c.free}/${c.total}</span>`;
      el.onclick = ev => { ev.stopPropagation(); onClick(c); };
      chargerMarkers.push(new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(c.ll).addTo(map));
    });
    map.easeTo({ zoom: 12.6, center: carLL, duration: 900 });
  }

  window.RealMap = window.MapCtl = {
    init, search, route, pointAt, showRoute, fitRoute, clearRoute, progress, setCar, recenter, setChargers,
    PLACES, CHARGERS, haversine, roadRoute, junctionOk,
    get ok() { return ok; },
    get carLL() { return carLL; },
    get carBrg() { return carBrg; },
    get follow() { return follow; },
    setNav(on) { navMode = on; follow = true; },
    toggleNorth() { northUp = !northUp; recenter(); return northUp; },
    get northUp() { return northUp; },
    setDark(v) { dark = v; host().classList.toggle('dark', v); applyPalette(); },
    zoom(d) { if (ok) map.easeTo({ zoom: map.getZoom() + d, duration: 300 }); },
    resize() { if (ok) map.resize(); },
    // dz：移过去后缩放的级数（车辆视图展开时地图缩到右上角，看大一点范围）；移动后对准车辆，免得车标跑出小框
    moveTo(parent, dz = 0) {
      parent.appendChild(host());
      setTimeout(() => { if (!ok) return; map.resize(); follow = true; map.jumpTo({ center: carLL, zoom: map.getZoom() + dz, bearing: northUp ? 0 : carBrg, padding: { top: 0, bottom: 0, left: 0, right: 0 } }); }, 30);
    },
    lookAt(ll, z) { if (ok) { follow = false; lastUserMove = Date.now(); map.easeTo({ center: ll, zoom: z || 15, duration: 900 }); } },
  };
})();
