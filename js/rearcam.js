/* 倒车影像渲染器（程序生成，无外部素材）
 * RearCam.draw(canvas, view, now, {gear, speed, panel})  —— 渲染一帧（view: rear / front / left / right）
 * RearCam.buildPanel(rootEl)                              —— 构建倒车影像面板 DOM（画布、按钮、横向来车红条、泊车辅助小窗）
 *
 * 画面是一个小型 3D 世界（停车场通道 + 两侧车位、路沿、树、路灯、远处楼宇），
 * 用针孔投影 + 桶形畸变（模拟广角后摄镜头）逐点投影到 2D 画布，所以停车线、辅助线都会自然弯曲。
 * 世界随车速滚动，方向盘转角（自动缓摆 / 在画面上左右拖动 / 滚轮）会让车头朝向改变，辅助线随之弯曲。
 */
(function () {
  'use strict';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const cc = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;
  function hash(i, s) { let h = (Math.imul(i | 0, 374761393) + Math.imul(s | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  const FOG = [190, 207, 226];
  const fogAt = d => Math.min(0.94, 1 - Math.exp(-Math.max(0, d - 3) / 72));
  function rgb(c, k, fog, a) {
    let r = c[0] * k, g = c[1] * k, b = c[2] * k;
    if (fog > 0) { r += (FOG[0] - r) * fog; g += (FOG[1] - g) * fog; b += (FOG[2] - b) * fog; }
    return a == null ? `rgb(${cc(r)},${cc(g)},${cc(b)})` : `rgba(${cc(r)},${cc(g)},${cc(b)},${a})`;
  }
  const SUN = (() => { const v = [-0.35, 0.78, -0.52], l = Math.hypot(...v); return v.map(x => x / l); })();
  const lit = (nx, ny, nz) => 0.5 + 0.58 * Math.max(0, nx * SUN[0] + ny * SUN[1] + nz * SUN[2]);

  // ---------------------------------------------------------------- 世界参数
  const AISLE = 3.3, PITCH = 2.5, STALLS_PER = 16, PERIOD = PITCH * STALLS_PER, WRAP = PERIOD * 10; // 通道半宽、车位间距、400 m 一循环
  const isGapStall = i => { const m = ((i % STALLS_PER) + STALLS_PER) % STALLS_PER; return m >= 5 && m <= 7; }; // 每 40 m 一条横向车道（无车位）
  const LANE_C = 16.25; // 车道中心（相对周期起点）
  const PAINTS = [[232, 234, 236], [232, 234, 236], [172, 178, 184], [172, 178, 184], [34, 36, 40], [34, 36, 40], [38, 60, 100], [158, 30, 36], [98, 102, 108], [198, 186, 162], [42, 80, 64], [214, 214, 218]];
  const PROFS = {
    sedan: { len: 4.7, p: [[0, .30, .86], [0, .72, .90], [.10, .96, .89], [.95, 1.0, .88], [1.55, 1.43, .74], [2.75, 1.45, .74], [3.35, 1.02, .86], [4.30, .90, .88], [4.50, .70, .86], [4.50, .30, .84]] },
    suv: { len: 4.6, p: [[0, .34, .90], [0, .92, .92], [.06, 1.12, .90], [.30, 1.16, .89], [.62, 1.64, .78], [2.95, 1.66, .78], [3.55, 1.16, .88], [4.35, 1.00, .90], [4.60, .78, .88], [4.60, .34, .86]] },
    hatch: { len: 4.2, p: [[0, .30, .84], [0, .80, .88], [.05, 1.0, .87], [.40, 1.08, .86], [1.0, 1.42, .74], [2.45, 1.44, .74], [3.00, 1.02, .85], [3.85, .88, .86], [4.20, .68, .84], [4.20, .30, .82]] },
  };
  const VIEWS = {
    rear: { yaw: 0, ax: 0, az: 0, h: 0.95, hfov: 1.95, hz: 0.405, K: 0.42, mir: 1, bumper: true, guides: true, label: '后视摄像头' },
    front: { yaw: Math.PI, ax: 0, az: -4.7, h: 0.85, hfov: 1.85, hz: 0.43, K: 0.40, mir: -1, bumper: false, guides: false, label: '前视摄像头' },
    left: { yaw: -0.5, ax: -1.02, az: -2.1, h: 1.05, hfov: 1.7, hz: 0.42, K: 0.30, mir: 1, side: -1, label: '左侧 B 柱' },
    right: { yaw: 0.5, ax: 1.02, az: -2.1, h: 1.05, hfov: 1.7, hz: 0.42, K: 0.30, mir: 1, side: 1, label: '右侧 B 柱' },
  };

  // ---------------------------------------------------------------- 模拟状态
  const sim = {
    lastNow: -1, t: 0, X: 0, Z: 6, psi: 0, steer: 0, userSteer: 0, userUntil: 0,
    cross: [], nextSpawn: 2.2, spawnN: 0, alert: 0, alertSide: 0, alertAt: -99, assist: [9, 9, 9], minD: 9,
    thumbsOn: true, thumbsT: 1, assistOn: true, fault: false, frame: 0,
  };
  const CAR_L = 2.9, MAX_WHEEL = 0.5;

  function stepSim(now, speedKmh, gear, panel) {
    if (sim.lastNow === now) return;
    const dt = sim.lastNow < 0 ? 0 : clamp((now - sim.lastNow) / 1000, 0, 0.1);
    sim.lastNow = now; sim.t += dt; sim.frame++;
    // 方向盘：自动缓摆；用户拖动 / 滚轮后保持一段时间
    const auto = Math.sin(sim.t * 0.42) * 0.5 + Math.sin(sim.t * 0.17 + 1) * 0.2;
    const tgt = now < sim.userUntil ? sim.userSteer : auto;
    sim.steer += (tgt - sim.steer) * Math.min(1, dt * (now < sim.userUntil ? 6 : 1.6));
    // 车辆运动：倒挡沿车尾方向（+）运动，其余档位向前（−）
    const v = (gear === 'R' ? 1 : -1) * (speedKmh || 0) / 3.6;
    if (dt > 0 && Math.abs(v) > 0.001) {
      sim.psi += v / CAR_L * Math.tan(sim.steer * MAX_WHEEL) * dt;
      sim.psi -= sim.psi * 0.10 * dt; // 缓慢回正，避免跑出通道
      sim.psi = clamp(sim.psi, -0.5, 0.5);
      sim.X += Math.sin(sim.psi) * v * dt; sim.Z += Math.cos(sim.psi) * v * dt;
      sim.X = clamp(sim.X, -2.3, 2.3);
      if (sim.Z >= WRAP) { sim.Z -= WRAP; sim.cross.forEach(o => { o.z -= WRAP; }); }
      if (sim.Z < 0) { sim.Z += WRAP; sim.cross.forEach(o => { o.z += WRAP; }); }
    }
    // 横向来车 / 行人
    for (const o of sim.cross) { o.x += o.vx * dt; o.ph += Math.abs(o.vx) * dt * 1.9; }
    sim.cross = sim.cross.filter(o => Math.abs(o.x) < 32);
    sim.nextSpawn -= dt;
    if (sim.nextSpawn <= 0 && !sim.cross.length) {
      const k = Math.ceil((sim.Z + 8 - LANE_C) / PERIOD), lz = LANE_C + k * PERIOD, ahead = lz - sim.Z;
      if (ahead >= 8 && ahead <= 44) {
        const n = ++sim.spawnN, ped = hash(n, 11) < 0.4, dirx = hash(n, 5) < 0.5 ? 1 : -1;
        if (ped) sim.cross.push({ type: 'ped', x: -dirx * 11, z: lz + (hash(n, 6) - 0.5) * 3, vx: dirx * (1.1 + hash(n, 7) * 0.5), ph: 0, col: hash(n, 8), n });
        else sim.cross.push({ type: 'car', x: -dirx * 24, z: lz + (hash(n, 6) - 0.5) * 1.6 - 0.6 * dirx * 0, vx: dirx * (5.5 + hash(n, 7) * 3), ph: 0, n, paint: PAINTS[(n * 5 + 2) % PAINTS.length], prof: n % 3 === 0 ? 'suv' : n % 3 === 1 ? 'sedan' : 'hatch' });
        sim.nextSpawn = 8 + hash(n, 9) * 6;
      } else sim.nextSpawn = 0.6;
    }
    // 后方横向来车预警（RCTA）
    let al = 0, side = 0;
    for (const o of sim.cross) {
      const rx = o.x - sim.X, dz = o.z - sim.Z;
      if (dz < 3 || dz > 36 || Math.abs(rx) > 30) continue;
      if (rx * o.vx < 0 || Math.abs(rx) < 3.2) { al = 1; side = Math.abs(rx) < 3.2 ? -Math.sign(o.vx) : Math.sign(rx); }
    }
    if (al && !sim.alert && panel && now - sim.alertAt > 5000 && window.Sound) { sim.alertAt = now; try { Sound.play('warn'); } catch (e) {} }
    sim.alert = al; sim.alertSide = side;
    // 泊车辅助：左 / 中 / 右三个扇区到最近障碍物的距离（米）
    const A = [9, 9, 9];
    const probe = (wx, wz) => {
      const rx = wx - sim.X, rz = wz - sim.Z;
      const x = rx * Math.cos(sim.psi) - rz * Math.sin(sim.psi), z = rx * Math.sin(sim.psi) + rz * Math.cos(sim.psi);
      if (z < -0.4 || z > 3.4 || Math.abs(x) > 3.4) return;
      const d = Math.hypot(Math.max(Math.abs(x) - 0.98, 0), Math.max(z, 0)), s = x < -0.4 ? 0 : x > 0.4 ? 2 : 1;
      if (d < A[s]) A[s] = d;
    };
    const c0 = Math.floor((sim.Z - 3) / CONE_GAP) - 1;
    for (let k = c0; k < c0 + 4; k++) { const c = coneAt(k); probe(c.x, c.z); }
    for (const o of sim.cross) { probe(o.x, o.z); if (o.type === 'car') { probe(o.x - 2.2, o.z); probe(o.x + 2.2, o.z); } }
    for (let i = Math.floor(sim.Z / PITCH) - 2; i < Math.floor(sim.Z / PITCH) + 3; i++) {
      if (isGapStall(i) || hash(i, 21) > 0.82) continue; const z = (i + 0.5) * PITCH;
      probe(-AISLE - 0.35, z); probe(AISLE + 0.35, z);
    }
    sim.assist = A; sim.minD = Math.min(A[0], A[1], A[2]);
    sim.thumbsT += ((sim.thumbsOn ? 1 : 0) - sim.thumbsT) * Math.min(1, dt * 8);
  }
  const CONE_GAP = 23;
  function coneAt(k) { const s = hash(k, 31) < 0.5 ? -1 : 1; return { x: s * (2.0 + hash(k, 32) * 0.7), z: k * CONE_GAP + 5 + hash(k, 33) * 8 }; }

  // ---------------------------------------------------------------- 相机 / 投影
  const C = { W: 1, H: 1, x: 0, y: 1, z: 0, cY: 1, sY: 0, cP: 1, sP: 0, f: 1, cx: 0, cy: 0, K: 0.4, A: 1, n0: 1, mir: 1, seg: 30 };
  const NEAR = 0.25, T = [0, 0, 0], P2 = [0, 0];
  function setup(W, H, p) {
    C.W = W; C.H = H; C.x = p.x; C.y = p.y; C.z = p.z; C.mir = p.mir;
    C.cY = Math.cos(p.yaw); C.sY = Math.sin(p.yaw);
    C.f = (W / 2) / Math.tan(p.hfov / 2); C.cx = W / 2; C.cy = H / 2;
    const ph = Math.atan((C.cy - H * p.hz) / C.f); C.cP = Math.cos(ph); C.sP = Math.sin(ph);
    C.K = p.K; C.A = C.f * 0.62 / p.K; const re = W / 2; C.n0 = re / (C.A * Math.atan(re / C.A));
    C.seg = Math.max(18, W / 18);
  }
  function cam(x, y, z) {
    const rx = x - C.x, ry = y - C.y, rz = z - C.z;
    const xp = (rx * C.cY - rz * C.sY) * C.mir, zp = rx * C.sY + rz * C.cY;
    T[0] = xp; T[1] = ry * C.cP + zp * C.sP; T[2] = -ry * C.sP + zp * C.cP; return T;
  }
  function camLocal(x, y, z) { // 车体坐标（相机在车尾，x 向右，z 向后）→ 相机空间；用于辅助线
    const ry = y - C.y; T[0] = x * C.mir; T[1] = ry * C.cP + z * C.sP; T[2] = -ry * C.sP + z * C.cP; return T;
  }
  function proj(xc, vu, d) { // 针孔投影 + 鱼眼式径向压缩（r' = A·atan(r/A)，单调有界，不会折返）
    if (d < NEAR) d = NEAR; const iz = C.f / d, u = xc * iz, v = vu * iz, r = Math.sqrt(u * u + v * v);
    const s = r < 1e-6 ? C.n0 : C.n0 * C.A * Math.atan(r / C.A) / r;
    P2[0] = C.cx + u * s; P2[1] = C.cy - v * s; return P2;
  }
  // 多边形路径：世界坐标，近平面裁剪 + 边细分（让直线在桶形畸变下弯曲）
  function polyPath(g, pts, sub) {
    const n = pts.length / 3, cp = [];
    for (let i = 0; i < n; i++) { cam(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]); cp.push(T[0], T[1], T[2]); }
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = i * 3, b = ((i + 1) % n) * 3, da = cp[a + 2] - NEAR, db = cp[b + 2] - NEAR;
      if (da >= 0) out.push(cp[a], cp[a + 1], cp[a + 2]);
      if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push(lerp(cp[a], cp[b], t), lerp(cp[a + 1], cp[b + 1], t), NEAR); }
    }
    const m = out.length / 3; if (m < 3) return false;
    g.beginPath();
    let px, py, first = true;
    for (let i = 0; i < m; i++) {
      const a = i * 3, b = ((i + 1) % m) * 3;
      proj(out[a], out[a + 1], out[a + 2]); const ax = P2[0], ay = P2[1];
      if (first) { g.moveTo(ax, ay); first = false; }
      proj(out[b], out[b + 1], out[b + 2]); const bx = P2[0], by = P2[1];
      let k = sub === false ? 1 : Math.min(14, Math.ceil(Math.hypot(bx - ax, by - ay) / C.seg));
      if (k > 1) for (let s = 1; s < k; s++) {
        const t = s / k; proj(lerp(out[a], out[b], t), lerp(out[a + 1], out[b + 1], t), lerp(out[a + 2], out[b + 2], t)); g.lineTo(P2[0], P2[1]);
      }
      if (i < m - 1) g.lineTo(bx, by);
    }
    g.closePath(); return true;
  }
  function fillPoly(g, pts, style, sub) { if (polyPath(g, pts, sub)) { g.fillStyle = style; g.fill(); return true; } return false; }
  function camDepth(x, y, z) { return cam(x, y, z)[2]; }
  function sc(x, y, z) { cam(x, y, z); proj(T[0], T[1], T[2]); return P2; } // 世界点 → 屏幕

  // ---------------------------------------------------------------- 基本形体
  // 轴对齐长方体：只画朝向相机的面，按法线打光
  function box(g, x0, x1, y0, y1, z0, z1, col, o) {
    o = o || {}; const d = camDepth((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), f = fogAt(d), k0 = o.k || 1;
    const faces = [];
    if (C.x < x0) faces.push([-1, 0, 0, [x0, y0, z0, x0, y1, z0, x0, y1, z1, x0, y0, z1]]);
    if (C.x > x1) faces.push([1, 0, 0, [x1, y0, z1, x1, y1, z1, x1, y1, z0, x1, y0, z0]]);
    if (C.z < z0) faces.push([0, 0, -1, [x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z0]]);
    if (C.z > z1) faces.push([0, 0, 1, [x0, y0, z1, x0, y1, z1, x1, y1, z1, x1, y0, z1]]);
    if (C.y > y1) faces.push([0, 1, 0, [x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1]]);
    for (const fc of faces) fillPoly(g, fc[3], rgb(col, lit(fc[0], fc[1], fc[2]) * k0, f), o.sub);
  }
  function groundQuad(g, x0, x1, z0, z1, style, y) {
    y = y || 0; fillPoly(g, [x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1], style);
  }
  function circle(g, cx, cy, r, style) { g.fillStyle = style; g.beginPath(); g.arc(cx, cy, Math.max(0.3, r), 0, 6.2832); g.fill(); }

  // ---------------------------------------------------------------- 汽车
  function drawCar(g, it, lod) {
    const prof = PROFS[it.prof], sx = it.sx || 1, dir = it.dir, ox = it.ox, oz = it.oz, base = it.paint;
    const P = prof.p, n = P.length;
    const R = [], L = [];
    for (let i = 0; i < n; i++) { const u = P[i][0] * sx, h = P[i][1], w = P[i][2]; R.push([ox + dir * u, h, oz + w]); L.push([ox + dir * u, h, oz - w]); }
    const ctr = [ox + dir * prof.len * sx / 2, 0.8, oz];
    const dC = camDepth(ctr[0], 0.8, ctr[2]), fog = fogAt(dC), glass = [34, 48, 62];
    // 地面投影
    fillPoly(g, [ox - dir * 0.2, 0.01, oz - 1.12, ox + dir * (prof.len * sx + 0.15), 0.01, oz - 1.12, ox + dir * (prof.len * sx + 0.15), 0.01, oz + 1.12, ox - dir * 0.2, 0.01, oz + 1.12], rgb([0, 0, 0], 1, 0, 0.30));
    const cross = (a, b, c) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]; };
    const face = (pts3, col, k, glassy, inset) => { // pts3: [[x,y,z]...]
      const nrm = cross(pts3[0], pts3[1], pts3[2]); let l = Math.hypot(nrm[0], nrm[1], nrm[2]) || 1;
      let fx = 0, fy = 0, fz = 0; for (const p of pts3) { fx += p[0]; fy += p[1]; fz += p[2]; } fx /= pts3.length; fy /= pts3.length; fz /= pts3.length;
      let nx = nrm[0] / l, ny = nrm[1] / l, nz = nrm[2] / l;
      if (nx * (fx - ctr[0]) + ny * (fy - ctr[1]) + nz * (fz - ctr[2]) < 0) { nx = -nx; ny = -ny; nz = -nz; }
      if (nx * (C.x - fx) + ny * (C.y - fy) + nz * (C.z - fz) <= 0) return false;
      const flat = []; for (const p of pts3) flat.push(p[0], p[1], p[2]);
      fillPoly(g, flat, rgb(col, lit(nx, ny, nz) * k, fog));
      if (glassy) { // 玻璃：略缩小，反射天空
        const q = []; for (const p of pts3) q.push(lerp(p[0], fx, inset), lerp(p[1], fy, inset), lerp(p[2], fz, inset));
        fillPoly(g, q, rgb(mix(glass, [150, 180, 210], 0.22 + 0.3 * Math.max(0, ny)), 0.95, fog));
      }
      return true;
    };
    // 侧面（只画朝向相机一侧）
    const sideFace = (arr, sgn) => {
      if (sgn * (C.z - oz) <= 0.9) return false; // 相机在这一侧外面才可见
      const flat = []; arr.forEach(p => flat.push(p[0], p[1], p[2]));
      fillPoly(g, flat, rgb(base, lit(0, 0, sgn) * 1.0, fog));
      // 门槛阴影带
      const sk = []; [0.04, 0.96].forEach(t => {}); // 占位，保持结构简单
      const z = oz + sgn * 0.93, u0 = 0.35 * sx, u1 = (prof.len - 0.3) * sx;
      fillPoly(g, [ox + dir * u0, 0.3, z, ox + dir * u1, 0.3, z, ox + dir * u1, 0.46, z, ox + dir * u0, 0.46, z], rgb([0, 0, 0], 1, 0, 0.32));
      // 侧窗（两块，中间 B 柱）
      const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
      for (const [t0, t1] of [[0.05, 0.47], [0.53, 0.95]]) {
        const b0 = lerp3(arr[3], arr[6], t0), b1 = lerp3(arr[3], arr[6], t1), a0 = lerp3(arr[4], arr[5], t0), a1 = lerp3(arr[4], arr[5], t1);
        const up = 0.1, dn = 0.16, pane = [lerp3(b0, a0, up), lerp3(a0, b0, dn), lerp3(a1, b1, dn), lerp3(b1, a1, up)];
        fillPoly(g, [pane[0][0], pane[0][1], pane[0][2], pane[1][0], pane[1][1], pane[1][2], pane[2][0], pane[2][1], pane[2][2], pane[3][0], pane[3][1], pane[3][2]], rgb(mix(glass, [150, 180, 210], 0.25), 0.95, fog));
      }
      // 轮子
      if (!lod) {
        const zz = oz + sgn * 0.935;
        for (const uu of [0.85, prof.len * sx - 0.95]) {
          const pts = [], pts2 = [];
          for (let a = 0; a < 16; a++) { const an = a / 16 * 6.2832; pts.push(ox + dir * (uu + Math.cos(an) * 0.36), 0.34 + Math.sin(an) * 0.36, zz); pts2.push(ox + dir * (uu + Math.cos(an) * 0.22), 0.34 + Math.sin(an) * 0.22, zz); }
          const arch = []; for (let a = 0; a <= 8; a++) { const an = Math.PI * a / 8; arch.push(ox + dir * (uu + Math.cos(an) * 0.42), 0.34 + Math.sin(an) * 0.42, zz); }
          fillPoly(g, arch, rgb([8, 8, 10], 1, 0, 0.55));
          fillPoly(g, pts, rgb([18, 18, 20], 1, fog * 0.6));
          fillPoly(g, pts2, rgb([150, 154, 160], 0.9, fog));
        }
      }
      return true;
    };
    sideFace(L, -1); sideFace(R, 1);
    // 顶面 / 前后面条带
    for (let i = 0; i < n - 1; i++) {
      const gl = i === 3 || i === 5, col = base;
      face([R[i], R[i + 1], L[i + 1], L[i]], gl ? [Math.max(34, base[0] * 0.5), Math.max(44, base[1] * 0.5), Math.max(58, base[2] * 0.5)] : col, gl ? 1 : 1, gl, 0.16);
    }
    // 尾灯 / 车牌（尾部可见时）；前灯（前部可见时）
    const rearVis = (C.x - ox) * -dir > 0, frontVis = (C.x - (ox + dir * prof.len * sx)) * dir > 0;
    if (rearVis && !lod) {
      const x = ox - dir * 0.01;
      for (const s of [-1, 1]) fillPoly(g, [x, .66, oz + s * .86, x, .66, oz + s * .5, x, .80, oz + s * .52, x, .82, oz + s * .88], rgb([205, 20, 28], 1, fog));
      fillPoly(g, [x, .50, oz - .26, x, .50, oz + .26, x, .62, oz + .26, x, .62, oz - .26], rgb([226, 226, 216], .95, fog));
      fillPoly(g, [x, .30, oz - .84, x, .30, oz + .84, x, .42, oz + .84, x, .42, oz - .84], rgb([10, 10, 12], 1, 0, .45));
    }
    if (frontVis && !lod) {
      const x = ox + dir * (prof.len * sx + 0.01);
      for (const s of [-1, 1]) fillPoly(g, [x, .66, oz + s * .84, x, .66, oz + s * .46, x, .78, oz + s * .5, x, .8, oz + s * .86], rgb([246, 246, 232], 1, fog));
      fillPoly(g, [x, .40, oz - .4, x, .40, oz + .4, x, .6, oz + .4, x, .6, oz - .4], rgb([12, 12, 14], 1, fog));
      fillPoly(g, [x, .30, oz - .82, x, .30, oz + .82, x, .40, oz + .82, x, .40, oz - .82], rgb([10, 10, 12], 1, 0, .5));
    }
  }
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  // ---------------------------------------------------------------- 其它物件（屏幕空间公告牌）
  function billboardScale(x, y, z) { // 返回 {x,y,h(像素/米), d}
    const d = camDepth(x, y, z); const b = sc(x, 0, z), bx = b[0], by = b[1]; const t = sc(x, 1, z);
    return { x: bx, y: by, m: Math.abs(by - t[1]), d };
  }
  function drawCone(g, c) {
    const b = billboardScale(c.x, 0, c.z); if (b.d < 0.6) return; const m = b.m, f = fogAt(b.d);
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(b.x + m * 0.08, b.y, m * 0.3, m * 0.07, 0, 0, 6.2832); g.fill();
    g.fillStyle = rgb([30, 30, 32], 1, f); g.fillRect(b.x - m * 0.22, b.y - m * 0.035, m * 0.44, m * 0.035);
    g.fillStyle = rgb([240, 110, 24], 1, f); g.beginPath(); g.moveTo(b.x - m * 0.17, b.y - m * 0.035); g.lineTo(b.x - m * 0.035, b.y - m * 0.72); g.lineTo(b.x + m * 0.035, b.y - m * 0.72); g.lineTo(b.x + m * 0.17, b.y - m * 0.035); g.closePath(); g.fill();
    g.fillStyle = rgb([240, 240, 236], 1, f); g.beginPath(); g.moveTo(b.x - m * 0.115, b.y - m * 0.24); g.lineTo(b.x - m * 0.085, b.y - m * 0.4); g.lineTo(b.x + m * 0.085, b.y - m * 0.4); g.lineTo(b.x + m * 0.115, b.y - m * 0.24); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.moveTo(b.x - m * 0.12, b.y - m * 0.05); g.lineTo(b.x - m * 0.03, b.y - m * 0.7); g.lineTo(b.x - m * 0.0, b.y - m * 0.7); g.lineTo(b.x - m * 0.07, b.y - m * 0.05); g.fill();
  }
  const SHIRTS = [[220, 70, 60], [60, 110, 190], [240, 200, 70], [70, 150, 110], [180, 180, 186], [40, 40, 46]];
  function drawPed(g, o) {
    const b = billboardScale(o.x, 0, o.z); if (b.d < 0.8) return; const m = b.m, f = fogAt(b.d), s = Math.sign(o.vx) * (C.mir > 0 ? 1 : -1);
    const sw = Math.sin(o.ph) * 0.26, shirt = SHIRTS[(o.n * 3) % SHIRTS.length], pants = [44, 52, 70];
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(b.x, b.y, m * 0.42, m * 0.08, 0, 0, 6.2832); g.fill();
    const line = (x0, y0, x1, y1, w, col) => { g.strokeStyle = col; g.lineWidth = Math.max(1, w * m); g.lineCap = 'round'; g.beginPath(); g.moveTo(b.x + x0 * m * s, b.y - y0 * m); g.lineTo(b.x + x1 * m * s, b.y - y1 * m); g.stroke(); };
    line(0, .92, -sw, .04, .13, rgb([30, 30, 34], 1, f)); line(0, .92, -sw * .1 + 0.0, .0, 0, 'rgba(0,0,0,0)');
    line(0, .92, sw, .04, .14, rgb(pants, 1, f));
    line(0, .92, 0, 1.4, .3, rgb(shirt, 1, f));
    line(0, 1.38, sw * 1.2, 1.0, .08, rgb([200, 160, 130], 1, f)); line(0, 1.38, -sw * 1.2, 1.0, .08, rgb([200, 160, 130], .85, f));
    circle(g, b.x + 0.02 * m * s, b.y - 1.6 * m, m * 0.115, rgb([205, 165, 135], 1, f));
    g.fillStyle = rgb([40, 30, 26], 1, f); g.beginPath(); g.arc(b.x + 0.0 * m * s, b.y - 1.63 * m, m * 0.12, Math.PI * 1.05, Math.PI * 2.0); g.fill();
  }
  function drawTree(g, t) {
    const b = billboardScale(t.x, 0, t.z); if (b.d < 1) return; const m = b.m, f = fogAt(b.d), R = t.r;
    g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(b.x + m * 0.6, b.y, m * R * 0.9, m * 0.25, 0, 0, 6.2832); g.fill();
    g.fillStyle = rgb([70, 54, 42], 1, f); g.fillRect(b.x - m * 0.14, b.y - m * (t.h * 0.55), m * 0.28, m * t.h * 0.55);
    const cx = b.x, cy = b.y - m * (t.h * 0.72), r = m * R;
    const blobs = [[-0.55, 0.15, 0.62], [0.55, 0.2, 0.6], [0, -0.1, 0.78], [-0.3, -0.55, 0.55], [0.35, -0.5, 0.52], [0, 0.35, 0.6]];
    for (const [dx, dy, rr] of blobs) circle(g, cx + dx * r, cy + dy * r, rr * r, rgb(t.col, 0.62, f));
    for (const [dx, dy, rr] of blobs) circle(g, cx + dx * r - r * 0.06, cy + dy * r - r * 0.1, rr * r * 0.82, rgb(t.col, 0.95, f));
    for (const [dx, dy, rr] of blobs.slice(2)) circle(g, cx + dx * r - r * 0.16, cy + dy * r - r * 0.24, rr * r * 0.5, rgb(t.col, 1.25, f));
  }
  function drawLamp(g, z, side) {
    const x = side * 8.9, d = camDepth(x, 3, z); if (d < 0.8) return; const f = fogAt(d), b = sc(x, 0, z), bx = b[0], by = b[1], t = sc(x, 6.2, z), m = Math.abs(by - t[1]) / 6.2;
    g.strokeStyle = rgb([58, 62, 68], 1, f); g.lineCap = 'round'; g.lineWidth = Math.max(1, m * 0.16);
    g.beginPath(); g.moveTo(bx, by); g.lineTo(t[0], t[1]); g.lineTo(t[0] - side * m * 0.9, t[1] - m * 0.15); g.stroke();
    g.fillStyle = rgb([230, 230, 220], 1, f); g.fillRect(t[0] - side * m * 1.15 - m * 0.18, t[1] - m * 0.18, m * 0.36, m * 0.12);
  }

  // ---------------------------------------------------------------- 天空与远景（以方位角为坐标，保证转向时整体平移）
  function skyAndFar(g, W, H, yaw, t) {
    const hy = proj(0, Math.tan(Math.atan((C.cy - H * 0.4) / C.f)) * 1, 1)[1]; // 仅用于渐变范围
    let gr = g.createLinearGradient(0, 0, 0, C.cy);
    gr.addColorStop(0, '#5f97d6'); gr.addColorStop(0.55, '#92bde6'); gr.addColorStop(1, rgb(FOG, 1, 0));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // 云
    for (let i = 0; i < 7; i++) {
      const ang = i * 0.9 + 0.3 + t * 0.002 * (1 + i % 3), el = 0.28 + hash(i, 3) * 0.55;
      let a = (ang - yaw * C.mir) % 6.2832; if (a > 3.1416) a -= 6.2832; if (a < -3.1416) a += 6.2832;
      const x = C.cx + Math.tan(a) * C.f * (0.9), y = C.cy - C.f * Math.tan(Math.atan((C.cy - H * 0.4) / C.f)) - el * H * 0.42;
      if (Math.abs(a) > 1.35) continue; const w = W * (0.16 + hash(i, 4) * 0.14);
      g.save(); g.translate(x, y); g.scale(1, 0.26); const rg = g.createRadialGradient(0, 0, 0, 0, 0, w); rg.addColorStop(0, 'rgba(255,255,255,.4)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.beginPath(); g.arc(0, 0, w, 0, 6.2832); g.fill(); g.restore();
    }
    // 远景：山 / 树线 / 楼群（三层，越远越淡）
    const layers = [
      { R: 1400, seed: 71, col: [112, 140, 168], fog: 0.55, h: a => 70 + 90 * Math.abs(Math.sin(a * 5.3 + 1) * Math.cos(a * 2.1)), step: 0.03, blocky: false },
      { R: 520, seed: 72, col: [118, 134, 150], fog: 0.45, h: null, step: 0.012, blocky: true, hmin: 14, hmax: 62 },
      { R: 230, seed: 73, col: [64, 98, 78], fog: 0.35, h: a => 9 + 6 * Math.abs(Math.sin(a * 37) * Math.cos(a * 11)), step: 0.008, blocky: false },
    ];
    for (const L of layers) {
      const half = 1.45, a0 = yaw * C.mir - half, a1 = yaw * C.mir + half; const pts = []; let bh = 20, nextChange = -9;
      const start = Math.floor(a0 / L.step) * L.step;
      const bot = [], top = [];
      for (let a = start; a <= a1 + L.step; a += L.step) {
        let h;
        if (L.blocky) { const cell = Math.floor(a / 0.05); h = L.hmin + hash(cell, L.seed) * (L.hmax - L.hmin); if (hash(cell, L.seed + 9) < 0.28) h *= 0.4; } else h = L.h(a);
        const wx = C.x + Math.sin(a * C.mir) * L.R, wz = C.z + Math.cos(a * C.mir) * L.R;
        cam(wx, h, wz); const p1 = proj(T[0], T[1], T[2]); top.push(p1[0], p1[1]);
        cam(wx, -20, wz); const p0 = proj(T[0], T[1], T[2]); bot.push(p0[0], p0[1]);
      }
      g.beginPath(); g.moveTo(top[0], top[1]);
      for (let i = 2; i < top.length; i += 2) {
        if (L.blocky) g.lineTo(top[i], top[i - 1]); // 先横后竖成台阶
        g.lineTo(top[i], top[i + 1]);
      }
      for (let i = bot.length - 2; i >= 0; i -= 2) g.lineTo(bot[i], bot[i + 1]);
      g.closePath(); g.fillStyle = rgb(L.col, 1, L.fog); g.fill();
    }
  }

  // ---------------------------------------------------------------- 地面
  const ASPH = [96, 98, 102];
  function ground(g, W, H, q) {
    const far = 600;
    // 渐变：按到地面各距离处的屏幕 y 设置雾色
    const yNear = proj(0, -C.y * C.cP + 0.4 * C.sP, -(-C.y) * 0 + (0.4 * C.cP + C.y * C.sP))[1];
    const yFar = proj(0, -C.y * C.cP + far * C.sP, far * C.cP + C.y * C.sP)[1];
    const top = Math.min(yNear, yFar), bot = Math.max(yNear, yFar);
    const gr = g.createLinearGradient(0, yFar, 0, Math.max(yFar + 1, H));
    for (const d of [600, 220, 120, 70, 40, 24, 14, 8, 4, 1.5]) {
      const y = proj(0, -C.y * C.cP + d * C.sP, d * C.cP + C.y * C.sP)[1];
      const tt = clamp((y - yFar) / Math.max(1, H - yFar), 0, 1);
      gr.addColorStop(tt, rgb(ASPH, 1.0 + 0.08 * (1 - Math.min(1, d / 40)) * 0 + (d < 6 ? -0.06 : 0), fogAt(d)));
    }
    const hw = 400, cx = C.x, cz = C.z, sy = Math.sin(C.cY === undefined ? 0 : Math.atan2(C.sY, C.cY)), cy_ = C.cY, sy_ = C.sY;
    // 以相机朝向为轴的大四边形
    const fx = sy_, fz = cy_, rx = cy_, rz = -sy_; // 前向 (x,z) 与右向（世界）
    const pts = [cx + rx * -hw + fx * 0.2, 0, cz + rz * -hw + fz * 0.2, cx + rx * hw + fx * 0.2, 0, cz + rz * hw + fz * 0.2, cx + rx * hw + fx * far, 0, cz + rz * hw + fz * far, cx + rx * -hw + fx * far, 0, cz + rz * -hw + fz * far];
    if (C.mir < 0) { /* 前视相机在镜像下仍成立：四边形是对称的 */ }
    fillPoly(g, pts, gr);
  }

  function detailGround(g, q, Zc) {
    const z0 = Zc - 5, z1 = Zc + (q ? 60 : 36);
    // 大块补丁 / 路面色差
    const c0 = Math.floor(z0 / 7), c1 = Math.floor(z1 / 7);
    for (let c = c0; c <= c1; c++) for (let s = -1; s <= 1; s++) {
      const hsh = hash(c * 7 + s, 41); if (hsh < 0.35) continue;
      const x0 = s * 3.2 - 3 + (hash(c, 42 + s) - .5) * 1.4, x1 = x0 + 2.4 + hash(c, 43) * 3, za = c * 7 + hash(c, 44 + s) * 3, zb = za + 2 + hash(c, 45) * 4;
      groundQuad(g, x0, x1, za, zb, rgb([hsh > 0.7 ? 255 : 0, hsh > 0.7 ? 255 : 0, hsh > 0.7 ? 255 : 0], 1, 0, hsh > 0.7 ? 0.035 : 0.07));
    }
    // 横向路面接缝（强运动线索）
    const j0 = Math.floor(z0 / 5), j1 = Math.floor(z1 / 5);
    for (let j = j0; j <= j1; j++) groundQuad(g, -AISLE, AISLE, j * 5, j * 5 + 0.05, 'rgba(20,22,26,.35)');
    // 车辙
    for (const s of [-1, 1]) groundQuad(g, s * 1.15 - 0.45, s * 1.15 + 0.45, z0, z1, 'rgba(0,0,0,.05)');
    // 油渍
    const o0 = Math.floor(z0 / 11), o1 = Math.floor(z1 / 11);
    for (let o = o0; o <= o1; o++) if (hash(o, 51) > 0.35) {
      const cx = (hash(o, 52) - 0.5) * 3.6, cz = o * 11 + hash(o, 53) * 8, pts = [];
      for (let a = 0; a < 12; a++) { const an = a / 12 * 6.2832, r = 0.5 + 0.28 * hash(o * 12 + a, 54); pts.push(cx + Math.cos(an) * r * 1.3, 0.002, cz + Math.sin(an) * r * 0.9); }
      fillPoly(g, pts, 'rgba(10,12,16,.22)');
    }
    // 沥青颗粒
    g.fillStyle = 'rgba(0,0,0,.20)'; const dots = (zs, ze, cell, zl) => {
      for (let i = Math.floor(zs / cell); i < Math.floor(ze / cell); i++) for (let j = -Math.ceil(AISLE * 1.3 / cell); j < Math.ceil(AISLE * 1.3 / cell); j++) {
        const hsh = hash(i * 131 + j, 61); if (hsh < 0.4) continue;
        const x = (j + hash(i * 131 + j, 62)) * cell, z = (i + hash(i * 131 + j, 63)) * cell; cam(x, 0, z); if (T[2] < 0.6) continue;
        proj(T[0], T[1], T[2]); const s = Math.max(0.8, C.f * 0.045 / T[2] * (cell > 1 ? 1.4 : 1));
        g.fillStyle = hsh > 0.8 ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.20)'; g.fillRect(P2[0], P2[1], s, s * 0.45);
      }
    };
    dots(z0 + 5, Zc + 7, 0.5, 0); dots(Zc + 7, Zc + 22, 1.3, 0); if (q) dots(Zc + 22, Zc + 55, 3, 0);
  }

  // 车位线、路沿、箭头等地面标线
  function markings(g, q, Zc) {
    const white = 'rgba(236,236,230,.92)';
    const zStart = Zc - 4, zEnd = Zc + (q ? 80 : 40);
    const i0 = Math.floor(zStart / PITCH), i1 = Math.floor(zEnd / PITCH);
    for (let i = i0; i <= i1; i++) {
      if (isGapStall(i) && isGapStall(i - 1)) continue;
      const z = i * PITCH;
      for (const s of [-1, 1]) groundQuad(g, Math.min(s * AISLE, s * 8.3), Math.max(s * AISLE, s * 8.3), z - 0.055, z + 0.055, white);
    }
    // 车位末端挡轮杆 + 车位前端线
    for (let i = i0; i <= i1; i++) {
      if (isGapStall(i)) continue; const zc = (i + 0.5) * PITCH;
      for (const s of [-1, 1]) {
        const xa = s * 7.8, xb = s * 8.05; const d = camDepth(xa, 0, zc); if (d < 0.7 || d > 60) continue;
        box(g, Math.min(xa, xb), Math.max(xa, xb), 0, 0.12, zc - 0.7, zc + 0.7, [150, 150, 148]);
      }
    }
    // 通道方向箭头
    const a0 = Math.floor((zStart - 4) / 20), a1 = Math.floor(zEnd / 20);
    for (let a = a0; a <= a1; a++) {
      const z = a * 20 + 8; if (((z % PERIOD) + PERIOD) % PERIOD > 12.5 && ((z % PERIOD) + PERIOD) % PERIOD < 19.5) continue;
      fillPoly(g, [-0.09, 0, z, 0.09, 0, z, 0.09, 0, z + 1.8, 0.45, 0, z + 1.8, 0, 0, z + 3.0, -0.45, 0, z + 1.8, -0.09, 0, z + 1.8], 'rgba(236,236,230,.75)');
    }
    // 横向车道两侧的斑马线
    const l0 = Math.floor((zStart - LANE_C - 6) / PERIOD), l1 = Math.floor((zEnd - LANE_C + 6) / PERIOD);
    for (let l = l0; l <= l1; l++) {
      const lz = LANE_C + l * PERIOD;
      for (const zz of [lz - 4.6]) for (let k = -4; k <= 4; k++) groundQuad(g, k * 0.75 - 0.2, k * 0.75 + 0.2, zz, zz + 2.0, 'rgba(236,236,230,.8)');
    }
  }

  // ---------------------------------------------------------------- 世界绘制
  function renderWorld(g, W, H, q) {
    const Zc = C.z, items = [];
    skyAndFar(g, W, H, Math.atan2(C.sY, C.cY), sim.t);
    ground(g, W, H, q);
    detailGround(g, q, Zc);
    markings(g, q, Zc);
    const zLo = Zc - 5, zHi = Zc + (q ? 82 : 55);
    const push = (x, z, fn, r) => { const d = camDepth(x, 0, z); if (d < 0.5 || d > 140) return; items.push({ d: d + (r || 0), fn }); };
    // 两侧：车位里的车、路沿、灌木、树、路灯、楼宇
    const i0 = Math.floor(zLo / PITCH), i1 = Math.floor(zHi / PITCH);
    for (let i = i0; i <= i1; i++) {
      if (isGapStall(i)) continue; const zc = (i + 0.5) * PITCH, idx = ((i % 160) + 160) % 160;
      for (const s of [-1, 1]) {
        const key = idx * 2 + (s > 0 ? 1 : 0), h = hash(key, 21);
        if (h > 0.82) continue; // 空位
        const kk = hash(key, 22), pr = kk < 0.55 ? 'sedan' : kk < 0.85 ? 'suv' : 'hatch';
        const it = { ox: s * (AISLE + 0.4), oz: zc + (hash(key, 23) - .5) * 0.34, dir: -s * -1 * 1, prof: pr, sx: 0.95 + hash(key, 24) * 0.1, paint: PAINTS[Math.floor(hash(key, 25) * PAINTS.length)] };
        it.dir = s; // 车头朝外：左侧向 −x（dir=-1），右侧向 +x
        it.dir = s > 0 ? 1 : -1;
        const lod = camDepth(it.ox, 1, it.oz) > 34;
        push(it.ox + s * 2, zc, () => drawCar(g, it, lod), 0);
      }
    }
    // 路沿 / 灌木 / 路灯 / 树 / 楼宇：按 8 m 一段
    const b0 = Math.floor(zLo / 8), b1 = Math.floor(zHi / 8);
    for (let b = b0; b <= b1; b++) {
      const zA = b * 8, zB = zA + 8, mid = zA + 4, m = ((mid % PERIOD) + PERIOD) % PERIOD, inGap = m > 12.9 && m < 19.6; // 车道区域：无路沿 / 灌木
      for (const s of [-1, 1]) {
        if (!inGap) {
          push(s * 9.5, mid, () => { // 路沿 + 草坪 + 灌木
            const xa = s * 8.3, xb = s * 8.7; box(g, Math.min(xa, xb), Math.max(xa, xb), 0, 0.15, zA, zB, [178, 178, 174]);
            groundQuad(g, Math.min(xb, s * 12.5), Math.max(xb, s * 12.5), zA, zB, rgb([88, 122, 66], lit(0, 1, 0), fogAt(camDepth(s * 10, 0, mid))), 0.02);
            box(g, Math.min(s * 8.95, s * 9.9), Math.max(s * 8.95, s * 9.9), 0, 0.85, zA + 0.2, zB - 0.2, [58, 98, 54], { k: 1 });
          }, 0.3);
          const lampI = Math.floor(mid / 20), lz = lampI * 20 + 3 + (s > 0 ? 10 : 0);
          if (lz >= zA && lz < zB) push(s * 8.9, lz, () => drawLamp(g, lz, s), 0);
        }
        const bi = Math.floor(mid / 21) * 2 + (s > 0 ? 1 : 0);
        if (!inGap && hash(b, 80 + (s > 0 ? 1 : 0)) < 0.55) {
          const tz = zA + 1 + hash(b, 82 + (s > 0 ? 1 : 0)) * 6, tree = { x: s * (11 + hash(b, 83) * 1.2), z: tz, h: 4.5 + hash(b, 84) * 2, r: 1.9 + hash(b, 85) * 0.9, col: [52 + hash(b, 86) * 24, 108 + hash(b, 87) * 28, 52 + hash(b, 88) * 14] };
          push(tree.x, tz, () => drawTree(g, tree), 0);
        }
        // 楼宇（按 24 m 一栋，部分空缺）
        const bz = Math.floor(zA / 24), bkey = bz * 2 + (s > 0 ? 1 : 0);
        if (zA === Math.floor(zA / 24) * 24 || ((b0 === b) && false)) { /* 在各自 24 m 起点绘制一次 */ }
      }
    }
    const k0 = Math.floor(zLo / 24) - 1, k1 = Math.floor(zHi / 24);
    for (let k = k0; k <= k1; k++) for (const s of [-1, 1]) {
      const key = k * 2 + (s > 0 ? 1 : 0); if (hash(key, 90) < 0.18) continue;
      const hgt = 8 + hash(key, 91) * 14, len = 16 + hash(key, 92) * 6, za = k * 24 + 1, zb = za + len, mid = (za + zb) / 2, mm = ((mid % PERIOD) + PERIOD) % PERIOD;
      if (mm > 8 && mm < 24 && false) continue;
      const xN = s * 19, xF = s * (19 + 14), bcol = [[182, 170, 156], [150, 156, 166], [196, 190, 182], [128, 120, 116]][Math.floor(hash(key, 93) * 4)];
      push(s * 26, mid, () => {
        box(g, Math.min(xN, xF), Math.max(xN, xF), 0, hgt, za, zb, bcol);
        const d = camDepth(xN, 3, mid); if (d > 70) return; const f = fogAt(d);
        const rows = Math.floor(hgt / 3.4); // 窗带
        for (let r = 0; r < rows; r++) { const y0 = 1.0 + r * 3.4, y1 = y0 + 1.7; fillPoly(g, [xN, y0, za + 1, xN, y0, zb - 1, xN, y1, zb - 1, xN, y1, za + 1], rgb([52, 74, 98], 1, f)); }
        if (C.z < za) fillPoly(g, [xN, 0, za, xN, 2.6, za, xN, 2.6, za + 0, xN, 0, za], 'rgba(0,0,0,0)');
      }, 0);
    }
    // 锥桶（路缘 / 通道边）
    const kc0 = Math.floor((zLo - 13) / CONE_GAP), kc1 = Math.floor(zHi / CONE_GAP);
    for (let k = kc0; k <= kc1; k++) { const c = coneAt(k); push(c.x, c.z, () => drawCone(g, c), 0); }
    // 横向来车 / 行人
    for (const o of sim.cross) {
      if (o.type === 'ped') push(o.x, o.z, () => drawPed(g, o), 0);
      else { const it = { ox: o.x - Math.sign(o.vx) * -0.0 + (o.vx > 0 ? 0 : 0), oz: o.z, dir: Math.sign(o.vx) || 1, prof: o.prof, sx: 1, paint: o.paint }; it.ox = o.x - it.dir * 2.2; push(o.x, o.z, () => drawCar(g, it, camDepth(o.x, 1, o.z) > 34), 0); }
    }
    items.sort((a, b) => b.d - a.d);
    for (const it of items) it.fn();
  }

  // ---------------------------------------------------------------- 辅助线（随方向盘弯曲）
  function drawGuides(g, W, H, k) {
    const curv = Math.tan(sim.steer * MAX_WHEEL) / CAR_L, zA = -1.0, hw = 0.98, half = 0.085;
    const edge = (o, s) => { // 轮迹：偏移 o（相对车体中线），弧长 s（从后轴起算）
      const th = s * curv, h = Math.abs(th) < 1e-5 ? th / 2 : (1 - Math.cos(th)) / th, sinc = Math.abs(th) < 1e-5 ? 1 : Math.sin(th) / th;
      return [o * Math.cos(th) + s * h, zA + s * sinc - o * Math.sin(th)];
    };
    const S0 = 1.0 + 0.45, S1 = 1.0 + 7.4, N = 34, left = [], right = [];
    const build = (o) => {
      const A = [], B = [];
      for (let i = 0; i <= N; i++) {
        const s = lerp(S0, S1, i / N), p = edge(o - half, s), q = edge(o + half, s);
        camLocal(p[0], 0, p[1]); proj(T[0], T[1], T[2]); A.push(P2[0], P2[1], T[2]);
        camLocal(q[0], 0, q[1]); proj(T[0], T[1], T[2]); B.push(P2[0], P2[1], T[2]);
      }
      return [A, B];
    };
    g.save();
    for (const side of [-1, 1]) {
      const [A, B] = build(side * hw);
      const yN = Math.max(A[1], B[1]), yF = Math.min(A[A.length - 2], B[B.length - 2]);
      const gr = g.createLinearGradient(0, yN, 0, yF);
      const near = sim.minD < 0.7 ? '255,92,80' : sim.minD < 1.4 ? '255,190,70' : '120,196,255';
      gr.addColorStop(0, `rgba(${near},.95)`); gr.addColorStop(0.35, 'rgba(190,226,255,.78)'); gr.addColorStop(1, 'rgba(200,232,255,0)');
      g.shadowColor = 'rgba(70,150,255,.55)'; g.shadowBlur = 8 * k;
      g.beginPath(); g.moveTo(A[0], A[1]);
      for (let i = 3; i < A.length; i += 3) g.lineTo(A[i], A[i + 1]);
      for (let i = B.length - 3; i >= 0; i -= 3) g.lineTo(B[i], B[i + 1]);
      g.closePath(); g.fillStyle = gr; g.fill();
    }
    g.shadowBlur = 0;
    // 距离刻度：每 1 m 一道，内侧短横
    for (let m = 1; m <= 6; m++) {
      const s = m + 1.0 - 0.0, a0 = edge(-hw + 0.05, s), a1 = edge(-hw + 0.5, s), b0 = edge(hw - 0.05, s), b1 = edge(hw - 0.5, s);
      camLocal(a0[0], 0, a0[1]); proj(T[0], T[1], T[2]); const ya = P2[1], d = T[2];
      const alpha = clamp(0.62 - m * 0.085, 0.06, 0.6);
      g.strokeStyle = `rgba(215,238,255,${alpha})`; g.lineWidth = Math.max(1, k * (2.4 - m * 0.22)); g.lineCap = 'round';
      g.beginPath(); camLocal(a0[0], 0, a0[1]); proj(T[0], T[1], T[2]); g.moveTo(P2[0], P2[1]); camLocal(a1[0], 0, a1[1]); proj(T[0], T[1], T[2]); g.lineTo(P2[0], P2[1]);
      camLocal(b0[0], 0, b0[1]); proj(T[0], T[1], T[2]); g.moveTo(P2[0], P2[1]); camLocal(b1[0], 0, b1[1]); proj(T[0], T[1], T[2]); g.lineTo(P2[0], P2[1]); g.stroke();
    }
    g.restore();
  }

  // ---------------------------------------------------------------- 自车保险杠
  function drawBumper(g, W, H, k) {
    const yE = H * 0.885, yC = H * 0.945;
    // 倒车灯在地面上的反光
    for (const s of [-1, 1]) { const rg = g.createRadialGradient(W / 2 + s * W * 0.34, H * 0.9, 0, W / 2 + s * W * 0.34, H * 0.9, W * 0.26); rg.addColorStop(0, 'rgba(255,255,245,.22)'); rg.addColorStop(1, 'rgba(255,255,245,0)'); g.fillStyle = rg; g.fillRect(0, H * 0.7, W, H * 0.3); }
    g.beginPath(); g.moveTo(-2, H + 2); g.lineTo(-2, yE - H * 0.01); g.bezierCurveTo(W * 0.2, yC + H * 0.01, W * 0.38, yC + H * 0.02, W / 2, yC + H * 0.02); g.bezierCurveTo(W * 0.62, yC + H * 0.02, W * 0.8, yC + H * 0.01, W + 2, yE - H * 0.01); g.lineTo(W + 2, H + 2); g.closePath();
    const gr = g.createLinearGradient(0, yE, 0, H); gr.addColorStop(0, 'rgba(34,37,42,.98)'); gr.addColorStop(0.18, 'rgba(14,15,18,.99)'); gr.addColorStop(1, 'rgba(4,4,6,1)');
    g.fillStyle = gr; g.fill();
    // 高光（天空反射）
    g.save(); g.clip(); const hg = g.createLinearGradient(0, 0, W, 0); hg.addColorStop(0, 'rgba(255,255,255,0)'); hg.addColorStop(0.3, 'rgba(210,228,250,.38)'); hg.addColorStop(0.55, 'rgba(255,255,255,.12)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = hg; g.lineWidth = Math.max(1.5, 2.5 * k); g.beginPath(); g.moveTo(-2, yE - H * 0.01 + 3 * k); g.bezierCurveTo(W * 0.2, yC + H * 0.01 + 3 * k, W * 0.38, yC + H * 0.02 + 3 * k, W / 2, yC + H * 0.02 + 3 * k); g.bezierCurveTo(W * 0.62, yC + H * 0.02 + 3 * k, W * 0.8, yC + H * 0.01 + 3 * k, W + 2, yE - H * 0.01 + 3 * k); g.stroke();
    const sheen = g.createLinearGradient(0, yC, 0, H); sheen.addColorStop(0, 'rgba(120,150,190,.20)'); sheen.addColorStop(1, 'rgba(120,150,190,0)'); g.fillStyle = sheen; g.fillRect(0, yC, W, H - yC);
    g.restore();
  }

  // ---------------------------------------------------------------- 后期：暗角 / 曝光 / 噪点
  let grain = null;
  function post(g, W, H, k) {
    if (!grain) { grain = document.createElement('canvas'); grain.width = grain.height = 160; const gg = grain.getContext('2d'), id = gg.createImageData(160, 160); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 120; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } gg.putImageData(id, 0, 0); }
    // 轻微高对比 / 高光泛白（摄像头自动曝光）
    g.globalCompositeOperation = 'soft-light'; g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 0.05; g.globalCompositeOperation = 'overlay'; g.drawImage(grain, Math.random() * 40, Math.random() * 40, W + 40, H + 40, -Math.random() * 20, -Math.random() * 20, W + 40, H + 40); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    const rg = g.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.hypot(W, H) * 0.56);
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
  }

  // ---------------------------------------------------------------- 主入口
  const scratch = [null, null];
  let lastLabel = '', lastLabelT = 0;
  function frameView(view) { return VIEWS[view] || VIEWS.rear; }
  function camPose(V) {
    const b = [Math.sin(sim.psi), Math.cos(sim.psi)], r = [Math.cos(sim.psi), -Math.sin(sim.psi)];
    return { x: sim.X + b[0] * V.az + r[0] * V.ax, y: V.h, z: sim.Z + b[1] * V.az + r[1] * V.ax, yaw: sim.psi + V.yaw, hfov: V.hfov, hz: V.hz, K: V.K, mir: V.mir };
  }
  function draw(cv, view, now, o) {
    o = o || {}; const panel = !!o.panel;
    const rect = cv.getBoundingClientRect(); if (rect.width < 2 || rect.height < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let W = Math.round(rect.width * dpr), H = Math.round(rect.height * dpr); const cap = Math.min(1, 1100 / Math.max(W, H)); W = Math.round(W * cap); H = Math.round(H * cap);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const k = W / Math.max(1, cv.clientWidth);
    const root = panel ? cv.parentNode : null;
    if (sim.fault) { if (root) syncDom(root); const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, W, H); return; }
    try {
      stepSim(now, o.speed, o.gear, panel);
      const V = frameView(view), g = cv.getContext('2d');
      setup(W, H, camPose(V)); renderWorld(g, W, H, true);
      if (V.guides && panel) drawGuides(g, W, H, k);
      if (V.bumper) drawBumper(g, W, H, k);
      if (V.side) { // 自车侧面（靠画面内侧）
        const s = V.side; g.beginPath(); const x0 = s < 0 ? W : 0, x1 = s < 0 ? W * 0.74 : W * 0.26; g.moveTo(x0, H); g.lineTo(x1, H); g.quadraticCurveTo(lerp(x0, x1, 0.55), H * 0.78, x0, H * 0.5); g.closePath();
        const gr = g.createLinearGradient(x1, 0, x0, 0); gr.addColorStop(0, 'rgba(200,205,212,.95)'); gr.addColorStop(1, 'rgba(120,126,134,.98)'); g.fillStyle = gr; g.fill();
      }
      if (panel && V.bumper && sim.thumbsT > 0.02) drawThumbs(g, W, H, k);
      post(g, W, H, k);
      // 标签
      const t = new Date().toLocaleTimeString(I18N.locale(), { hour12: false }), text = I18N.t(V.label) + '  ' + t;
      const fs = Math.round(15 * k); g.font = `500 ${fs}px Inter, -apple-system, "PingFang SC", sans-serif`;
      const tw = g.measureText(text).width, px = 14 * k, py = 8 * k, lx = W - 18 * k - tw - px * 2, ly = 18 * k;
      if (panel) { g.fillStyle = 'rgba(8,10,14,.5)'; g.beginPath(); g.roundRect(lx, ly, tw + px * 2, fs + py * 2, (fs + py * 2) / 2); g.fill(); g.fillStyle = 'rgba(255,255,255,.92)'; g.textBaseline = 'middle'; g.fillText(text, lx + px, ly + (fs + py * 2) / 2 + 1); }
      else { g.fillStyle = 'rgba(255,255,255,.85)'; g.textBaseline = 'alphabetic'; g.fillText(text, 24 * k, H - 24 * k); }
      if (root) syncDom(root);
    } catch (err) {
      if (!sim.fault) console.error('RearCam render failed:', err);
      sim.fault = true; if (root) syncDom(root);
    }
  }

  // 左右 B 柱缩略图（每帧只更新其中一个，减轻负担）
  function drawThumbs(g, W, H, k) {
    const tw = Math.round(W * 0.3), th = Math.round(H * 0.24), saveC = Object.assign({}, C);
    const which = sim.frame & 1;
    for (let i = 0; i < 2; i++) {
      if (!scratch[i]) scratch[i] = document.createElement('canvas');
      const cvs = scratch[i]; if (cvs.width !== tw || cvs.height !== th) { cvs.width = tw; cvs.height = th; scratch[i].dirty = true; }
      if (i === which || scratch[i].dirty) {
        const V = i === 0 ? VIEWS.left : VIEWS.right, g2 = cvs.getContext('2d');
        setup(tw, th, camPose(V)); renderWorld(g2, tw, th, false);
        const s = V.side; g2.beginPath(); const x0 = s < 0 ? tw : 0, x1 = s < 0 ? tw * 0.72 : tw * 0.28; g2.moveTo(x0, th); g2.lineTo(x1, th); g2.quadraticCurveTo(lerp(x0, x1, 0.55), th * 0.75, x0, th * 0.45); g2.closePath();
        const gr = g2.createLinearGradient(x1, 0, x0, 0); gr.addColorStop(0, 'rgba(205,210,216,.95)'); gr.addColorStop(1, 'rgba(120,126,134,.98)'); g2.fillStyle = gr; g2.fill();
        const rg = g2.createRadialGradient(tw / 2, th / 2, th * 0.3, tw / 2, th / 2, tw * 0.62); rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,.5)'); g2.fillStyle = rg; g2.fillRect(0, 0, tw, th);
        scratch[i].dirty = false;
      }
    }
    Object.assign(C, saveC);
    const slide = (1 - sim.thumbsT) * (th + 24 * k), y = H - th - 16 * k + slide, m = 14 * k;
    for (let i = 0; i < 2; i++) {
      const x = i === 0 ? m : W - tw - m;
      g.save(); g.globalAlpha = Math.min(1, sim.thumbsT * 1.2); g.beginPath(); g.roundRect(x, y, tw, th, 12 * k); g.clip(); g.drawImage(scratch[i], x, y); g.restore();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = Math.max(1, k); g.beginPath(); g.roundRect(x, y, tw, th, 12 * k); g.stroke();
    }
  }

  // ---------------------------------------------------------------- 面板 DOM
  const ICON = {
    assist: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="7.5" y="2.5" width="9" height="13" rx="3.6"/><path d="M9.2 6.2h5.6M9.2 11.6h5.6"/><path d="M5.5 18.2c3.8 2.1 9.2 2.1 13 0M3 21c5.4 3 12.6 3 18 0"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  };
  function buildPanel(root) {
    root.innerHTML = '<canvas></canvas>' +
      '<div class="rc-alert rc-l"></div><div class="rc-alert rc-r"></div>' +
      '<div class="rc-warn">后方横向来车</div>' +
      `<div class="rc-btns"><button class="rc-btn on" data-rc="assist" title="泊车辅助 开 / 关" aria-label="泊车辅助">${ICON.assist}</button><button class="rc-btn" data-rc="close" title="关闭" aria-label="关闭">${ICON.close}</button></div>` +
      '<div class="rc-assist"><canvas width="220" height="270"></canvas><b>—</b></div>' +
      `<button class="rc-thumbtab" data-rc="thumbs" title="上滑 / 下滑显示或隐藏侧面摄像头" aria-label="侧面摄像头">${ICON.chev}</button>` +
      '<div class="rc-fail"><b>后视摄像头暂时无法使用</b><span>请使用后视镜并留意周围环境</span></div>';
    const q = s => root.querySelector(s);
    root._rc = { l: q('.rc-l'), r: q('.rc-r'), warn: q('.rc-warn'), assist: q('.rc-assist'), acv: q('.rc-assist canvas'), adist: q('.rc-assist b'), fail: q('.rc-fail'), tab: q('.rc-thumbtab'), abtn: q('[data-rc="assist"]'), lastKey: '' };
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-rc]'); if (!b) return;
      const a = b.dataset.rc;
      if (a === 'close') { root.classList.remove('show'); window.Sound && Sound.play('tap'); }
      if (a === 'assist') { sim.assistOn = !sim.assistOn; window.Sound && Sound.play('tap'); }
      if (a === 'thumbs') { sim.thumbsOn = !sim.thumbsOn; window.Sound && Sound.play('tap'); }
    });
    // 画面上左右拖动 = 转动方向盘；上滑 / 下滑 = 显示 / 隐藏侧面摄像头
    let drag = null;
    root.addEventListener('pointerdown', e => { if (e.target.closest('[data-rc]')) return; drag = { x: e.clientX, y: e.clientY, s: sim.steer }; try { root.setPointerCapture(e.pointerId); } catch (_) {} });
    root.addEventListener('pointermove', e => {
      if (!drag) return; const r = root.getBoundingClientRect(), dx = (e.clientX - drag.x) / Math.max(1, r.width), dy = (e.clientY - drag.y) / Math.max(1, r.height);
      if (Math.abs(dx) > 0.015 && Math.abs(dx) > Math.abs(dy)) { sim.userSteer = clamp(drag.s + dx * 3, -1, 1); sim.userUntil = performance.now() + 6000; }
    });
    const end = e => {
      if (!drag) return; const r = root.getBoundingClientRect(), dx = (e.clientX - drag.x) / Math.max(1, r.width), dy = (e.clientY - drag.y) / Math.max(1, r.height);
      if (Math.abs(dy) > 0.12 && Math.abs(dy) > Math.abs(dx) * 1.6) sim.thumbsOn = dy < 0;
      drag = null;
    };
    root.addEventListener('pointerup', end); root.addEventListener('pointercancel', () => { drag = null; });
    root.addEventListener('wheel', e => { e.preventDefault(); sim.userSteer = clamp((performance.now() < sim.userUntil ? sim.userSteer : sim.steer) + e.deltaY * 0.002, -1, 1); sim.userUntil = performance.now() + 6000; }, { passive: false });
    root.addEventListener('dblclick', () => { sim.userUntil = 0; });
    return q('canvas');
  }
  const SECTOR_COL = ['#ffd60a', '#ff9f0a', '#ff453a'];
  function syncDom(root) {
    const d = root._rc; if (!d) return;
    const alert = sim.alert && !sim.fault;
    d.l.classList.toggle('on', alert && sim.alertSide < 0); d.r.classList.toggle('on', alert && sim.alertSide > 0);
    d.warn.classList.toggle('on', alert); d.warn.dataset.side = sim.alertSide < 0 ? '左' : '右';
    d.warn.textContent = alert ? (sim.alertSide < 0 ? '← 左后方有横向来车' : '右后方有横向来车 →') : '';
    d.fail.classList.toggle('on', sim.fault);
    d.abtn.classList.toggle('on', sim.assistOn);
    d.tab.classList.toggle('down', !sim.thumbsOn);
    d.assist.classList.toggle('on', sim.assistOn && !sim.fault);
    if (!sim.assistOn || sim.fault) return;
    const key = sim.assist.map(v => v.toFixed(1)).join(',');
    if (key === d.lastKey) return; d.lastKey = key;
    const c = d.acv, g = c.getContext('2d'), W = c.width, H = c.height, cx = W / 2, cy = H * 0.5;
    g.clearRect(0, 0, W, H);
    // 小车俯视
    const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#9aa0a8'); gr.addColorStop(0.5, '#e9ecef'); gr.addColorStop(1, '#9aa0a8');
    g.fillStyle = gr; g.beginPath(); g.roundRect(cx - 34, 40, 68, 140, 22); g.fill();
    g.fillStyle = 'rgba(30,40,55,.8)'; g.beginPath(); g.roundRect(cx - 25, 66, 50, 30, 8); g.fill(); g.beginPath(); g.roundRect(cx - 25, 128, 50, 22, 8); g.fill();
    const thr = [2.0, 1.3, 0.65], rad = [58, 76, 94], by = 176;
    const sectors = [[Math.PI / 2 + 0.34, Math.PI / 2 + 1.05], [Math.PI / 2 - 0.3, Math.PI / 2 + 0.3], [Math.PI / 2 - 1.05, Math.PI / 2 - 0.34]];
    g.lineCap = 'round'; g.lineWidth = 8;
    for (let s = 0; s < 3; s++) for (let r = 0; r < 3; r++) {
      const on = sim.assist[s] < thr[r]; g.strokeStyle = on ? SECTOR_COL[r] : 'rgba(255,255,255,.16)';
      g.beginPath(); g.arc(cx, by - 40, rad[r], sectors[s][0], sectors[s][1]); g.stroke();
    }
    d.adist.textContent = sim.minD < 2.2 ? sim.minD.toFixed(1) + ' m' : '—';
    d.adist.style.color = sim.minD < 0.65 ? '#ff453a' : sim.minD < 1.3 ? '#ff9f0a' : sim.minD < 2.2 ? '#ffd60a' : '';
  }

  window.RearCam = { draw, buildPanel, sim, setFault(v) { sim.fault = !!v; }, VIEWS };
})();
