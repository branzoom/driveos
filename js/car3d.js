/* 程序化 3D 车辆 + 驾驶可视化（FSD 风格）
 * 车身由侧面轮廓挤出 + 倒角得到，所以同一套代码可以生成轿车 / SUV / 掀背 / 皮卡，
 * 这也是“把界面套用到其他车型”的关键：只需要提供一组轮廓参数。
 * 坐标：x 向前，y 向上，z 向右（车辆左侧为 -z）。
 */
(function () {
  const PROFILES = {
    sedan: {
      label: 'Model 3', L: 4.72, W: 1.86, wheelX: 1.44, wr: 0.355, archR: 0.47, bottom: 0.24,
      front: [[2.30, 0.24], [2.38, 0.36], [2.41, 0.52]],
      top: [[2.37, 0.64], [2.15, 0.76], [1.6, 0.86], [1.0, 0.93], [0.0, 0.98], [-1.2, 0.99], [-1.95, 0.99], [-2.30, 0.96]],
      rear: [[-2.39, 0.82], [-2.41, 0.55], [-2.34, 0.30], [-2.24, 0.24]],
      glassBottom: 0.88, glassW: 1.42,
      glass: [[1.08, 0.91], [0.25, 1.38], [-0.35, 1.44], [-1.0, 1.39], [-1.75, 1.09], [-2.06, 0.95]],
      hood: [[1.0, 0.95], [2.28, 0.72]], trunk: [[-1.92, 1.02], [-2.33, 0.96]],
      hl: [2.27, 0.70], tl: [-2.36, 0.86], mirror: [0.95, 0.98], port: [-1.95, 0.80],
    },
    suv: {
      label: 'SUV', L: 4.76, W: 1.92, wheelX: 1.45, wr: 0.38, archR: 0.5, bottom: 0.30,
      front: [[2.30, 0.30], [2.38, 0.45], [2.41, 0.62]],
      top: [[2.37, 0.75], [2.12, 0.88], [1.5, 0.99], [1.0, 1.06], [0.0, 1.11], [-1.4, 1.13], [-2.2, 1.11]],
      rear: [[-2.37, 1.0], [-2.41, 0.7], [-2.36, 0.36], [-2.26, 0.30]],
      glassBottom: 1.0, glassW: 1.48,
      glass: [[1.02, 1.03], [0.12, 1.56], [-0.6, 1.63], [-1.5, 1.58], [-2.12, 1.32], [-2.3, 1.08]],
      hood: [[1.0, 1.07], [2.28, 0.84]], trunk: [[-2.05, 1.5], [-2.38, 0.86]],
      hl: [2.27, 0.82], tl: [-2.36, 0.98], mirror: [0.92, 1.1], port: [-1.98, 0.92],
    },
    hatch: {
      label: '掀背', L: 4.24, W: 1.82, wheelX: 1.3, wr: 0.34, archR: 0.45, bottom: 0.24,
      front: [[2.04, 0.24], [2.12, 0.38], [2.15, 0.54]],
      top: [[2.10, 0.65], [1.9, 0.78], [1.3, 0.90], [0.9, 0.96], [0.0, 1.0], [-1.6, 1.02], [-2.02, 1.0]],
      rear: [[-2.12, 0.88], [-2.15, 0.55], [-2.08, 0.30], [-1.98, 0.24]],
      glassBottom: 0.92, glassW: 1.40,
      glass: [[0.95, 0.94], [0.15, 1.43], [-0.8, 1.47], [-1.7, 1.41], [-2.05, 1.02]],
      hood: [[0.92, 0.97], [2.02, 0.72]], trunk: [[-1.75, 1.42], [-2.1, 0.86]],
      hl: [2.02, 0.70], tl: [-2.1, 0.9], mirror: [0.85, 1.0], port: [-1.75, 0.82],
    },
    pickup: {
      label: '皮卡', L: 5.0, W: 2.0, wheelX: 1.72, wr: 0.42, archR: 0.56, bottom: 0.36, angular: true,
      front: [[2.42, 0.36], [2.52, 0.62]],
      top: [[2.52, 0.80], [1.2, 1.12], [-2.45, 1.12]],
      rear: [[-2.52, 1.06], [-2.52, 0.45], [-2.42, 0.36]],
      glassBottom: 1.06, glassW: 1.56,
      glass: [[1.25, 1.09], [-0.05, 1.82], [-2.46, 1.16]],
      hood: [[1.25, 1.12], [2.48, 0.84]], trunk: [[-1.2, 1.18], [-2.46, 1.16]],
      hl: [2.5, 0.8], tl: [-2.5, 1.02], mirror: [1.1, 1.18], port: [-2.1, 0.95], lightbar: true,
    },
    // Cybertruck：真实车模加载失败 / 用 file:// 打开时的程序化备用车身（折线楔形）
    cybertruck: {
      label: 'Cybertruck', L: 5.2, W: 2.0, wheelX: 1.78, wr: 0.46, archR: 0.6, bottom: 0.4, angular: true,
      front: [[2.55, 0.42], [2.62, 0.6]],
      top: [[2.62, 0.8], [0.3, 1.7], [-2.6, 1.45]],
      rear: [[-2.62, 1.4], [-2.62, 0.5], [-2.5, 0.4]],
      glassBottom: 1.3, glassW: 1.6,
      glass: [[1.15, 1.37], [0.3, 1.73], [-1.8, 1.52]],
      hood: [[0.9, 1.5], [2.5, 0.83]], trunk: [[-1.3, 1.52], [-2.58, 1.44]],
      hl: [2.58, 0.82], tl: [-2.6, 1.2], mirror: [0.95, 1.35], port: [-2.2, 1.0], lightbar: true,
    },
  };

  let T; // THREE

  function contour(p) {
    const pts = [];
    const add = (x, y) => pts.push(new T.Vector2(x, y));
    const arch = (cx) => {
      const phi = Math.asin(Math.min(0.99, (p.wr - p.bottom) / p.archR));
      const a0 = Math.PI + phi, a1 = -phi, n = 22;
      for (let i = 0; i <= n; i++) {
        const a = a0 + (a1 - a0) * (i / n);
        add(cx + p.archR * Math.cos(a), p.wr + p.archR * Math.sin(a));
      }
    };
    // 底部：后 → 前，穿过两个轮拱
    const last = p.rear[p.rear.length - 1];
    add(last[0], last[1]);
    arch(-p.wheelX);
    arch(p.wheelX);
    p.front.forEach(([x, y]) => add(x, y));
    // 顶部曲线：前 → 后
    if (p.angular) p.top.forEach(([x, y]) => add(x, y));
    else new T.SplineCurve(p.top.map(([x, y]) => new T.Vector2(x, y))).getPoints(48).forEach(v => add(v.x, v.y));
    p.rear.slice(0, -1).forEach(([x, y]) => add(x, y));
    return new T.Shape(pts);
  }

  function glassShape(p) {
    const pts = [];
    if (p.angular) p.glass.forEach(([x, y]) => pts.push(new T.Vector2(x, y)));
    else new T.SplineCurve(p.glass.map(([x, y]) => new T.Vector2(x, y))).getPoints(40).forEach(v => pts.push(v));
    const r = p.glass[p.glass.length - 1], f = p.glass[0];
    pts.push(new T.Vector2(r[0] + 0.05, p.glassBottom), new T.Vector2(f[0] - 0.05, p.glassBottom));
    return new T.Shape(pts);
  }

  function extrude(shape, width, bevelT, bevelS, segs) {
    const depth = Math.max(0.01, width - bevelT * 2);
    const g = new T.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelThickness: bevelT, bevelSize: bevelS,
      bevelSegments: segs, curveSegments: 24, steps: 1,
    });
    g.translate(0, 0, -depth / 2);
    g.computeVertexNormals();
    return g;
  }

  // 构建一辆车（simple=true 时用于道路上的其他车辆）
  function buildCar(type, color, simple) {
    const p = PROFILES[type] || PROFILES.sedan;
    const car = new T.Group();
    const paint = simple
      ? new T.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, transparent: true })
      : new T.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 });
    const glassMat = simple
      ? new T.MeshStandardMaterial({ color: 0x6b7178, roughness: 0.4, transparent: true })
      : new T.MeshPhysicalMaterial({ color: 0x07090c, metalness: 0.3, roughness: 0.04, clearcoat: 1, envMapIntensity: 1.6 });
    const dark = new T.MeshStandardMaterial({ color: 0x15171a, roughness: 0.75 });

    const body = new T.Mesh(extrude(contour(p), p.W, 0.2, 0.08, simple ? 3 : 8), paint);
    body.castShadow = true; car.add(body);
    const glass = new T.Mesh(extrude(glassShape(p), p.glassW, 0.17, 0.04, simple ? 3 : 7), glassMat);
    glass.castShadow = true; car.add(glass);

    const under = new T.Mesh(new T.BoxGeometry(p.L * 0.86, 0.22, p.W * 0.86), dark);
    under.position.y = p.bottom + 0.12; car.add(under);

    // 车轮
    const wheels = [];
    const tireMat = new T.MeshStandardMaterial({ color: 0x111214, roughness: 0.92 });
    const rimMat = simple ? dark : new T.MeshStandardMaterial({ color: 0x9aa1a8, metalness: 0.85, roughness: 0.3 });
    const capMat = new T.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.6, roughness: 0.4 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const w = new T.Group();
      const tire = new T.Mesh(new T.CylinderGeometry(p.wr, p.wr, 0.25, 40), tireMat);
      tire.rotation.x = Math.PI / 2; w.add(tire);
      if (!simple) {
        const rim = new T.Mesh(new T.CylinderGeometry(p.wr * 0.7, p.wr * 0.7, 0.255, 40), rimMat);
        rim.rotation.x = Math.PI / 2; w.add(rim);
        for (let i = 0; i < 5; i++) {
          const spoke = new T.Mesh(new T.BoxGeometry(p.wr * 0.12, p.wr * 1.18, 0.02), capMat);
          spoke.rotation.z = (i / 5) * Math.PI * 2; spoke.position.z = sz * 0.128; w.add(spoke);
        }
        const cap = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.27, 20), capMat);
        cap.rotation.x = Math.PI / 2; w.add(cap);
      }
      w.position.set(sx * p.wheelX, p.wr, sz * (p.W / 2 - 0.16));
      w.traverse(o => { o.castShadow = true; });
      car.add(w); wheels.push(w);
    }

    const parts = { wheels, paint, glassMat, profile: p };
    if (simple) { car.userData = parts; return car; }

    // 灯具
    // 大灯：沿用原贴图做 LED 图案，外面一层透明玻璃灯罩（原模型前灯罩是半透明红色，把大灯整个压暗了）
    const hlMat = new T.MeshPhysicalMaterial({ color: 0x9aa3ad, emissive: 0xf4f8ff, emissiveIntensity: 0, metalness: 0.8, roughness: 0.15, clearcoat: 1, side: T.DoubleSide });
    const clearLens = new T.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.01, envMapIntensity: 2, transparent: true, opacity: 0.12, depthWrite: false, side: T.DoubleSide });
    const tlMat = new T.MeshStandardMaterial({ color: 0x7a0b10, emissive: 0xff1a1a, emissiveIntensity: 0.35 });
    const sigMat = new T.MeshStandardMaterial({ color: 0x5a3a00, emissive: 0xffa000, emissiveIntensity: 0 });
    for (const sz of [-1, 1]) {
      const hl = new T.Mesh(new T.BoxGeometry(0.16, 0.04, 0.42), hlMat);
      hl.position.set(p.hl[0], p.hl[1], sz * (p.W / 2 - 0.36)); hl.rotation.y = sz * 0.28; car.add(hl);
      const sg = new T.Mesh(new T.BoxGeometry(0.1, 0.03, 0.14), sigMat);
      sg.position.set(p.hl[0] - 0.06, p.hl[1] - 0.05, sz * (p.W / 2 - 0.16)); sg.rotation.y = sz * 0.5; car.add(sg);
      sg.userData.side = sz;
      (parts.signals = parts.signals || []).push(sg);
    }
    if (p.lightbar) {
      const bar = new T.Mesh(new T.BoxGeometry(0.04, 0.03, p.W * 0.9), hlMat);
      bar.position.set(p.hl[0] + 0.02, p.hl[1], 0); car.add(bar);
    }
    const tl = new T.Mesh(new T.BoxGeometry(0.05, 0.05, p.W * 0.86), tlMat);
    tl.position.set(p.tl[0], p.tl[1], 0); car.add(tl);
    parts.hlMat = hlMat; parts.tlMat = tlMat; parts.sigMat = sigMat;

    // 后视镜
    for (const sz of [-1, 1]) {
      const m = new T.Mesh(new T.SphereGeometry(0.1, 16, 12), paint);
      m.scale.set(0.9, 0.7, 1.4);
      m.position.set(p.mirror[0], p.mirror[1], sz * (p.W / 2 + 0.06)); m.castShadow = true;
      car.add(m); (parts.mirrors = parts.mirrors || []).push(m);
    }

    // 可开启的前备箱 / 后备箱盖板
    const lid = (seg, w) => {
      const [[hx, hy], [ex, ey]] = seg;
      const len = Math.hypot(ex - hx, ey - hy), a = Math.atan2(ey - hy, ex - hx);
      const pivot = new T.Group(); pivot.position.set(hx, hy + 0.035, 0); pivot.rotation.z = a;
      const slab = new T.Mesh(new T.BoxGeometry(len, 0.045, w), paint);
      slab.position.x = len / 2; slab.castShadow = true; pivot.add(slab);
      pivot.visible = false; pivot.userData.base = a; car.add(pivot);
      return pivot;
    };
    parts.hood = lid(p.hood, p.W * 0.8);
    parts.trunk = lid(p.trunk, p.W * 0.82);

    // 充电口（车辆左后方）
    const portMat = new T.MeshStandardMaterial({ color: 0x222, emissive: 0x18c964, emissiveIntensity: 0 });
    const port = new T.Mesh(new T.BoxGeometry(0.2, 0.14, 0.03), portMat);
    port.position.set(p.port[0], p.port[1], -(p.W / 2 + 0.005)); car.add(port);
    parts.portMat = portMat; parts.port = port;

    car.userData = parts;
    return car;
  }

  // ---------------------------------------------------------------
  // 真实车模（作者与许可见 models/CREDITS.md）。按车身类型登记：每种类型有自己的文件、构建函数和缓存的 Promise
  //   sedan      Model 3  （Draco 压缩，带车门 / 前后备箱枢轴）
  //   suv        Model Y  （可选，仓库不附带：CC BY-NC 4.0，仅限个人非商业使用；用户自备 models/tesla-model-y.glb 才会启用，否则使用程序化 SUV 车身）
  //   cybertruck Cybertruck（Meshopt 压缩，材质已按零件拆分，没有枢轴）
  // 需要通过 http(s) 打开页面；直接双击打开时浏览器不允许读取本地 GLB，会退回程序化车身
  const DRACO_PATH = 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/';
  const GLB_MODELS = {
    sedan: { url: 'models/tesla-model-3.glb', draco: true, label: 'Model 3', build: (src, color) => buildSedanGLB(src, color) },
    suv: { url: 'models/tesla-model-y.glb', optional: true, meshopt: true, label: 'Model Y', length: 4.76, build: (src, color, cfg) => buildModelY(src, color, cfg) },
    cybertruck: { url: 'models/tesla-cybertruck.glb', meshopt: true, label: 'Cybertruck', length: 5.0, build: (src, color, cfg) => buildCybertruck(src, color, cfg) },
  };
  const glbPromises = {};
  function loadGLB(type) {
    const cfg = GLB_MODELS[type];
    if (!cfg) return Promise.reject(new Error('该车型没有真实车模'));
    if (!glbPromises[type]) glbPromises[type] = new Promise((resolve, reject) => {
      if (!window.GLTFLoader || location.protocol === 'file:') return reject(new Error('GLB unavailable'));
      if (cfg.meshopt && !window.MeshoptDecoder) return reject(new Error('MeshoptDecoder unavailable'));
      const start = () => {
      const loader = new window.GLTFLoader();
      if (cfg.draco && window.DRACOLoader) { const draco = new window.DRACOLoader(); draco.setDecoderPath(DRACO_PATH); loader.setDRACOLoader(draco); }
      if (window.MeshoptDecoder) loader.setMeshoptDecoder(window.MeshoptDecoder);
      loader.load(cfg.url, g => resolve(g.scene), undefined, reject);
      };
      // 可选车模（仓库不附带）：先探测文件是否存在，不存在就安静地退回程序化车身，避免控制台出现 404
      if (cfg.optional) fetch(cfg.url, { method: 'HEAD' }).then(r => r.ok ? start() : reject(new Error('optional model not installed')), reject);
      else start();
    });
    return glbPromises[type];
  }
  function buildGLB(type, src, color) { const cfg = GLB_MODELS[type]; return cfg.build(src, color, cfg); }

  // 绕“世界 X 轴”（模型里的车宽方向）旋转某个节点，用于车轮滚动和前后备箱铰链
  function hinge(node) {
    const q0 = node.quaternion.clone();
    const axis = new T.Vector3(1, 0, 0).applyQuaternion(node.getWorldQuaternion(new T.Quaternion()).invert());
    const q = new T.Quaternion();
    return a => { node.quaternion.copy(q0).multiply(q.setFromAxisAngle(axis, a)); };
  }

  let glowTexture = null;
  function glowTex() { // 径向渐变光晕贴图（只生成一次）
    if (glowTexture) return glowTexture;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.8)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    return (glowTexture = new T.CanvasTexture(c));
  }

  // 大灯光束：路面上一片向前扇形展开、逐渐变暗的光（不用真实光源，避免开关灯时重新编译着色器）
  let beamTex = null;
  function fanTex() {
    const w = 256, h = 128, c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), img = g.createImageData(w, h);
    const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / (w - 1), v = Math.abs(y / (h - 1) * 2 - 1); // u 向前，v 横向
      const half = 0.3 + 0.7 * u; // 越远越宽
      const lat = 1 - ss(half * 0.55, half, v);
      const fwd = ss(0, 0.06, u) * Math.pow(1 - u, 1.2);
      const k = 255 * lat * fwd; img.data.set([k, k, k, 255], (y * w + x) * 4); // alphaMap 读的是绿色通道
    }
    g.putImageData(img, 0, 0);
    return new T.CanvasTexture(c);
  }
  function buildBeam(lamps) {
    beamTex = beamTex || fanTex();
    const g = new T.Group(); g.visible = false;
    const front = Math.max(...lamps.map(p => p.x)), LEN = 16, WID = 8;
    const fan = new T.Mesh(new T.PlaneGeometry(LEN, WID), new T.MeshBasicMaterial({ color: 0xe8efff, alphaMap: beamTex, transparent: true, opacity: 0.24, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
    fan.rotation.x = -Math.PI / 2; fan.position.set(front - 0.2 + LEN / 2, 0.03, 0); fan.renderOrder = 3;
    g.add(fan);
    return g;
  }

  function buildSedanGLB(src, color) {
    const model = src.clone(true);
    model.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(model), size = box.getSize(new T.Vector3());
    const S = 4.72 / Math.max(size.x, size.z), cz = (box.min.z + box.max.z) / 2;
    const k = v => v * S;

    const paint = new T.MeshPhysicalMaterial({ color, metalness: 0.45, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.25 });
    const glassMat = new T.MeshPhysicalMaterial({ color: 0x05080c, metalness: 0.2, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.5, transparent: true, opacity: 0.92 });
    // 大灯：沿用原贴图做 LED 图案，外面一层透明玻璃灯罩（原模型前灯罩是半透明红色，把大灯整个压暗了）
    const hlMat = new T.MeshPhysicalMaterial({ color: 0x9aa3ad, emissive: 0xf4f8ff, emissiveIntensity: 0, metalness: 0.8, roughness: 0.15, clearcoat: 1, side: T.DoubleSide });
    const clearLens = new T.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.01, envMapIntensity: 2, transparent: true, opacity: 0.12, depthWrite: false, side: T.DoubleSide });
    // 尾灯：深色灯罩 + 清漆反光，亮度由 applyGLB 按尾灯样式设置
    const tlMat = new T.MeshPhysicalMaterial({ color: 0x3a0306, emissive: 0xff1010, emissiveIntensity: 0.12, metalness: 0.3, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, side: T.DoubleSide });
    const lensMat = new T.MeshPhysicalMaterial({ color: 0x4a0508, metalness: 0.1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.01, envMapIntensity: 2, transparent: true, opacity: 0.55, depthWrite: false, side: T.DoubleSide });
    const signals = [];
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true;
      const n = o.parent.name.toLowerCase(), m = o.material.name;
      if (m === 'Paint') o.material = paint;
      else if (m.startsWith('glass')) o.material = glassMat;
      else if (m === 'ChargeFlap') o.visible = false; // 原模型这块盖板位置不准，隐藏
      // 尾灯：原材质自发光是白色，整块发亮像贴纸；改成内部 LED 图案（沿用原贴图）+ 外层熏红灯罩
      const rear = /right_rear_light|breaklight_l|tembus_red/.test(m) && !/indicat|light_turn/.test(n) && new T.Box3().setFromObject(o).getCenter(new T.Vector3()).z > cz; // 前灯也共用这些材质，只改车尾的
      if (rear && m !== 'tembus_red.0') {
        if (!tlMat.map && o.material.map) { tlMat.map = tlMat.emissiveMap = o.material.map; tlMat.needsUpdate = true; }
        o.material = tlMat; return;
      }
      if (rear) { o.material = lensMat; o.castShadow = false; return; }
      if (m.startsWith('tembus_red') && /depan/.test(n)) { o.material = clearLens; o.castShadow = false; return; }
      if (/lights_head|foglight/.test(n)) {
        if (!hlMat.map && o.material.map) { hlMat.map = hlMat.emissiveMap = o.material.map; hlMat.needsUpdate = true; }
        o.material = hlMat;
      }
      else if (/rear_lights|light_breake|breake_int|tembus_belakang|tembus_boot/.test(n)) o.material = tlMat;
      else if (/indicat|light_turn/.test(n)) {
        o.material = new T.MeshStandardMaterial({ color: 0x5a3a00, emissive: 0xffa000, emissiveIntensity: 0 });
        const c = new T.Box3().setFromObject(o).getCenter(new T.Vector3());
        o.userData.side = c.x < 0 ? -1 : 1; // 模型 -x 为左侧
        signals.push(o);
      }
    });

    // 后转向灯：原模型的后转向灯是平躺在尾门上的薄片，从车后几乎看不到。
    // 在尾灯外侧从车后打一条射线找到灯罩表面，放一个琥珀色光晕随转向灯闪烁
    const ray = new T.Raycaster(), meshes = [];
    model.traverse(o => o.isMesh && o.visible && meshes.push(o));
    // 大灯位置：从车前打射线找到两侧灯罩表面，开灯时从这里射出光束
    const hlAnchors = [-1, 1].map(side => {
      ray.set(new T.Vector3(side * 68, 0, box.min.z - 50), new T.Vector3(0, 0, 1));
      const hit = ray.intersectObjects(meshes, false)[0], a = new T.Object3D();
      a.position.copy(hit ? hit.point : new T.Vector3(side * 68, 0, box.min.z + 25));
      model.add(a); return a;
    });
    [-1, 1].forEach(side => {
      ray.set(new T.Vector3(side * 82, 23, box.max.z + 50), new T.Vector3(0, 0, -1));
      const hit = ray.intersectObjects(meshes, false)[0];
      const glow = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: 0xff9a10, blending: T.AdditiveBlending, transparent: true, depthWrite: false }));
      glow.position.copy(hit ? hit.point : new T.Vector3(side * 82, 23, box.max.z - 20)).add(new T.Vector3(0, 0, 2));
      glow.scale.setScalar(26); glow.visible = false; glow.renderOrder = 2;
      glow.userData.side = side; // 模型 -x 为左侧
      model.add(glow); signals.push(glow);
    });

    // 车轮：每根车轴一个节点，左右轮在同一网格里
    const wheels = ['wheels_285', 'wheels001_293'].map(nm => model.getObjectByName(nm)).filter(Boolean).map(w => ({ spin: hinge(w), a: 0 }));
    const bonnet = model.getObjectByName('bonnet_dummy_279'), boot = model.getObjectByName('boot_dummy_158');
    const lids = { frunk: bonnet && hinge(bonnet), trunk: boot && hinge(boot) };

    // 充电口灯（放在原模型充电口位置）
    const cd = model.getObjectByName('charge_dummy');
    const portMat = new T.MeshStandardMaterial({ color: 0x222222, emissive: 0x18c964, emissiveIntensity: 0 });
    const port = new T.Mesh(new T.BoxGeometry(2, 9, 13), portMat);
    const cp = cd ? cd.getWorldPosition(new T.Vector3()) : new T.Vector3(-87, 35, 199);
    port.position.set(box.min.x + 22, cp.y, cp.z + 6); port.visible = false; model.add(port);

    // 摆正：车头朝 +x、左侧朝 -z、落地、缩放到 4.72 m
    const fit = new T.Group(); fit.add(model);
    model.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -cz);
    fit.rotation.y = -Math.PI / 2; fit.scale.setScalar(S);
    const car = new T.Group(); car.add(fit);

    car.updateMatrixWorld(true);
    const beam = buildBeam(hlAnchors.map(a => car.worldToLocal(a.getWorldPosition(new T.Vector3()))));
    car.add(beam);

    const L = k(size.z), H = k(size.y), W = 1.92;
    const y = v => k(v - box.min.y), x = z => k(cz - z);
    const profile = {
      wr: 0.335, W, L,
      hood: [[x(-133), y(24)], [x(-235), y(5)]],
      trunk: [[x(169), y(60)], [x(250), y(30)]],
      glass: [[0, H]],
      port: [x(cp.z), y(cp.y)],
    };
    car.userData = { glb: true, paint, glassMat, hlMat, beam, tlMat, lensMat, sigMat: null, signals, wheels, lids, port, portMat, mirrors: [], profile };
    return car;
  }

  // ---- Model Y / Cybertruck 共用的小工具 ----
  function glbMaterials(color) {
    return {
      paint: new T.MeshPhysicalMaterial({ color, metalness: 0.45, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.25 }),
      glassMat: new T.MeshPhysicalMaterial({ color: 0x05080c, metalness: 0.2, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.5, transparent: true, opacity: 0.92 }),
      hlMat: new T.MeshPhysicalMaterial({ color: 0xc9d3de, emissive: 0xf4f8ff, emissiveIntensity: 0, metalness: 0.6, roughness: 0.15, clearcoat: 1, side: T.DoubleSide }),
      tlMat: new T.MeshPhysicalMaterial({ color: 0x3a0306, emissive: 0xff1010, emissiveIntensity: 0.12, metalness: 0.3, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, side: T.DoubleSide }),
    };
  }
  // 摆正：车长沿模型 z 轴；frontSign < 0 表示车头朝 -z（和 Model 3 一样），> 0 表示朝 +z。
  // 结果：车头朝 +x、左侧朝 -z、居中、落地、缩放到 length 米；widthK 只拉伸车宽（模型的 x 方向）
  function fitGLB(model, box, length, frontSign, widthK) {
    const size = box.getSize(new T.Vector3()), S = length / size.z;
    const fit = new T.Group(); fit.add(model);
    model.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    fit.rotation.y = frontSign < 0 ? -Math.PI / 2 : Math.PI / 2;
    fit.scale.set(S * (widthK || 1), S, S);
    const car = new T.Group(); car.add(fit); car.updateMatrixWorld(true);
    return { car, S };
  }
  // 用整车包围盒和向下的射线得到标签锚点所需的轮廓参数（没有真实枢轴 / 充电口时只用于放 HTML 标签）
  function glbProfile(car, ignore, wr) {
    const cb = new T.Box3().setFromObject(car), H = cb.max.y, fx = cb.max.x, rx = cb.min.x;
    const ray = new T.Raycaster(), meshes = [];
    car.traverse(o => o.isMesh && o.visible && !ignore.includes(o.material) && meshes.push(o));
    const topAt = x => { ray.set(new T.Vector3(x, H + 1, 0), new T.Vector3(0, -1, 0)); const h = ray.intersectObjects(meshes, false)[0]; return h ? h.point.y : H * 0.5; };
    return {
      wr, W: cb.max.z - cb.min.z, L: fx - rx,
      hood: [[fx - 1.3, topAt(fx - 1.3)], [fx - 0.15, topAt(fx - 0.15)]],
      trunk: [[rx + 1.0, topAt(rx + 1.0)], [rx + 0.3, topAt(rx + 0.3)]],
      glass: [[0, H]],
      port: [rx + 0.35, H * 0.5], // 只用来放“充电口”标签；这两个模型里没有可识别的充电口
    };
  }
  const shadowCasters = /^(exterior_paint|glass|tire_rubber|satin_trim)$/;

  // ---- Model Y（可选，用户自备；2025 Tesla Model Y by BloxBloger，CC BY-NC 4.0，仅限个人非商业使用，仓库不附带）----
  // 材质：exterior_paint 车漆 · glass 玻璃 · signature_led 大灯 · taillight_led 尾灯 · tire_rubber / wheel_finish / brake_rotor 车轮
  // 车头朝 -z，和 Model 3 相同；没有门 / 前后备箱 / 充电口枢轴，所以这些动画对它不起作用
  function buildModelY(src, color, cfg) {
    const model = src.clone(true);
    model.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(model);
    const { paint, glassMat, hlMat, tlMat } = glbMaterials(color);
    model.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material.name;
      o.castShadow = shadowCasters.test(m);
      if (m === 'exterior_paint') o.material = paint;
      else if (m === 'glass') o.material = glassMat;
      else if (m === 'signature_led') { o.material = hlMat; o.castShadow = false; }
      else if (m === 'taillight_led') { o.material = tlMat; o.castShadow = false; }
    });

    // 车轮：以每条轮胎为中心，把落在轮胎圆盘内的轮辐 / 刹车盘归到同一个枢轴节点，绕车宽方向（模型 x 轴）旋转；卡钳不转
    const tires = [], parts = [];
    model.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material.name;
      if (m === 'tire_rubber') tires.push(o);
      if (m === 'tire_rubber' || m === 'wheel_finish' || m === 'brake_rotor') parts.push(o);
    });
    const wheels = [], wheelR = [];
    tires.forEach(t => {
      const tb = new T.Box3().setFromObject(t), c = tb.getCenter(new T.Vector3()), R = (tb.max.y - tb.min.y) / 2;
      const pivot = new T.Group(); pivot.position.copy(c); model.add(pivot); model.updateMatrixWorld(true);
      parts.forEach(p => {
        const pc = new T.Box3().setFromObject(p).getCenter(new T.Vector3());
        if (Math.sign(pc.x) === Math.sign(c.x) && Math.abs(pc.x) > 0.5 && Math.hypot(pc.y - c.y, pc.z - c.z) < R * 0.9) pivot.attach(p);
      });
      wheels.push({ spin: a => { pivot.rotation.x = a; }, a: 0 }); wheelR.push(R);
    });

    const { car, S } = fitGLB(model, box, cfg.length, -1, 1);
    const profile = glbProfile(car, [glassMat], (wheelR.length ? wheelR.reduce((a, b) => a + b, 0) / wheelR.length : 0.37) * S);
    const lamp = { x: profile.L / 2 };
    const beam = buildBeam([lamp]); car.add(beam);
    car.userData = { glb: true, paint, glassMat, hlMat, beam, tlMat, lensMat: null, sigMat: null, signals: [], wheels, lids: {}, port: null, portMat: null, mirrors: [], profile };
    return car;
  }

  // ---- Cybertruck（Tesla Cybertruck 2025 by Nieve5677，CC BY 4.0）----
  // 整车只有一个 exterior_steel 材质，车轮 / 玻璃 / 灯没有拆开，所以：不转车轮、不换玻璃材质、没有可点亮的灯，
  // 车漆颜色按“钢色 × 所选颜色”叠加（轮胎和玻璃也会跟着变色）。
  // 原模型车头朝 +z（和 Model 3 相反）；车宽比真车窄了约 1/3，这里按 widthK 拉回；
  // 车顶上方漂浮着 3 个小的多面体（desirefxme_002~004，不属于车身），去掉。
  function buildCybertruck(src, color, cfg) {
    const model = src.clone(true);
    const strays = [];
    model.traverse(o => o.isMesh && /^desirefxme_00[234]$/.test(o.name) && strays.push(o));
    strays.forEach(o => o.removeFromParent());
    model.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(model);
    let orig = null; model.traverse(o => { if (o.isMesh && !orig) orig = o.material; });
    const base = orig && orig.color ? orig.color.clone() : new T.Color(0.7, 0.75, 0.8);
    base.multiplyScalar(1 / Math.max(base.r, base.g, base.b, 1e-3)); // 归一化，只取钢材的色调
    const paint = new T.MeshPhysicalMaterial({ metalness: 0.45, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.25 });
    // models/tesla-cybertruck.glb（本地改动版）把原来的单一钢材质按零件拆成了 glass / tire / rim / headlight / taillight，这几类不再跟车衣变色
    const { glassMat, hlMat, tlMat } = glbMaterials(color);
    const tireMat = new T.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.9, metalness: 0 });
    const trimMat = new T.MeshStandardMaterial({ color: 0x15171a, roughness: 0.55, metalness: 0.75 });
    const bedMat = new T.MeshStandardMaterial({ color: 0x0f1012, roughness: 0.7, metalness: 0.8 });
    const mirrorMat = new T.MeshStandardMaterial({ color: 0x111214, roughness: 0.5, metalness: 0.1 });
    const wiperMat = new T.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.95, metalness: 0 });
    const rimMat = new T.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.5, metalness: 0.8 });
    model.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material.name; o.castShadow = true;
      if (m === 'glass') { o.material = glassMat; o.castShadow = false; }
      else if (m === 'tire') o.material = tireMat;
      else if (m === 'rim') o.material = rimMat;
      else if (m === 'wiper') o.material = wiperMat;
      else if (m === 'mirror') o.material = mirrorMat;
      else if (m === 'trim') o.material = trimMat;
      else if (m === 'bedcover') o.material = bedMat;
      else if (m === 'headlight') { o.material = hlMat; o.castShadow = false; }
      else if (m === 'taillight') { o.material = tlMat; o.castShadow = false; }
      else o.material = paint;
    });
    const { car } = fitGLB(model, box, cfg.length, 1, 1.55);
    const profile = glbProfile(car, [glassMat], 0.46);
    const beam = buildBeam([{ x: profile.L / 2 }]); car.add(beam);
    const u = { glb: true, paint, paintBase: base, glassMat, hlMat, beam, tlMat, lensMat: null, sigMat: null, signals: [], wheels: [], lids: {}, port: null, portMat: null, mirrors: [], profile };
    car.userData = u; tintPaint(u, color);
    return car;
  }
  function tintPaint(u, c) { u.paint.color.set(c); if (u.paintBase) u.paint.color.multiply(u.paintBase); }

  function create(host, opts) {
    T = window.THREE;
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = T.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const scene = new T.Scene();
    const pmrem = new T.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new window.RoomEnvironment(), 0.04).texture;

    const camera = new T.PerspectiveCamera(30, 1, 0.1, 400);
    const hemi = new T.HemisphereLight(0xffffff, 0x8a8f96, 0.9); scene.add(hemi);
    const sun = new T.DirectionalLight(0xffffff, 1.6);
    sun.position.set(4, 10, 3); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 8; sun.shadow.bias = -0.0004;
    Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 });
    scene.add(sun); scene.add(sun.target);

    // 展厅地面：车辆下方带渐隐的镜面倒影（参照新版车机的车辆展示）
    let floor = null;
    if (window.Reflector) {
      floor = new window.Reflector(new T.CircleGeometry(10, 72), {
        textureWidth: 1024, textureHeight: 1024, color: 0xffffff,
        shader: {
          name: 'FadingReflector',
          uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uOpacity: { value: 0.32 } },
          vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec2 vPos;
            void main() { vUv = textureMatrix * vec4(position, 1.0); vPos = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
          fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; uniform float uOpacity; varying vec4 vUv; varying vec2 vPos;
            void main() {
              vec4 base = texture2DProj(tDiffuse, vUv);
              float r = length(vPos * vec2(0.5, 1.0));
              float a = (1.0 - smoothstep(0.6, 3.4, r)) * uOpacity;
              gl_FragColor = vec4(base.rgb * color, a);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }`,
        },
      });
      floor.material.transparent = true; floor.material.depthWrite = false;
      floor.rotation.x = -Math.PI / 2; floor.position.y = -0.002;
      scene.add(floor);
    }

    const shadowMat = new T.ShadowMaterial({ opacity: 0.22 });
    const ground = new T.Mesh(new T.PlaneGeometry(40, 40), shadowMat);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

    // ---- 驾驶场景（道路 / 车道线 / 其他车辆）----
    const road = new T.Group(); scene.add(road); road.visible = false;
    const laneMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    const edgeMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    const roadMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.05 });

    // ---- 弯道：道路、车道线、其他车辆、路径都沿导航路线弯曲 ----
    // 逻辑上仍是一条笔直的道路（x 向前、z 向右，本车在原点）；绘制时把 (x, z) 映射到路线上：
    // 位置 = C(x) + z·N(x)，C 为路线中心（中间车道）在本车坐标系里的形状，N 为其右侧法线
    const CV_STEP = 4, CV_MIN = -48, CV_MAX = 264, CV_N = (CV_MAX - CV_MIN) / CV_STEP + 1, CV_I0 = -CV_MIN / CV_STEP;
    const cvX = new Float32Array(CV_N), cvZ = new Float32Array(CV_N), cvT = new Float32Array(CV_N), cvRaw = new Float32Array(CV_N);
    let track = null, junctions = [], station = null;
    const wrapDeg = d => ((d + 540) % 360) - 180;
    function computeCurve() {
      cvRaw[0] = 0;
      if (track) {
        let prev = track(CV_MIN);
        for (let i = 1; i < CV_N; i++) { const b = track(CV_MIN + i * CV_STEP); cvRaw[i] = cvRaw[i - 1] + wrapDeg(b - prev) * Math.PI / 180; prev = b; }
      } else cvRaw.fill(0);
      // 平滑：把路口的急弯放缓一些，避免弯道内侧的路沿折叠
      for (let i = 0; i < CV_N; i++) { let sum = 0, n = 0; for (let k = -3; k <= 3; k++) { const j = i + k; if (j >= 0 && j < CV_N) { sum += cvRaw[j]; n++; } } cvT[i] = sum / n; }
      const t0 = cvT[CV_I0]; for (let i = 0; i < CV_N; i++) cvT[i] -= t0;
      cvX[CV_I0] = 0; cvZ[CV_I0] = 0;
      for (let i = CV_I0 + 1; i < CV_N; i++) { const t = (cvT[i] + cvT[i - 1]) / 2; cvX[i] = cvX[i - 1] + CV_STEP * Math.cos(t); cvZ[i] = cvZ[i - 1] + CV_STEP * Math.sin(t); }
      for (let i = CV_I0 - 1; i >= 0; i--) { const t = (cvT[i] + cvT[i + 1]) / 2; cvX[i] = cvX[i + 1] - CV_STEP * Math.cos(t); cvZ[i] = cvZ[i + 1] - CV_STEP * Math.sin(t); }
    }
    const bentOut = [0, 0, 0];
    function bend(x, z) {
      const f = Math.max(0, Math.min(CV_N - 1.0001, (x - CV_MIN) / CV_STEP)), i = Math.floor(f), u = f - i;
      const t = cvT[i] + (cvT[i + 1] - cvT[i]) * u, over = x - (CV_MIN + f * CV_STEP), c = Math.cos(t), sn = Math.sin(t);
      bentOut[0] = cvX[i] + (cvX[i + 1] - cvX[i]) * u + over * c - z * sn;
      bentOut[1] = cvZ[i] + (cvZ[i + 1] - cvZ[i]) * u + over * sn + z * c;
      bentOut[2] = t;
      return bentOut;
    }
    // 把一个“逻辑坐标”的物体挂在 pivot 下：pivot 让它落在弯道上的正确位置和朝向
    function placeOn(pv, x) {
      const [px, pz, t] = bend(x, 0);
      pv.position.set(px - x * Math.cos(t), 0, pz - x * Math.sin(t)); pv.rotation.y = -t;
    }
    const pivoted = obj => { const pv = new T.Group(); pv.add(obj); road.add(pv); return pv; };

    // 带状网格：路面、路沿线等，每帧沿弯道重新生成；路口处可以断开
    const RIB_N = 120, ribbons = [];
    const ribMat = (color, opacity) => new T.ShaderMaterial({
      transparent: true, depthWrite: false, side: T.DoubleSide,
      uniforms: { uColor: { value: new T.Color(color) }, uOpacity: { value: opacity } },
      vertexShader: 'attribute float alpha; varying float vA; varying vec2 vUv; void main(){ vA = alpha; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; varying float vA; varying vec2 vUv; void main(){ float f = smoothstep(1.0, 0.72, vUv.y) * smoothstep(0.0, 0.06, vUv.y); gl_FragColor = vec4(uColor, uOpacity * vA * f); }',
    });
    function ribbon(z0, z1, mat, { y = 0.01, gap = false } = {}) {
      const g = new T.BufferGeometry(), pos = new Float32Array((RIB_N + 1) * 6), uv = new Float32Array((RIB_N + 1) * 4), al = new Float32Array((RIB_N + 1) * 2).fill(1), idx = [];
      for (let i = 0; i <= RIB_N; i++) { uv.set([0, i / RIB_N, 1, i / RIB_N], i * 4); if (i < RIB_N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setAttribute('alpha', new T.BufferAttribute(al, 1)); g.setIndex(idx);
      const m = new T.Mesh(g, mat); m.frustumCulled = false; road.add(m);
      const r = { g, z0, z1, y, gap }; ribbons.push(r); return r;
    }
    function updateRibbon(r) {
      const pos = r.g.attributes.position.array, al = r.g.attributes.alpha.array;
      for (let i = 0; i <= RIB_N; i++) {
        const x = CV_MIN + 8 + (CV_MAX - CV_MIN - 8) * i / RIB_N;
        const a = bend(x, r.z0); pos[i * 6] = a[0]; pos[i * 6 + 1] = r.y; pos[i * 6 + 2] = a[1];
        const b = bend(x, r.z1); pos[i * 6 + 3] = b[0]; pos[i * 6 + 4] = r.y; pos[i * 6 + 5] = b[1];
        let v = 1; if (r.gap) for (const j of junctions) if (Math.abs(x - j) < 13.5) v = 0;
        al[i * 2] = al[i * 2 + 1] = v;
      }
      r.g.attributes.position.needsUpdate = true; r.g.attributes.alpha.needsUpdate = true;
    }
    const roadRib = ribMat(0x000000, 0.05), shoulderRib = ribMat(0x000000, 0.03), edgeRib = ribMat(0xffffff, 1);
    ribbon(-5.5, 5.5, roadRib, { y: 0.002 });
    ribbon(5.5, 9.0, shoulderRib, { y: 0.002 });        // 应急车道（路肩）
    ribbon(-5.57, -5.43, edgeRib, { gap: true });       // 左侧（中央隔离带）
    ribbon(5.43, 5.57, edgeRib, { gap: true });         // 右侧车道边线
    ribbon(8.93, 9.07, edgeRib, { gap: true });         // 路沿
    // 对向车道：中央双黄线 + 三条对向车道（车道中心 -8.8 / -12.4 / -16.0）
    const yellowRib = ribMat(0xd9b44a, 1);
    ribbon(-17.8, -7.0, roadRib, { y: 0.002 });
    ribbon(-6.13, -5.97, yellowRib, { gap: true });
    ribbon(-6.63, -6.47, yellowRib, { gap: true });
    ribbon(-17.87, -17.73, edgeRib, { gap: true });
    const dashes = [];
    for (const z of [-1.8, 1.8, -10.6, -14.2]) for (let i = 0; i < 34; i++) {
      const d = new T.Mesh(new T.BoxGeometry(3, 0.01, 0.13), laneMat);
      d.position.set(-44 + i * 9, 0.01, z); dashes.push(d); d.userData.pv = pivoted(d);
    }
    // 路口：横向道路的路面和路沿、两侧斑马线
    // 红绿灯：灯头挂在横杆上，三个灯分别是红 / 黄 / 绿
    const LAMP_ON = { red: 0xff3b30, yellow: 0xffc400, green: 0x2fd27a }, LAMP_OFF = 0x2a2c30;
    const STOP_DX = -19; // 停止线相对路口中心的位置
    const junctionPool = [0, 1, 2].map(() => {
      const g = new T.Group();
      const surf = new T.Mesh(new T.PlaneGeometry(24.6, 110), roadMat); surf.rotation.x = -Math.PI / 2; surf.position.set(0, 0.003, -4); g.add(surf);
      for (const dx of [-12.3, 12.3]) for (const [z, len] of [[-36, 36], [27, 36]]) { const e = new T.Mesh(new T.BoxGeometry(0.14, 0.01, len), edgeMat); e.position.set(dx, 0.01, z); g.add(e); }
      for (const dx of [-16, 16]) for (let z = -17.2; z <= 8.6; z += 1.2) { if (z > -7.2 && z < -5.4) continue; const st = new T.Mesh(new T.BoxGeometry(2.6, 0.01, 0.55), laneMat); st.position.set(dx, 0.012, z); g.add(st); }
      const stop = new T.Mesh(new T.BoxGeometry(0.45, 0.01, 10.9), laneMat); stop.position.set(STOP_DX, 0.012, 0); g.add(stop);
      const stop2 = new T.Mesh(new T.BoxGeometry(0.45, 0.01, 10.6), laneMat); stop2.position.set(-STOP_DX, 0.012, -12.4); g.add(stop2);
      const metal = new T.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.6, metalness: 0.4 });
      const pole = new T.Mesh(new T.CylinderGeometry(0.12, 0.14, 6, 12), metal); pole.position.set(-14, 3, 10.2); g.add(pole);
      const arm = new T.Mesh(new T.BoxGeometry(0.16, 0.16, 11.5), metal); arm.position.set(-14, 5.8, 4.5); g.add(arm);
      const head = new T.Mesh(new T.BoxGeometry(0.4, 1.5, 0.55), metal); head.position.set(-14, 5.05, 1.2); g.add(head);
      const lamps = {};
      [['red', 5.5], ['yellow', 5.05], ['green', 4.6]].forEach(([k, y]) => {
        const m = new T.MeshBasicMaterial({ color: LAMP_OFF }), l = new T.Mesh(new T.SphereGeometry(0.17, 14, 10), m);
        l.position.set(-14.22, y, 1.2); g.add(l); lamps[k] = m;
      });
      // 红灯时横向道路放行：两辆车从路口横穿
      const cross = [buildVehicle('sedan', 0xb3b8be), buildVehicle('suv', 0x9ea4ab)];
      cross[0].rotation.y = -Math.PI / 2; cross[0].position.x = -5.4;
      cross[1].rotation.y = Math.PI / 2; cross[1].position.x = 5.4;
      cross.forEach(c => g.add(c));
      return { g, pv: pivoted(g), lamps, cross };
    });
    // 超级充电站：路边一排充电桩（导航去充电站时出现在目的地）
    const stationGroup = new T.Group();
    const postMat = new T.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.35, metalness: 0.1, transparent: true });
    const postRed = new T.MeshStandardMaterial({ color: 0xe31937, roughness: 0.4, transparent: true });
    for (let k = 0; k < 5; k++) {
      const post = new T.Mesh(new T.BoxGeometry(0.32, 1.55, 0.5), postMat); post.position.set(k * 3.2 - 6.4, 0.78, 10.4); post.castShadow = true; stationGroup.add(post);
      const cap = new T.Mesh(new T.BoxGeometry(0.34, 0.22, 0.52), postRed); cap.position.set(k * 3.2 - 6.4, 1.45, 10.4); stationGroup.add(cap);
    }
    const stationBay = new T.Mesh(new T.PlaneGeometry(18, 3.4), roadMat); stationBay.rotation.x = -Math.PI / 2; stationBay.position.set(0, 0.004, 7.25); stationGroup.add(stationBay);
    const stationPv = pivoted(stationGroup); stationPv.visible = false;
    // Autopilot 行驶路径：一条可弯曲的带状网格，变道时前端先弯向目标车道
    // 着色器同时负责蓝色路径和“彩虹路”（彩虹沿路径向前流动，车速越快流得越快）
    const PATH_N = 90, PATH_LEN = 170, PATH_W = 1.7;
    const pathGeo = new T.BufferGeometry();
    const pathPos = new Float32Array((PATH_N + 1) * 2 * 3), pathUv = new Float32Array((PATH_N + 1) * 2 * 2), pathIdx = [];
    for (let i = 0; i <= PATH_N; i++) {
      const v = i / PATH_N;
      pathUv.set([0, v, 1, v], i * 4);
      if (i < PATH_N) { const a = i * 2; pathIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    pathGeo.setAttribute('position', new T.BufferAttribute(pathPos, 3));
    pathGeo.setAttribute('uv', new T.BufferAttribute(pathUv, 2));
    pathGeo.setIndex(pathIdx);
    const pathMat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, side: T.DoubleSide,
      uniforms: { uOpacity: { value: 0 }, uRainbow: { value: 0 }, uPhase: { value: 0 }, uColor: { value: new T.Color(0x3e6ae1) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        varying vec2 vUv; uniform float uOpacity, uRainbow, uPhase; uniform vec3 uColor;
        vec3 hsv(float h){ vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); return k; }
        void main(){
          float d = vUv.y * ${PATH_LEN.toFixed(1)};
          float edge = uRainbow > 0.5 ? smoothstep(0.0, 0.03, vUv.x) * smoothstep(1.0, 0.97, vUv.x) : smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
          float ends = uRainbow > 0.5 ? 1.0 : smoothstep(0.0, 0.03, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
          vec3 col = uColor; float a = 0.55;
          if (uRainbow > 0.5) {
            // 参考特斯拉真机：色相沿路径分布（洋红 → 紫 → 蓝 → 绿 → 黄 → 橙红，循环），
            // 两侧是发亮的蓝色边线，中间柔和发光，越远越淡；只有轻微的光带流动
            float dist = pow(vUv.y, 1.35) * ${PATH_LEN.toFixed(1)};
            // 色相沿路径循环，并随时间朝车尾方向滚动（车速越快滚得越快）
            float flow = dist + uPhase * 0.8;
            float h = fract(0.84 - flow / 46.0);
            vec3 base = hsv(h);
            base = mix(vec3(dot(base, vec3(0.333))), base, 1.25);        // 提高饱和度
            // 一道道朝车尾移动的亮光带（光晕）
            float wave = 0.5 + 0.5 * sin(flow * 0.42);
            float shimmer = 0.78 + 0.34 * wave * wave;
            float side = min(vUv.x, 1.0 - vUv.x);
            float rail = 1.0 - smoothstep(0.0, 0.085, side);              // 两侧蓝色边线
            float glow = smoothstep(0.0, 0.5, side);                      // 中间更实、边缘柔
            vec3 railCol = vec3(0.22, 0.42, 1.0);
            col = mix(base * shimmer, railCol, rail * 0.9) + 0.06;
            float fade = 1.0 - smoothstep(35.0, 78.0, dist);              // 远处淡出
            a = (0.6 + 0.3 * glow) * (0.8 + 0.3 * wave * wave) * fade; a = mix(a, 0.95, rail * fade);
            a *= smoothstep(0.0, 0.04, dist / 6.0);                       // 车头处淡入
          }
          gl_FragColor = vec4(col, a * edge * ends * uOpacity);
        }`,
    });
    const path = new T.Mesh(pathGeo, pathMat);
    path.frustumCulled = false; path.renderOrder = 2; road.add(path);
    let pathPhase = 0;
    // 更新路径形状：z(x) 从本车位置平滑过渡到目标车道
    function updatePath(fromZ, toZ) {
      for (let i = 0; i <= PATH_N; i++) {
        const t = i / PATH_N, x = 2.6 + Math.pow(t, 1.35) * PATH_LEN;
        const k = Math.min(1, Math.max(0, (x - 4) / 22)), s = k * k * (3 - 2 * k);
        const z = fromZ + (toZ - fromZ) * s;
        const a = bend(x, z - PATH_W / 2); pathPos[i * 6] = a[0]; pathPos[i * 6 + 1] = 0.02; pathPos[i * 6 + 2] = a[1];
        const b = bend(x, z + PATH_W / 2); pathPos[i * 6 + 3] = b[0]; pathPos[i * 6 + 4] = 0.02; pathPos[i * 6 + 5] = b[1];
      }
      pathGeo.attributes.position.needsUpdate = true;
    }
    computeCurve(); updatePath(0, 0);

    // 周围车辆的车型：轿车 / SUV / 掀背 / 皮卡沿用程序化车身，另外有大货车、公交车、摩托车
    // half：半车长（米），用于跟车距离和碰撞；speedK：相对车道速度的系数（大车慢、摩托快）
    const KINDS = {
      sedan: { half: 2.35, halfW: 0.95, speedK: 1 }, suv: { half: 2.4, halfW: 1, speedK: 1 }, hatch: { half: 2.1, halfW: 0.9, speedK: 1 }, pickup: { half: 2.8, halfW: 1, speedK: 0.95 },
      truck: { half: 4.7, halfW: 1.25, speedK: 0.8 }, bus: { half: 5.8, halfW: 1.27, speedK: 0.82 }, moto: { half: 1.05, halfW: 0.4, speedK: 1.12 },
    };
    function buildVehicle(kind, color) {
      if (!['truck', 'bus', 'moto'].includes(kind)) return buildCar(kind, color, true);
      const g = new T.Group();
      const paint = new T.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, transparent: true });
      const glassMat = new T.MeshStandardMaterial({ color: 0x5d636a, roughness: 0.4, transparent: true });
      const darkM = new T.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.8 });
      const box = (w, h, l, x, y, z, m) => { const b = new T.Mesh(new T.BoxGeometry(l, h, w), m); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; };
      const wheels = [];
      const wheel = (x, z, r, w) => { const wg = new T.Group(); const t = new T.Mesh(new T.CylinderGeometry(r, r, w, 24), darkM); t.rotation.x = Math.PI / 2; wg.add(t); wg.position.set(x, r, z); g.add(wg); wheels.push(wg); };
      if (kind === 'truck') {
        box(2.4, 2.9, 6.6, -1.35, 1.95, 0, paint);           // 货箱
        box(2.3, 2.3, 2.1, 3.15, 1.6, 0, paint);              // 驾驶室
        box(2.18, 0.9, 0.06, 4.21, 2.15, 0, glassMat);        // 前挡风
        box(2.3, 0.35, 8.9, 0, 0.55, 0, darkM);               // 底盘
        for (const x of [3.2, -2.6, -3.9]) for (const z of [-1.05, 1.05]) wheel(x, z, 0.5, 0.35);
      } else if (kind === 'bus') {
        box(2.5, 2.75, 11.4, 0, 1.75, 0, paint);
        box(2.52, 0.95, 10.4, -0.3, 2.25, 0, glassMat);       // 侧窗带
        box(2.3, 1.3, 0.06, 5.71, 2.0, 0, glassMat);          // 前挡风
        for (const x of [3.9, -3.4]) for (const z of [-1.1, 1.1]) wheel(x, z, 0.52, 0.32);
      } else {
        box(0.32, 0.45, 1.5, 0, 0.72, 0, paint);              // 车身
        box(0.36, 0.55, 0.42, -0.15, 1.18, 0, darkM);         // 骑手身体
        const helmet = new T.Mesh(new T.SphereGeometry(0.17, 16, 12), paint); helmet.position.set(0.02, 1.58, 0); g.add(helmet);
        for (const x of [0.78, -0.72]) wheel(x, 0, 0.32, 0.12);
      }
      g.userData = { wheels, paint, glassMat };
      return g;
    }

    // 其他车辆：每辆车都有自己的绝对速度，屏幕上的移动 = 它的速度 - 本车速度
    const LANE = 3.6;
    // 各车道的车速区间（km/h）：最左侧为超车道，最快；最右侧最慢
    const LANE_SPEED = { '-1': [78, 98], '0': [55, 72], '1': [40, 56] };
    const laneSpeed = lane => { const [a, b] = LANE_SPEED[lane]; return a + Math.random() * (b - a); };
    const laneBase = (lane, c) => laneSpeed(lane) * (c ? c.userData.speedK : 1);
    const traffic = [];
    const tColors = [0xb8bdc3, 0xa9aeb5, 0xc4c8cd, 0x9ea4ab, 0xd6d8da, 0x8f959c];
    const SPAWN = [['sedan', 0, 30], ['suv', -1, 10], ['truck', 1, 48], ['sedan', -1, 82], ['moto', 0, -16], ['bus', 1, 105], ['hatch', 0, 70], ['pickup', -1, -30], ['moto', -1, 140], ['suv', 1, -12], ['truck', 0, 135]];
    SPAWN.forEach(([t, lane, x], i) => {
      const c = buildVehicle(t, tColors[i % tColors.length]);
      c.position.set(x, 0, lane * LANE);
      Object.assign(c.userData, KINDS[t], { kind: t, lane, x0: x, lane0: lane, v: 0, boost: 0, boostV: 0, tint: new T.Color(tColors[i % tColors.length]) });
      c.userData.base = laneBase(lane, c);
      c.userData.pv = pivoted(c); traffic.push(c);
    });
    const RED = new T.Color(0xff2d2d);

    // 对向来车：只做视觉，不与本车交互；遇红灯在对面停止线前停下
    const ONCOMING = ['suv', 'sedan', 'truck', 'hatch', 'moto', 'bus', 'sedan', 'pickup', 'suv'];
    const oncoming = ONCOMING.map((t, i) => {
      const c = buildVehicle(t, tColors[(i + 2) % tColors.length]);
      c.rotation.y = Math.PI;
      const lane = i % 3;
      Object.assign(c.userData, KINDS[t], { lane, base: (62 - lane * 8 + Math.random() * 10) * KINDS[t].speedK });
      c.userData.v = c.userData.base;
      c.position.set(-40 + i * 32, 0, -8.8 - lane * 3.6);
      c.userData.pv = pivoted(c);
      return c;
    });
    function stepOncoming(dt) {
      for (const c of oncoming) {
        const u = c.userData;
        let want = u.base;
        // 前车（对向车辆的“前方”是 x 更小的方向）
        for (const o of oncoming) {
          if (o === c || o.userData.lane !== u.lane || o.position.x >= c.position.x) continue;
          const g = c.position.x - o.position.x - (o.userData.half + u.half);
          if (g < 12) want = Math.min(want, o.userData.v - (12 - g) * 2);
        }
        for (const L of lights) {
          const d = (c.position.x - u.half) - (L.x - STOP_DX);
          if (d < -0.5 || L.state === 'green' || (L.state === 'yellow' && d < 18)) continue;
          if (d < 40) want = Math.min(want, Math.max(0, d - 1) * 2.2);
          break;
        }
        u.v += Math.max(-40 * dt, Math.min(8 * dt, want - u.v)); u.v = Math.max(0, u.v);
        c.position.x -= (u.v + speed) / 3.6 * dt;
        if (c.position.x < -60) { c.position.x = 230 + Math.random() * 60; u.v = u.base; }
        if (c.position.x > 300) c.position.x = -55;
        u.wheels.forEach(w => { w.rotation.z -= u.v / 3.6 * dt / 0.36; });
      }
    }
    let lights = []; // [{ x: 路口距离, state: 'red' | 'yellow' | 'green' }]

    // 本车所在车道（-1 左 / 0 中 / 1 右）与变道状态
    // 驻车时车停在路边（应急车道），起步后需要打左灯并入车流
    const PARK_LANE = 2;
    let egoLane = PARK_LANE, egoZ = PARK_LANE * 3.6, laneReq = null, laneMoving = false, laneFrom = 0, lastCrash = 0;
    const blind = { left: false, right: false };
    const emit = (type, data) => api.onEvent && api.onEvent(type, data);

    function resetTraffic() {
      traffic.forEach(c => { const u = c.userData; u.lane = u.lane0; u.base = laneBase(u.lane, c); c.position.set(u.x0, 0, u.lane * LANE); u.v = u.base; u.boost = 0; });
      egoLane = PARK_LANE; egoZ = PARK_LANE * LANE; laneReq = null; laneMoving = false;
      blind.left = blind.right = false; emit('blind', { ...blind });
    }

    function stepTraffic(dt) {
      const egoKmh = speed;
      let left = false, right = false;
      for (const c of traffic) {
        const u = c.userData;
        let want = u.base;
        if (u.boost > 0) { u.boost -= dt; want = u.boostV; }
        // 简单跟车模型：与同车道前车（包括本车）保持距离
        let gap = Infinity, vAhead = 0;
        for (const o of traffic) {
          if (o === c || o.userData.lane !== u.lane || o.position.x <= c.position.x) continue;
          const g = o.position.x - c.position.x - (o.userData.half + u.half - 4.7);
          if (g < gap) { gap = g; vAhead = o.userData.v; }
        }
        if (u.lane === egoLane && c.position.x < 0 && -c.position.x - (u.half - 2.35) < gap) { gap = -c.position.x - (u.half - 2.35); vAhead = egoKmh; }
        // 红灯 / 来不及通过的黄灯：停止线相当于一辆停着的车
        for (const L of lights) {
          const d = L.x + STOP_DX - (c.position.x + u.half);
          if (d < -0.5 || L.state === 'green' || (L.state === 'yellow' && d < 18)) continue;
          if (d + 4.7 < gap) { gap = d + 4.7; vAhead = 0; }
          break;
        }
        if (gap < 16) want = Math.min(want, vAhead - (16 - gap) * 1.2);
        if (gap < 7) want = Math.min(want, vAhead - 6);
        const acc = u.boost > 0 ? 24 : 7;
        u.v += Math.max(-35 * dt, Math.min(acc * dt, want - u.v));
        u.v = Math.max(0, u.v);
        c.position.x += (u.v - egoKmh) / 3.6 * dt;
        // 驶出视野后在前方或后方重新出现
        // 驶出视野后重新出现：比本车快的从后方追上来，比本车慢的出现在前方
        if (c.position.x > 160 || c.position.x < -50) {
          u.base = laneBase(u.lane, c); u.v = u.base; u.boost = 0;
          c.position.x = u.base > egoKmh ? -45 : 150; c.position.z = u.lane * LANE;
        }
        u.wheels.forEach(w => { w.rotation.z -= u.v / 3.6 * dt / 0.36; });
        // 平滑移动到所在车道（被鸣笛后让道）
        c.position.z += Math.max(-2 * dt, Math.min(2 * dt, u.lane * LANE - c.position.z));
        // 盲区：相邻车道、本车侧后方 7 米到侧前方 3 米（镜头里能看到的范围）
        const x = c.position.x, inZone = x > -7 && x < 3;
        // 与本车并排太久的车会自然加速或减速离开，避免一直卡在盲区
        u.side = inZone && Math.abs(u.lane - egoLane) === 1 ? (u.side || 0) + dt : 0;
        if (u.side > 3 && u.boost <= 0) { u.boost = 3; u.boostV = egoKmh + (Math.random() < 0.5 ? 18 : -18); u.side = 0; }
        const isL = inZone && u.lane === egoLane - 1, isR = inZone && u.lane === egoLane + 1;
        if (isL) left = true;
        if (isR) right = true;
        u.paint.color.lerp(isL || isR ? RED : u.tint, Math.min(1, dt * 8));
      }
      // 碰撞：车身实际重叠时不允许穿模，把对方推到车身外并通知外层“撞停”
      for (const c of traffic) {
        const dx = c.position.x, dz = c.position.z - egoZ, u = c.userData, reach = 2.35 + u.half;
        if (Math.abs(dz) < 0.96 + u.halfW && Math.abs(dx) < reach) {
          c.position.x = dx >= 0 ? reach + 0.05 : -reach - 0.05;
          if (laneMoving && Math.round(c.position.z / LANE) === egoLane) { egoLane = laneFrom; } // 变道时侧面剐蹭：退回原车道
          if (performance.now() - lastCrash > 1200) { lastCrash = performance.now(); emit('crash', { v: c.userData.v, front: dx >= 0 }); }
          if (dx >= 0) c.userData.v = Math.max(c.userData.v, speed);
        }
      }
      if (left !== blind.left || right !== blind.right) { blind.left = left; blind.right = right; emit('blind', { ...blind }); }

      // 变道：先打灯 → 检查盲区 → 横向移动
      if (laneReq) {
        laneReq.t += dt;
        const side = laneReq.dir < 0 ? 'left' : 'right';
        if (blind[side] && laneReq.auto) {
          // 自动变道：盲区突然有车就静默取消，由外层稍后重新评估（不刷屏报警）
          emit('lane', { status: 'cancel', dir: laneReq.dir, auto: true, blocked: true }); laneReq = null;
        } else if (blind[side]) {
          if (!laneReq.warned) { laneReq.warned = true; emit('lane', { status: 'blocked', dir: laneReq.dir }); }
          if (laneReq.t > 6) { emit('lane', { status: 'cancel', dir: laneReq.dir }); laneReq = null; }
        } else if (laneReq.t > laneReq.wait) {
          laneFrom = egoLane; egoLane += laneReq.dir; laneMoving = true;
          emit('lane', { status: 'start', dir: laneReq.dir }); laneReq = null;
        }
      }
      const tz = egoLane * LANE, prevZ = egoZ;
      egoZ += Math.max(-2.4 * dt, Math.min(2.4 * dt, tz - egoZ));
      if (laneMoving && Math.abs(tz - egoZ) < 0.01) { laneMoving = false; emit('lane', { status: 'done' }); }
      return dt > 0 ? (egoZ - prevZ) / dt : 0;
    }

    let car = null, type = opts.type || 'sedan', color = opts.color || '#e9eaec', finish = opts.finish || '原厂漆';
    // 车衣质感：调整车漆材质的金属度、粗糙度、清漆层和薄膜干涉（炫彩）
    const FINISHES = {
      原厂漆: { metalness: 0.45, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0 },
      亮面: { metalness: 0.15, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.01, iridescence: 0 },
      哑光: { metalness: 0.05, roughness: 0.72, clearcoat: 0, clearcoatRoughness: 0.5, iridescence: 0 },
      缎面: { metalness: 0.35, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.35, iridescence: 0 },
      电镀: { metalness: 1, roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0 },
      炫彩: { metalness: 0.7, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 1 },
    };
    // 尾灯样式：灯罩颜色、关灯时的余光、开灯亮度
    let tail = opts.tail || '原厂';
    const TAILS = {
      原厂: { color: 0x6a0a0e, emissive: 0xff1010, lens: 0x4a0508, opacity: 0.5, off: 0.08, on: 1.4 },
      熏黑: { color: 0x2a0406, emissive: 0xff0808, lens: 0x0a0203, opacity: 0.85, off: 0.02, on: 0.9 },
      亮红: { color: 0xc01018, emissive: 0xff2a1a, lens: 0x9a0a10, opacity: 0.35, off: 0.3, on: 2 },
    };
    function applyTail() {
      const m = car && car.userData.tlMat, t = TAILS[tail] || TAILS.原厂;
      if (!m) return;
      m.color.setHex(t.color); m.emissive.setHex(t.emissive);
      const l = car.userData.lensMat;
      if (l) { l.color.setHex(t.lens); l.opacity = t.opacity; }
    }
    function applyFinish() {
      const m = car && car.userData.paint, f = FINISHES[finish] || FINISHES.原厂漆;
      if (!m || !m.isMeshPhysicalMaterial) return;
      Object.assign(m, f);
      m.iridescenceIOR = 1.8; m.iridescenceThicknessRange = [200, 900];
      m.needsUpdate = true;
    }
    const glbScenes = {}, glbFailed = {};
    function setBody(t, c) {
      type = t || type; color = c || color;
      // 有真实车模的车型（Model 3 / Model Y / Cybertruck）优先用真实车模；还没加载好（或加载失败）时先用程序化车身
      const want = type, useGLB = GLB_MODELS[want] && glbScenes[want];
      if (car) { scene.remove(car); if (!car.userData.glb) car.traverse(o => o.geometry && o.geometry.dispose()); }
      car = useGLB ? buildGLB(want, glbScenes[want], color) : buildCar(want, color, false);
      scene.add(car);
      applyFinish(); applyTail();
      applyState(true);
      if (GLB_MODELS[want] && !glbScenes[want] && !glbFailed[want]) {
        loadGLB(want).then(g => { glbScenes[want] = g; if (type === want) setBody(); precompile(); api.onEvent && api.onEvent('model', { ok: true }); })
          .catch(err => { glbFailed[want] = true; if (!GLB_MODELS[want].optional) console.warn(GLB_MODELS[want].label + ' 车模加载失败，继续使用程序化车身：', err.message); });
      }
    }

    // ---- 状态 ----
    const st = { frunk: 0, trunk: 0, port: 0, charging: false, lights: false, signal: null, lightshow: 0, folded: 0 };
    const target = { frunk: 0, trunk: 0, port: 0, folded: 0 };
    let drive = 0, driveTarget = 0, speed = 0, ap = false, rainbow = false;
    let az = -0.72, el = 0.5, dist = 1, zoomK = 1, azVel = 0;
    // 默认视角：收起时为俯视 45°，展开后为低角度前侧视角；停止操作 5 秒后自动回到默认视角
    const VIEWS = { compact: { az: -0.6, el: 0.13, zoom: 1, elMin: 0.035, elMax: 1.1 }, expanded: { az: -0.62, el: 0.08, zoom: 0.86, elMin: 0.035, elMax: 1.13 } };
    let home = VIEWS.compact, lastInput = -1e9, resetting = false;
    az = home.az; el = home.el;
    const IDLE_RETURN = 5000;
    let dark = false;

    function applyState(force) {
      const u = car.userData;
      if (u.glb) return applyGLB(u);
      u.hood.visible = st.frunk > 0.01;
      u.hood.rotation.z = u.hood.userData.base + st.frunk * 0.95;
      u.trunk.visible = st.trunk > 0.01;
      u.trunk.rotation.z = u.trunk.userData.base - st.trunk * (type === 'sedan' ? 0.95 : 1.25);
      // 充电口灯：打开未充电为蓝白色常亮，充电中为绿色呼吸
      u.portMat.emissive.setHex(st.charging ? 0x18c964 : 0x8fb8ff);
      u.portMat.emissiveIntensity = st.port * (st.charging ? 0.9 + 0.6 * Math.sin(performance.now() / 300) : 1.1);
      u.port.position.z = -(u.profile.W / 2 + 0.005 + st.port * 0.06);
      u.mirrors.forEach(m => { m.scale.z = 1.4 - st.folded * 0.8; });
      const blink = Math.floor(performance.now() / 380) % 2 === 0;
      const tt = TAILS[tail] || TAILS.原厂;
      let hl = st.lights ? 2.2 : 0.15, tl = st.lights ? tt.on : tt.off;
      if (st.lightshow > 0) {
        const k = Math.floor(performance.now() / 160) % 6;
        hl = k % 2 ? 3 : 0.05; tl = k < 3 ? 2 : 0.1;
      }
      u.hlMat.emissiveIntensity = hl; u.tlMat.emissiveIntensity = tl;
      u.signals.forEach(s => {
        const on = st.signal === 'both' || (st.signal === 'left' && s.userData.side < 0) || (st.signal === 'right' && s.userData.side > 0) || st.lightshow > 0;
        s.material.emissiveIntensity = on && blink ? 3 : 0;
      });
    }

    function applyGLB(u) {
      // 部分车模（Model Y / Cybertruck）没有前后备箱枢轴、充电口、可识别的灯，对应部件为空，直接跳过
      u.lids.frunk && u.lids.frunk(st.frunk * 0.9);
      u.lids.trunk && u.lids.trunk(-st.trunk * 1.05);
      if (u.port && u.portMat) {
        u.port.visible = st.port > 0.02;
        // 充电口灯：打开未充电为蓝白色常亮，充电中为绿色呼吸
        u.portMat.emissive.setHex(st.charging ? 0x18c964 : 0x8fb8ff);
        u.portMat.emissiveIntensity = st.port * (st.charging ? 0.9 + 0.6 * Math.sin(performance.now() / 300) : 1.1);
      }
      const blink = Math.floor(performance.now() / 380) % 2 === 0;
      const tt = TAILS[tail] || TAILS.原厂;
      let hl = st.lights ? 0.8 : 0, tl = st.lights ? tt.on : tt.off;
      if (st.lightshow > 0) {
        const k = Math.floor(performance.now() / 160) % 6;
        hl = k % 2 ? 1.6 : 0; tl = k < 3 ? 2 : 0.1;
      }
      if (u.hlMat) u.hlMat.emissiveIntensity = hl;
      if (u.tlMat) u.tlMat.emissiveIntensity = tl;
      if (u.beam) u.beam.visible = hl > 0.5;
      u.signals.forEach(s => {
        const on = st.signal === 'both' || (st.signal === 'left' && s.userData.side < 0) || (st.signal === 'right' && s.userData.side > 0) || st.lightshow > 0;
        if (s.isSprite) s.visible = on && blink; else s.material.emissiveIntensity = on && blink ? 4 : 0;
      });
    }

    // ---- 交互：拖动旋转 ----
    let dragging = false, lastX = 0, lastY = 0;
    const cv = renderer.domElement;
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', e => {
      if (drive > 0.5) return;
      dragging = true; resetting = false; lastInput = performance.now();
      lastX = e.clientX; lastY = e.clientY; cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
      azVel = dx * 0.006; az += azVel; lastInput = performance.now();
      el = Math.max(home.elMin, Math.min(home.elMax, el + dy * 0.004));
    });
    const end = () => { if (dragging) lastInput = performance.now(); dragging = false; };
    cv.addEventListener('dblclick', () => { if (drive < 0.5) { resetting = true; azVel = 0; } });
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', e => { if (drive < 0.5) { zoomK = Math.max(0.6, Math.min(1.4, zoomK + e.deltaY * 0.0008)); lastInput = performance.now(); resetting = false; e.preventDefault(); } }, { passive: false });

    // ---- 尺寸 ----
    let viewShift = 0, vw = 1, vh = 1;
    function resize() {
      const w = host.clientWidth || 1, h = host.clientHeight || 1;
      vw = w; vh = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      // 改尺寸会清空画布：立刻重画一帧，否则面板宽度动画期间每帧都是空白，车会“消失”
      if (car) renderer.render(scene, camera);
    }
    const ro = new ResizeObserver(resize); ro.observe(host);

    const tmpV = new T.Vector3();
    const lerp = (a, b, k) => a + (b - a) * k;
    let last = performance.now();

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      // 动画插值
      for (const k of ['frunk', 'trunk', 'port', 'folded']) st[k] += (target[k] - st[k]) * Math.min(1, dt * 4);
      if (st.lightshow > 0) st.lightshow -= dt;
      drive += (driveTarget - drive) * Math.min(1, dt * 2.2);
      if (!dragging) { az += azVel; azVel *= 0.93; }
      // 空闲（或双击复位）时平滑回到默认视角，约 0.7 秒
      if (!dragging && drive < 0.5 && (resetting || now - lastInput > IDLE_RETURN)) {
        const kk = Math.min(1, dt * 5.5);
        const da = Math.atan2(Math.sin(home.az - az), Math.cos(home.az - az));
        az += da * kk; el += (home.el - el) * kk; zoomK += (home.zoom - zoomK) * kk;
        if (Math.abs(da) > 0.02) azVel *= 0.5;
        if (resetting && Math.abs(da) < 0.002 && Math.abs(home.el - el) < 0.002) resetting = false;
      }

      // 相机：驻车环绕视角 ⇄ 驾驶追车视角
      // 按画面宽高比自动计算距离，保证整车完整入镜
      const hfov = 2 * Math.atan(Math.tan(T.MathUtils.degToRad(15)) * camera.aspect);
      // 同时按宽和高取景：车身（含标签余量）始终完整入镜
      dist = Math.max(7.5, 4.9 / (2 * Math.tan(hfov / 2)), 4.2 / (2 * Math.tan(T.MathUtils.degToRad(15)))) * zoomK;
      const ex = Math.cos(el) * Math.cos(az) * dist, ey = Math.sin(el) * dist + 0.6, ez = Math.cos(el) * Math.sin(az) * dist;
      const dx = -9.5, dy = 4.6, dz = egoZ * 0.85;
      const k = drive * drive * (3 - 2 * drive);
      camera.position.set(lerp(ex, dx, k), lerp(ey, dy, k), lerp(ez, dz, k));
      camera.fov = lerp(30, 42, k); camera.updateProjectionMatrix();
      camera.lookAt(lerp(0, 9, k), lerp(0.55, 0, k), egoZ * k);

      // 道路
      if (floor) { floor.visible = drive < 0.6; floor.material.uniforms.uOpacity.value = (dark ? 0.34 : 0.22) * (1 - drive / 0.6); }
      road.visible = drive > 0.02;
      laneMat.opacity = edgeMat.opacity = drive; roadMat.opacity = drive * (dark ? 0.25 : 0.05);
      const rb = rainbow && ap;
      const pu = pathMat.uniforms;
      pu.uOpacity.value = ap ? Math.min(1, drive) : Math.max(0, pu.uOpacity.value - dt * 2);
      pu.uRainbow.value = rb ? 1 : 0;
      pathPhase += dt * (6 + Math.abs(speed) * 0.25); pu.uPhase.value = pathPhase;
      traffic.forEach(c => { c.userData.paint.opacity = c.userData.glassMat.opacity = drive; });
      const v = speed / 3.6;
      if (road.visible) {
        computeCurve();
        ribbons.forEach(updateRibbon);
        edgeRib.uniforms.uOpacity.value = yellowRib.uniforms.uOpacity.value = drive; roadRib.uniforms.uOpacity.value = drive * (dark ? 0.25 : 0.05); shoulderRib.uniforms.uOpacity.value = drive * (dark ? 0.12 : 0.025);
        // placeOn 要求物体自身的 x 就是它在道路上的逻辑位置
        junctionPool.forEach((j, n) => {
          const x = junctions[n]; j.pv.visible = x != null; if (x == null) return;
          j.g.position.x = x; placeOn(j.pv, x);
          const L = lights[n], st = L ? L.state : null;
          for (const k in j.lamps) j.lamps[k].color.setHex(st === k ? LAMP_ON[k] : LAMP_OFF);
          // 横向车流：只在本方向红灯时通过
          j.cross.forEach((c, i) => {
            const z = ((now * 0.011 + i * 47 + n * 23) % 120) - 60;
            c.position.z = i ? -z : z; c.visible = st === 'red';
            c.userData.paint.opacity = c.userData.glassMat.opacity = drive;
          });
        });
        stationPv.visible = station != null; if (station != null) { stationGroup.position.x = station; placeOn(stationPv, station); }
        postMat.opacity = postRed.opacity = drive;
      }
      dashes.forEach(d => {
        d.position.x -= v * dt;
        if (d.position.x < -44) d.position.x += 34 * 9;
        if (d.position.x > 34 * 9 - 44) d.position.x -= 34 * 9;
        d.visible = !junctions.some(j => Math.abs(d.position.x - j) < 14);
        if (road.visible) placeOn(d.userData.pv, d.position.x);
      });
      const vz = driveTarget && drive > 0.5 ? stepTraffic(dt) : 0;
      if (driveTarget && drive > 0.5) stepOncoming(dt);
      if (road.visible) {
        traffic.forEach(c => placeOn(c.userData.pv, c.position.x));
        oncoming.forEach(c => { placeOn(c.userData.pv, c.position.x); c.userData.paint.opacity = c.userData.glassMat.opacity = drive; });
      }
      // 打灯等待变道时，路径前端先弯向目标车道；变道过程中引导车辆并入
      const aimLane = laneReq ? egoLane + laneReq.dir : egoLane;
      updatePath(egoZ, Math.max(-1, Math.min(2, aimLane)) * LANE);
      if (car) {
        car.position.z = egoZ * k;
        car.rotation.y += (-vz * 0.09 - car.rotation.y) * Math.min(1, dt * 8);
        const roll = v * dt / car.userData.profile.wr;
        if (car.userData.glb) car.userData.wheels.forEach(w => { w.a -= roll; w.spin(w.a); }); // 没有可识别车轮的车模 wheels 为空
        else car.userData.wheels.forEach(w => { w.rotation.z -= roll; });
        applyState();
      }
      sun.position.set(lerp(4, 6, k), 10, lerp(3, 4, k));
      // 驻车时把车往上挪，给下方的小组件卡片留出空间
      const sh = viewShift * (1 - k);
      if (sh > 0.5) camera.setViewOffset(vw, vh, 0, sh, vw, vh); else camera.clearViewOffset();
      renderer.render(scene, camera);
      api.onFrame && api.onFrame();
      requestAnimationFrame(frame);
    }


    const api = {
      setBody,
      setViewShift(px) { viewShift = px; },
      // 展开 / 收起车辆视图：切换默认视角并平滑过渡过去
      setExpanded(on) { home = on ? VIEWS.expanded : VIEWS.compact; resetting = true; azVel = 0; },
      rotate(dAz) { az += dAz; azVel = 0; lastInput = performance.now(); resetting = false; },
      resetView() { resetting = true; azVel = 0; },
      setColor(c) { color = c; if (car && car.userData.paint) { if (car.userData.glb) tintPaint(car.userData, c); else car.userData.paint.color.set(c); } },
      setFinish(f) { finish = f; applyFinish(); },
      setTail(t) { tail = t; applyTail(); applyState(true); },
      setTheme(isDark) {
        dark = isDark;
        laneMat.color.set(isDark ? 0x8e939a : 0xffffff);
        edgeMat.color.set(isDark ? 0x6b7077 : 0xffffff); edgeRib.uniforms.uColor.value.set(isDark ? 0x6b7077 : 0xffffff);
        shadowMat.opacity = isDark ? 0.5 : 0.22;
        hemi.intensity = isDark ? 0.7 : 0.9;
        renderer.toneMappingExposure = isDark ? 0.9 : 1.0;
      },
      set(key, val) {
        if (key in target) target[key] = val ? 1 : 0;
        else st[key] = val;
      },
      lightshow(sec) { st.lightshow = sec; },
      setDrive(on) {
        if (on && !driveTarget) resetTraffic();
        driveTarget = on ? 1 : 0;
        if (!on) { az = home.az; el = home.el; zoomK = home.zoom; egoLane = PARK_LANE; egoZ = PARK_LANE * LANE; laneReq = null; laneMoving = false; }
      },
      // 打灯变道：dir = -1 左 / 1 右；旁边车道的车有一定概率突然加速“抢道”
      // opt.auto：Autopilot 自动变道（不触发旁车“抢道”）；opt.urgent：避让障碍，缩短打灯等待
      requestLane(dir, opt) {
        const t = egoLane + dir;
        // 最右侧车道外是应急车道（路肩），车速 60 km/h 以下才能驶入
        if (t < -1 || t > 2) { emit('lane', { status: 'edge', dir }); return; }
        if (t === 2 && speed > 60) { emit('lane', { status: 'fast', dir }); return; }
        if (laneReq || laneMoving) return;
        laneReq = { dir, t: 0, warned: false, auto: !!(opt && opt.auto), wait: opt && opt.urgent ? 0.6 : 1.5 };
        if (!laneReq.auto && t <= 1 && speed > 15 && Math.random() < 0.65) {
          let pick = null;
          for (const c of traffic) {
            const u = c.userData, x = c.position.x;
            if (u.lane === t && x > -45 && x < -6 && (!pick || x > pick.position.x)) pick = c;
          }
          if (!pick) {
            pick = traffic.filter(c => c.userData.lane !== egoLane).sort((a, b) => a.position.x - b.position.x)[0];
            if (pick) { pick.userData.lane = t; pick.userData.base = laneBase(t, pick); pick.position.set(-32, 0, t * LANE); }
          }
          if (pick) {
            // 放到侧后方约 18 米处并猛加速，正好冲进盲区
            const u = pick.userData; pick.position.x = Math.max(pick.position.x, -16);
            u.boost = 4; u.boostV = speed + 40; u.v = Math.max(u.v, speed + 30);
          }
        }
      },
      // 鸣笛：前车加速，若旁边车道有空位则变道让行
      honk() {
        const lead = traffic.filter(c => c.userData.lane === egoLane && c.position.x > 0 && c.position.x < 45).sort((a, b) => a.position.x - b.position.x)[0];
        if (!lead) return false;
        const u = lead.userData;
        const free = [egoLane - 1, egoLane + 1].filter(l => l >= -1 && l <= 1 && !traffic.some(o => o !== lead && o.userData.lane === l && Math.abs(o.position.x - lead.position.x) < 14));
        if (free.length) { u.lane = free[Math.floor(Math.random() * free.length)]; u.base = Math.max(u.base, laneBase(u.lane, lead)); }
        u.boost = 3; u.boostV = speed + 25;
        return true;
      },
      cancelLane() { if (laneReq) { laneReq = null; emit('lane', { status: 'cancel' }); } },
      // 同车道前车：距离（米）与速度（km/h），用于自适应巡航和碰撞预警
      getLead() {
        let best = null;
        for (const c of traffic) {
          if (c.userData.lane !== egoLane || c.position.x <= 0) continue;
          if (!best || c.position.x < best.position.x) best = c;
        }
        return best ? { gap: best.position.x - 2.45 - best.userData.half, v: best.userData.v, kind: best.userData.kind } : null;
      },
      // 指定车道上本车前方 / 后方最近的车：{ ahead, behind }，各为 { gap（米，车身间距）, v（km/h）, kind } 或 null；用于自动变道判断空档
      laneInfo(lane) {
        let ahead = null, behind = null;
        for (const c of traffic) {
          const u = c.userData;
          if (u.lane !== lane && Math.round(c.position.z / LANE) !== lane) continue;
          const x = c.position.x;
          if (x >= 0) { const g = x - 2.45 - u.half; if (!ahead || g < ahead.gap) ahead = { gap: g, v: u.v, kind: u.kind }; }
          else { const g = -x - 2.35 - u.half; if (!behind || g < behind.gap) behind = { gap: g, v: u.v, kind: u.kind }; }
        }
        return { ahead, behind };
      },
      get laneBusy() { return !!(laneReq || laneMoving); },
      get lane() { return egoLane; },
      get egoOffset() { return egoZ; }, // 横向偏移（米，向右为正），模拟地图用来同步变道
      setSpeed(s) { speed = s; },
      // 前方路线形状：brgAt(s) 返回路线上距本车 s 米处的方位角（度）；js 为前方路口距离；不传则为直路
      // states：与 js 对应的红绿灯状态
      setTrack(brgAt, js, states) {
        track = brgAt || null; junctions = (js || []).slice(0, 3);
        lights = junctions.map((x, i) => ({ x, state: (states && states[i]) || 'green' }));
      },
      // 本车前方最近的停止线（红灯或黄灯）：{ d: 车头到停止线的距离, state }
      getStop() {
        for (const L of lights) { const d = L.x + STOP_DX - 2.4; if (d > -1) return L.state === 'green' ? null : { d, state: L.state }; }
        return null;
      },
      // 路边充电站的位置（距本车米数），null 隐藏
      setStation(x) { station = x; },
      setAP(on) { ap = on; },
      setRainbow(on) { rainbow = on; },
      get driveBlend() { return drive; },
      // 把 3D 锚点投影到 host 内的像素坐标，用于 HTML 标签
      project(name) {
        if (!car) return null;
        const p = car.userData.profile;
        const anchors = {
          frunk: [p.hood[1][0] - 0.35, p.hood[1][1] + 0.35, 0],
          trunk: [p.trunk[1][0] + 0.15, p.trunk[0][1] + 0.3, 0],
          lock: [-0.3, Math.max(...p.glass.map(g => g[1])) + 0.04, 0],
          port: [p.port[0], p.port[1] + 0.05, -(p.W / 2 + 0.3)],
        };
        const a = anchors[name]; if (!a) return null;
        tmpV.set(a[0], a[1], a[2]).project(camera);
        return { x: (tmpV.x + 1) / 2 * host.clientWidth, y: (1 - tmpV.y) / 2 * host.clientHeight, behind: tmpV.z > 1 };
      },
      // 换宿主（CarPlay 的“车辆”页面复用同一个 3D 场景）
      moveTo(el) { ro.unobserve(host); host = el; el.appendChild(renderer.domElement); ro.observe(el); resize(); },
    };

    // 预编译着色器：路口斑马线、红绿灯、横穿车辆、充电桩等平时隐藏的物体第一次出现时，
    // 浏览器要现场编译着色器，会卡住几十到上百毫秒。启动时把它们全部临时显示出来编译一遍
    function precompile() {
      const hidden = [];
      scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
      try { renderer.compile(scene, camera); } catch (e) { /* 编译失败不影响运行，只是第一次出现时会卡一下 */ }
      hidden.forEach(o => { o.visible = false; });
    }
    setBody(type, color);
    precompile();
    resize();
    requestAnimationFrame(frame);
    return api;
  }

  window.Car3D = { create, PROFILES };
})();
