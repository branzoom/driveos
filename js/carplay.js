/* Apple CarPlay（新一代 / Ultra 风格）皮肤
 * 左侧状态栏 + 小组件仪表盘 + App 网格 + 底部常驻空调条，玻璃质感卡片。
 * 与 Tesla 皮肤共用同一份车辆状态、地图实例和 3D 车辆。
 */
(function () {
  const A = window.App, S = A.S, I = A.I;
  const root = document.getElementById('carplay');
  let view = 'dash', active = false, wallpaper = 0;
  try { wallpaper = +localStorage.getItem('driveos.cpWall') || 0; } catch (e) {}

  const WALLS = [
    ['极光', 'radial-gradient(1200px 700px at 15% 10%, #2b4dff88, transparent 60%), radial-gradient(900px 700px at 85% 30%, #b04dff77, transparent 60%), radial-gradient(1000px 800px at 50% 110%, #00d1b277, transparent 60%), #06070d'],
    ['日落', 'radial-gradient(1100px 700px at 20% 0%, #ff7a4588, transparent 60%), radial-gradient(900px 700px at 90% 40%, #ff3d7f66, transparent 60%), radial-gradient(1000px 800px at 40% 120%, #6a3dff66, transparent 60%), #0d0608'],
    ['深海', 'radial-gradient(1200px 800px at 30% 20%, #0a84ff66, transparent 60%), radial-gradient(1000px 700px at 80% 90%, #30d15855, transparent 60%), #030a12'],
    ['石墨', 'radial-gradient(1200px 800px at 50% 0%, #4a4f5a88, transparent 60%), radial-gradient(900px 700px at 80% 100%, #2c2f3666, transparent 60%), #0b0c0e'],
  ];

  // App 图标：渐变背景 + 白色图形（iOS 风格）
  const APPS = [
    ['maps', '地图', 'map', 'linear-gradient(160deg,#5ee27a,#1fa34a)'],
    ['music', '音乐', 'music', 'linear-gradient(160deg,#ff6b81,#fa233b)'],
    ['phone', '电话', 'phone', 'linear-gradient(160deg,#6ee07f,#28c840)'],
    ['messages', '信息', 'message', 'linear-gradient(160deg,#6ee07f,#28c840)'],
    ['podcasts', '播客', 'podcast', 'linear-gradient(160deg,#d27bff,#8c3fe0)'],
    ['calendar', '日历', 'calendar', 'linear-gradient(160deg,#ffffff,#e9e9ee)', '#ff3b30'],
    ['weather', '天气', 'cloudSun', 'linear-gradient(160deg,#4fb2ff,#1c6fe0)'],
    ['vehicle', '车辆', 'car', 'linear-gradient(160deg,#5b6170,#2b2f38)'],
    ['climate', '空调', 'fan', 'linear-gradient(160deg,#46c3ff,#0a84ff)'],
    ['audiobooks', '有声书', 'manual', 'linear-gradient(160deg,#ffb340,#ff7a00)'],
    ['settings', '设置', 'gear', 'linear-gradient(160deg,#9aa0aa,#5d636e)'],
    ['tesla', 'Tesla 风格', 'bolt', 'linear-gradient(160deg,#e82127,#9b0f14)'],
  ];
  const appIcon = (id, size = 132) => {
    const a = APPS.find(x => x[0] === id);
    return `<span class="cp-icon" style="width:${size}px;height:${size}px;background:${a[3]};color:${a[4] || '#fff'}">${I(a[2], size * 0.5)}</span>`;
  };

  // ---------------------------------------------------------- 骨架
  root.innerHTML = `
    <div class="cp-wall"></div>
    <aside class="cp-side" id="cpSide"></aside>
    <main class="cp-main" id="cpMain"></main>
    <div class="cp-climate" id="cpClimate"></div>`;
  const side = root.querySelector('#cpSide'), main = root.querySelector('#cpMain'), clim = root.querySelector('#cpClimate');
  const mapSlot = document.createElement('div'); mapSlot.className = 'cp-map-slot';

  function setWall() { root.querySelector('.cp-wall').style.background = WALLS[wallpaper][1]; }

  // ---------------------------------------------------------- 左侧状态栏
  function renderSide() {
    const d = new Date();
    const recents = ['maps', 'music', 'phone'];
    side.innerHTML = `
      <div class="cp-time">${A.clock(d).replace(/ (AM|PM)/, '')}</div>
      <div class="cp-sig">${I('lte', 22)}<span>5G</span></div>
      ${S.gear !== 'P' ? `<div class="cp-gear"><b>${S.gear}</b><span>${Math.round(S.speed)}</span></div>` : ''}
      <div class="cp-recents">${recents.map(id => `<button data-open="${id}" class="${view === id ? 'on' : ''}">${appIcon(id, 84)}</button>`).join('')}</div>
      <button class="cp-home" data-home title="${view === 'dash' ? 'App' : '仪表盘'}">${I(view === 'dash' ? 'grid' : 'dash', 40)}</button>`;
  }
  side.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    Sound.play('tap');
    if ('home' in b.dataset) go(view === 'dash' ? 'grid' : 'dash');
    else go(b.dataset.open);
  });

  // ---------------------------------------------------------- 底部空调条（CarPlay Ultra 风格）
  function renderClimate() {
    const c = S.climate;
    const t = v => !c.on ? '关' : v <= 15 ? 'LO' : v >= 28 ? 'HI' : v.toFixed(1) + '°';
    const seat = (s, lv) => `<button class="cp-cbtn ${lv ? 'heat' : ''}" data-seat="${s}">${I('seatHeat', 34)}<span class="cp-lv">${[1, 2, 3].map(i => `<i class="${lv >= i ? 'on' : ''}"></i>`).join('')}</span></button>`;
    clim.innerHTML = `
      <div class="cp-temp"><button data-t="L" data-d="-0.5">${I('chevD', 30)}</button><b>${t(c.left)}</b><button data-t="L" data-d="0.5">${I('chevU', 30)}</button></div>
      ${seat('L', c.seatL)}
      <button class="cp-cbtn ${c.auto && c.on ? 'on' : ''}" data-c="auto"><b>AUTO</b></button>
      <div class="cp-fan">${I('fan', 30)}<div class="cp-fanbar">${Array.from({ length: 10 }, (_, i) => `<i data-fan="${i + 1}" class="${c.on && c.fan > i ? 'on' : ''}"></i>`).join('')}</div></div>
      <button class="cp-cbtn ${c.ac && c.on ? 'on' : ''}" data-c="ac"><b>A/C</b></button>
      <button class="cp-cbtn ${c.defF ? 'on' : ''}" data-c="defF">${I('defrostF', 34)}</button>
      <button class="cp-cbtn ${c.recirc ? 'on' : ''}" data-c="recirc">${I('recirc', 34)}</button>
      <button class="cp-cbtn ${c.on ? '' : 'off'}" data-c="on">${I('power', 32)}</button>
      ${seat('R', c.seatR)}
      <div class="cp-temp"><button data-t="R" data-d="-0.5">${I('chevD', 30)}</button><b>${t(c.right)}</b><button data-t="R" data-d="0.5">${I('chevU', 30)}</button></div>`;
  }
  clim.addEventListener('click', e => {
    const b = e.target.closest('[data-t],[data-seat],[data-c],[data-fan]'); if (!b) return;
    const d = b.dataset, c = S.climate;
    if (d.t) return A.setTemp(d.t, +d.d);
    if (d.seat) return A.cycleSeat(d.seat);
    if (d.fan) { c.on = true; c.fan = +d.fan; Sound.play('tap'); return A.commit('dock', 'sheet'); }
    if (d.c) { c[d.c] = !c[d.c]; Sound.play('toggle'); return A.commit('dock', 'sheet'); }
  });

  // ---------------------------------------------------------- 视图
  function go(v) {
    if (v === 'tesla') return A.setSkin('tesla');
    const leavingVehicle = view === 'vehicle' && v !== 'vehicle';
    view = v;
    if (leavingVehicle && A.car) A.car.moveTo(document.getElementById('car3d'));
    renderMain(); renderSide();
  }

  function npWidget(big) {
    const m = S.media, np = A.nowInfo();
    return `<div class="cp-np ${big ? 'big' : ''}">
      ${np.art('cp-art')}
      <div class="cp-np-info"><b>${np.t}</b><span>${np.a}</span>
        <div class="cp-scrub"><div class="bar"><i style="width:${np.pos / np.dur * 100}%"></i></div>${big ? `<div class="cp-times"><span>${A.fmtDur(np.pos)}</span><span>-${A.fmtDur(np.dur - np.pos)}</span></div>` : ''}</div>
        <div class="cp-np-ctrls"><button data-m="prev">${I('prev', big ? 46 : 34)}</button><button data-m="play">${I(np.playing ? 'pause' : 'play', big ? 56 : 40)}</button><button data-m="next">${I('next', big ? 46 : 34)}</button>${big ? `<button data-m="fav" class="${m.fav.includes(m.idx) ? 'faved' : ''}">${I('heart', 38)}</button>` : ''}</div>
      </div></div>`;
  }
  function turnWidget() {
    const n = S.nav;
    if (n.mode === 'active') {
      const h = A.nav(), { step, dist } = h.nextStep(), t = h.tripInfo();
      return `<div class="cp-turn">${I(h.manIcon(step), 56)}<div><b>${A.fmtDist(dist)}</b><span>${h.manText(step)}${step.name && step.type !== 'arrive' ? ' · ' + step.name : ''}</span></div></div>
        <div class="cp-eta"><div><b>${t.eta}</b>到达</div><div><b>${t.mins}</b>分钟</div><div><b>${A.fmtDist(t.remain)}</b></div><button data-endnav>${I('close', 26)}</button></div>`;
    }
    if (n.mode === 'preview') {
      const r = n.route;
      return `<div class="cp-route"><b>${n.dest.name}</b><span>${Math.round(r.dur / 60)} 分钟 · ${(r.total / 1000).toFixed(1)} 公里</span><button class="cp-go" data-startnav>出发</button><button class="cp-x" data-endnav>${I('close', 24)}</button></div>`;
    }
    if (n.mode === 'loading') return `<div class="cp-route"><span>正在规划路线…</span></div>`;
    return `<button class="cp-search" data-open="maps">${I('search', 28)}<span>搜索地图</span></button>`;
  }
  function placeChips() {
    return `<div class="cp-chips">${window.MapCtl.PLACES.slice(0, 6).map((p, i) => `<button data-place="${i}">${I(p.icon, 24)}${p.name}</button>`).join('')}</div>`;
  }

  function renderMain() {
    if (!active) return;
    const h = '<div class="cp-title">';
    let html = '';
    if (view === 'dash') {
      const ev = { t: '12:00', n: '和 Lily 午餐', l: '前滩太古里' };
      html = `<div class="cp-dash">
        <section class="cp-card cp-mapcard"><div class="cp-mapwrap" data-map></div><div class="cp-over" id="cpTurn">${turnWidget()}</div></section>
        <section class="cp-card cp-npcard" id="cpNp">${npWidget(false)}</section>
        <div class="cp-row">
          <section class="cp-card cp-cal" data-open="calendar"><small>今天 · 下一个日程</small><b>${ev.t}</b><span>${ev.n}</span><em>${I('pin', 20)}${ev.l}</em></section>
          <section class="cp-card cp-veh" data-open="vehicle" id="cpVeh"></section>
        </div></div>`;
    } else if (view === 'grid') {
      html = `<div class="cp-grid">${APPS.map(a => `<button data-open="${a[0]}">${appIcon(a[0])}<span>${a[1]}</span></button>`).join('')}</div><div class="cp-dots"><i class="on"></i><i></i></div>`;
    } else if (view === 'maps') {
      html = `<div class="cp-full cp-card" style="padding:0"><div class="cp-mapwrap" data-map></div><div class="cp-over big" id="cpTurn">${turnWidget()}</div>${S.nav.mode === 'idle' ? placeChips() : ''}</div>`;
    } else if (view === 'music') {
      html = `<div class="cp-full cp-card" id="cpNp">${npWidget(true)}</div>`;
    } else if (view === 'phone') {
      html = `<div class="cp-full cp-card cp-list">${h}电话</div>${[['妈妈', '#ff6b6b', '手机'], ['Lily Chen', '#0a84ff', '手机'], ['张伟', '#30d158', '工作'], ['Kevin', '#bf5af2', '手机']].map(([n, c, t]) => `<button class="cp-li" data-call="${n}"><span class="cp-av" style="background:${c}">${n[0]}</span><div><b>${n}</b><span>${t}</span></div>${I('phone', 30)}</button>`).join('')}</div>`;
    } else if (view === 'calendar') {
      html = `<div class="cp-full cp-card cp-list">${h}今天</div>${[['09:30', '产品评审会', '公司', 1, '#0a84ff'], ['12:00', '和 Lily 午餐', '前滩太古里', 7, '#30d158'], ['19:30', '外滩夜跑', '外滩', 2, '#ff453a']].map(([t, n, l, p, c]) => `<button class="cp-li" data-place="${p}"><span class="cp-evbar" style="background:${c}"></span><div><b>${n}</b><span>${t} · ${l}</span></div>${I('navArrow', 28)}</button>`).join('')}</div>`;
    } else if (view === 'vehicle') {
      html = `<div class="cp-full cp-vehicle"><div class="cp-card cp-car3d" id="cpCar"></div><div class="cp-card cp-vctl" id="cpVctl"></div></div>`;
    } else if (view === 'climate') {
      const c = S.climate;
      html = `<div class="cp-full cp-card cp-climate-big">${h}空调</div><div class="cp-cl-temps"><div><small>主驾</small><b>${c.on ? c.left.toFixed(1) + '°' : '关'}</b></div><div class="cp-cl-fan">${I('fan', 64)}<b>${c.on ? c.fan : '—'}</b><small>风量</small></div><div><small>副驾</small><b>${c.on ? c.right.toFixed(1) + '°' : '关'}</b></div></div><p class="cp-note">使用底部空调条进行调节</p></div>`;
    } else if (view === 'settings') {
      html = `<div class="cp-full cp-card cp-list">${h}设置</div>
        <div class="cp-sub">墙纸</div><div class="cp-walls">${WALLS.map((w, i) => `<button data-wall="${i}" class="${wallpaper === i ? 'on' : ''}" style="background:${w[1]}"><span>${w[0]}</span></button>`).join('')}</div>
        <div class="cp-sub">界面风格</div><button class="cp-li" data-open="tesla"><span class="cp-av" style="background:#e82127">${I('bolt', 28)}</span><div><b>切换到 Tesla 风格</b><span>保留所有车辆状态与导航</span></div>${I('chevR', 28)}</button>
        <div class="cp-sub">车身</div><div class="cp-walls">${Object.entries(Car3D.PROFILES).map(([k, p]) => `<button data-body="${k}" class="cp-bodybtn ${S.body === k ? 'on' : ''}"><span>${p.label}</span></button>`).join('')}</div></div>`;
    } else if (view === 'weather') {
      html = `<div class="cp-full cp-card cp-weather"><small>上海 · 浦东新区</small><b>18°</b><span>多云 · 最高 22° 最低 14°</span><div class="cp-hours">${['现在', '15时', '16时', '17时', '18时', '19时', '20时'].map((t, i) => `<div><small>${t}</small>${I(i > 3 ? 'moon' : 'cloudSun', 40)}<b>${18 - Math.floor(i / 2)}°</b></div>`).join('')}</div></div>`;
    } else {
      const a = APPS.find(x => x[0] === view);
      html = `<div class="cp-full cp-card cp-empty">${appIcon(view, 160)}<b>${a ? a[1] : ''}</b><span>演示 App · 内容需连接 iPhone</span></div>`;
    }
    main.innerHTML = html;
    main.dataset.view = view;
    const mapWrap = main.querySelector('[data-map]');
    if (mapWrap) { mapWrap.appendChild(mapSlot); window.MapCtl.moveTo(mapSlot); }
    if (view === 'vehicle') { renderVehicle(); if (A.car) A.car.moveTo(main.querySelector('#cpCar')); }
    if (view === 'dash') renderVehWidget();
  }

  function renderVehWidget() {
    const el = main.querySelector('#cpVeh'); if (!el) return;
    el.innerHTML = `<small>${S.carName}</small><b>${Math.round(S.battery)}%</b><span>${A.rangeKm()} km${S.charging ? ' · 充电中' : ''}</span><div class="cp-vbtns"><button data-lock>${I(S.locked ? 'lock' : 'unlock', 30)}</button><button data-veh="trunk" class="${S.trunk ? 'on' : ''}">${I('trunk', 30)}</button><button data-veh="frunk" class="${S.frunk ? 'on' : ''}">${I('frunk', 30)}</button></div>`;
  }
  function renderVehicle() {
    const el = main.querySelector('#cpVctl'); if (!el) return;
    const tile = (k, n, ic, on) => `<button class="cp-vtile ${on ? 'on' : ''}" ${k}>${I(ic, 40)}<span>${n}</span></button>`;
    el.innerHTML = `<div class="cp-title">${S.carName}</div><div class="cp-vstat"><b>${Math.round(S.battery)}%</b><span>${A.rangeKm()} km 续航 · ${S.gear} 档</span></div>
      <div class="cp-vtiles">
        ${tile('data-lock', S.locked ? '已锁定' : '已解锁', S.locked ? 'lock' : 'unlock', S.locked)}
        ${tile('data-veh="frunk"', '前备箱', 'frunk', S.frunk)}
        ${tile('data-veh="trunk"', '后备箱', 'trunk', S.trunk)}
        ${tile('data-veh="port"', '充电口', 'chargePort', S.port)}
        ${tile('data-veh="folded"', '后视镜', 'mirror', S.folded)}
        ${tile('data-honk', '鸣笛', 'horn', false)}
        ${tile('data-toy="lightshow"', '灯光秀', 'sparkle', false)}
      </div>
      <div class="cp-sub">车漆</div><div class="cp-paints">${A.PAINTS.map(([n, c]) => `<button data-paint="${c}" class="${S.paint === c ? 'on' : ''}" style="background:${c}" title="${n}"></button>`).join('')}</div>`;
  }

  main.addEventListener('click', e => {
    const b = e.target.closest('[data-open],[data-m],[data-place],[data-startnav],[data-endnav],[data-call],[data-wall],[data-body],[data-lock],[data-veh],[data-paint],[data-toy],[data-honk]');
    if (!b) return;
    const d = b.dataset;
    if (d.open) { Sound.play('tap'); return go(d.open); }
    if (d.m) return ({ play: A.togglePlay, next: A.nextTrack, prev: A.prevTrack, fav: A.toggleFav })[d.m]();
    if (d.place != null) { if (view !== 'maps') go('maps'); return A.navigateTo(window.MapCtl.PLACES[+d.place]); }
    if ('startnav' in d) return A.startNav();
    if ('endnav' in d) return A.endNav();
    if (d.call) return A.startCall(d.call);
    if (d.wall) { wallpaper = +d.wall; try { localStorage.setItem('driveos.cpWall', wallpaper); } catch (e) {} setWall(); Sound.play('tap'); return renderMain(); }
    if (d.body) { A.setBody(d.body); return renderMain(); }
    if ('lock' in d) return A.setLock(!S.locked);
    if (d.veh) return A.toggleKey(d.veh);
    if (d.paint) { Sound.play('tap'); return A.setPaint(d.paint); }
    if (d.toy) return A.toy(d.toy);
    if ('honk' in d) return A.honkTap();
  });

  // ---------------------------------------------------------- 状态同步（局部刷新，避免地图与 3D 画布被重建）
  A.subscribe((s, why) => {
    if (!active) return;
    renderSide(); renderClimate();
    const np = main.querySelector('#cpNp');
    if (np) np.innerHTML = npWidget(view === 'music');
    const turn = main.querySelector('#cpTurn');
    if (turn) turn.innerHTML = turnWidget();
    if (view === 'maps' && why !== 'tick' && why !== 'turn') {
      const chips = main.querySelector('.cp-chips');
      if (S.nav.mode === 'idle' && !chips) main.querySelector('.cp-full').insertAdjacentHTML('beforeend', placeChips());
      if (S.nav.mode !== 'idle' && chips) chips.remove();
    }
    renderVehWidget(); renderVehicle();
    if (why !== 'tick' && (view === 'climate' || view === 'settings')) renderMain();
  });
  A.onSpeed = () => { if (active) renderSide(); };

  window.CarPlay = {
    activate() {
      active = true; setWall();
      renderSide(); renderClimate(); renderMain();
    },
    deactivate() {
      if (view === 'vehicle' && A.car) A.car.moveTo(document.getElementById('car3d'));
      active = false; view = 'dash';
    },
  };
  setInterval(() => { if (active) renderSide(); }, 10000);
})();
