/* DriveOS 多语言（i18n）
 * 中文（zh）是源语言，也是默认语言：界面里所有文案在代码里仍然写中文，中文模式下输出与原来完全一致。
 * 其他语言按“中文原文 → 译文”查表翻译，每种语言一个文件 js/i18n/<code>.js（见 en.js / ja.js），
 * 新增语言只需：新建 js/i18n/xx.js、在 index.html 里加一行 <script>，文件里调用 I18N.register + I18N.add 即可。
 *
 * 词典写法（I18N.add(code, { 中文: 译文, ... })）：
 *   '浅色': 'Light'                      精确匹配（整段文本）
 *   '{0} 分钟': '{0} min'                 带占位符：{0} {1}… 匹配任意文字，{#0} {#1}… 只匹配数字（含 . , :）
 *   '剩余续航约 {#0} km': '…{0}…'          译文里用 {0}{1}… 引用捕获内容；捕获到的中文会递归翻译，翻不了就不套用该条（外部数据保持原样）
 *   “甲 · 乙” 这种用 ' · ' 连接的文本会按段分别翻译。
 * 查找顺序：当前语言 → 英文 → 中文原文。
 *
 * 渲染方式：页面里的文字（含 JS 模板动态生成的）由一个 MutationObserver 在渲染完成、绘制之前统一翻译
 * （文本节点 + title / placeholder / aria-label / alt 属性），并记住原文，切回中文时原样恢复；
 * 画布里画的文字（地图 / 倒车影像）和日期格式在渲染时直接调用 t() / I18N.locale()。
 * 不想被翻译的内容（歌词、歌名等外部数据）加 translate="no" 属性即可。
 */
(function () {
  'use strict';
  const KEY = 'driveos.lang';
  const CJK = /[\u3400-\u9fff]/;
  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
  const LANGS = [];                 // [{ code, label, short, locale, htmlLang }]
  const DICT = {};                  // code -> { exact: Map, pats: [{ re, kinds, out, w }] }
  const cache = {};                 // code -> Map（翻译结果缓存）
  const listeners = [];
  let lang = 'zh';

  const byCode = c => LANGS.find(l => l.code === c);
  function register(info) {
    const i = LANGS.findIndex(l => l.code === info.code);
    const rec = Object.assign({ short: info.label, locale: info.code, htmlLang: info.code }, info);
    if (i >= 0) LANGS[i] = rec; else LANGS.push(rec);
    mountSwitch();
  }
  register({ code: 'zh', label: '中文', short: '中文', locale: 'zh-CN', htmlLang: 'zh-CN' });

  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function compile(key, out) {
    let lenient = false;
    if (key[0] === '~') { lenient = true; key = key.slice(1); }   // ~ 开头：捕获内容翻不了也照样套用（用于夹着用户 / 外部数据的句子）
    const kinds = []; let w = 0;
    const src = key.split(/(\{#?\d+\})/).map(part => {
      const m = /^\{(#?)(\d+)\}$/.exec(part);
      if (!m) { w += part.length; return esc(part); }
      kinds.push(m[2]);
      return m[1] ? '([\\d.,:]+)' : '((?:(?! · )[^])+?)';   // {0} 不跨越 ' · ' 分隔
    }).join('');
    return { re: new RegExp('^' + src + '$'), idx: kinds.map(Number), out, w, lenient };
  }
  // add(code, 词典, 上下文规则)：上下文规则 [[CSS 选择器, { 中文: 译文 }], …]，用于同一个中文词在不同位置要译成不同英文 / 日文的情况
  function add(code, entries, ctx) {
    const d = DICT[code] || (DICT[code] = { exact: new Map(), pats: [], ctx: [] });
    if (ctx) d.ctx.push(...ctx);
    for (const k in entries) {
      if (/\{#?\d+\}/.test(k)) d.pats.push(compile(k, entries[k])); else d.exact.set(k, entries[k]);
    }
    d.pats.sort((a, b) => b.w - a.w);
    delete cache[code];
    if (lang !== 'zh' && (code === lang || code === 'en')) applyAll();
  }

  function lookup(s, code, depth) {
    const d = DICT[code];
    if (!d) return null;
    const hit = d.exact.get(s);
    if (hit != null) return hit;
    for (const p of d.pats) {
      const m = p.re.exec(s);
      if (!m) continue;
      const args = [];
      let ok = true;
      for (let i = 0; i < p.idx.length; i++) {
        let a = m[i + 1];
        if (CJK.test(a)) { const r = depth < 4 ? translate(a, code, depth + 1) : null; if (r == null) { if (!p.lenient) { ok = false; break; } } else a = r; }
        args[p.idx[i]] = a;
      }
      if (ok) return p.out.replace(/\{#?(\d+)\}/g, (_, n) => args[+n] != null ? args[+n] : '');
    }
    return null;
  }
  // 返回译文；找不到返回 null
  function translate(s, code, depth) {
    depth = depth || 0;
    let r = lookup(s, code, depth);
    if (r == null && code !== 'en') r = lookup(s, 'en', depth);
    if (r != null) return r;
    if (s.indexOf(' · ') > 0) {                       // “甲 · 乙”：分段翻译，翻到一段算一段
      const parts = s.split(' · '); let any = false;
      const out = parts.map(p => { if (!CJK.test(p)) return p; const x = translate(p, code, depth + 1); if (x != null) { any = true; return x; } return p; });
      if (any) return out.join(' · ');
    }
    return null;
  }
  function ctxLookup(core, el, code) {
    const d = DICT[code]; if (!d || !el || !el.closest) return null;
    for (const [sel, map] of d.ctx) if (map[core] != null && el.closest(sel)) return map[core];
    return null;
  }
  function tEl(s, el) {            // 带位置信息的翻译（先查上下文规则）
    const core = s.trim();
    let r = ctxLookup(core, el, lang);
    if (r == null && lang !== 'en') r = ctxLookup(core, el, 'en');
    return r == null ? t(s) : /^\s*/.exec(s)[0] + r + /\s*$/.exec(s)[0];
  }
  // 给 JS 用：t('中文') / t('{0} 分钟', 5)
  function t(s, ...args) {
    if (s == null) return s;
    s = String(s);
    let r = s;
    if (lang !== 'zh' && CJK.test(s)) {
      const c = cache[lang] || (cache[lang] = new Map());
      if (c.has(s)) r = c.get(s);
      else {
        const lead = /^\s*/.exec(s)[0], tail = /\s*$/.exec(s)[0], core = s.trim();
        const x = translate(core, lang);
        r = x == null ? s : lead + x + tail;
        c.set(s, r);
      }
    }
    return args.length ? r.replace(/\{(\d+)\}/g, (m, n) => args[+n] != null ? args[+n] : m) : r;
  }

  // ---------------------------------------------------------------- DOM 翻译
  const textRec = new WeakMap();    // Text -> { o: 原文, t: 译文 }
  const attrRec = new WeakMap();    // Element -> { attr: { o, t } }
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, CANVAS: 1 };

  function doText(n) {
    const cur = n.data, rec = textRec.get(n);
    const base = rec && cur === rec.t ? rec.o : cur;
    let out = base;
    if (lang !== 'zh' && CJK.test(base) && !(n.parentNode && n.parentNode.closest && n.parentNode.closest('[translate="no"]'))) out = tEl(base, n.parentNode);
    if (out !== cur) n.data = out;
    if (out !== base) textRec.set(n, { o: base, t: out }); else if (rec) textRec.delete(n);
  }
  function doAttr(el, a) {
    if (!el.hasAttribute(a)) return;
    const cur = el.getAttribute(a);
    let recs = attrRec.get(el), rec = recs && recs[a];
    const base = rec && cur === rec.t ? rec.o : cur;
    let out = base;
    if (lang !== 'zh' && CJK.test(base) && !el.closest('[translate="no"]')) out = tEl(base, el);
    if (out !== cur) el.setAttribute(a, out);
    if (out !== base) { if (!recs) attrRec.set(el, recs = {}); recs[a] = { o: base, t: out }; } else if (rec) delete recs[a];
  }
  function walk(node) {
    if (node.nodeType === 3) return doText(node);
    if (node.nodeType !== 1 || SKIP[node.tagName]) return;
    if (node.getAttribute('translate') === 'no') return;
    for (const a of ATTRS) if (node.hasAttribute(a)) doAttr(node, a);
    for (let c = node.firstChild; c; c = c.nextSibling) walk(c);
  }
  function applyAll() {
    if (!document.documentElement) return;
    document.documentElement.lang = (byCode(lang) || LANGS[0]).htmlLang;
    walk(document.documentElement);
    if (obs) obs.takeRecords();
  }
  let obs = null;
  function onMut(recs) {
    for (const r of recs) {
      if (r.type === 'childList') r.addedNodes.forEach(walk);
      else if (r.type === 'characterData') { if (r.target.parentNode && !SKIP[r.target.parentNode.tagName]) doText(r.target); }
      else if (r.type === 'attributes') { if (!SKIP[r.target.tagName]) doAttr(r.target, r.attributeName); }
    }
    obs.takeRecords();   // 丢弃我们自己写入引起的记录
  }
  function startObs() {
    if (obs || typeof MutationObserver === 'undefined') return;
    obs = new MutationObserver(onMut);
    obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function stopObs() { if (obs) { obs.disconnect(); obs = null; } }

  // ---------------------------------------------------------------- 切换
  function setLang(code, silent) {
    if (!byCode(code) && DICT[code] == null) code = 'zh';
    const changed = code !== lang;
    lang = code;
    try { localStorage.setItem(KEY, code); } catch (e) {}
    if (lang === 'zh') { applyAll(); stopObs(); } else { applyAll(); startObs(); }
    syncSwitch();
    if (changed && !silent) { listeners.slice().forEach(fn => { try { fn(lang); } catch (e) { console.error(e); } }); window.dispatchEvent(new CustomEvent('i18n:change', { detail: lang })); }
  }
  function onChange(fn) { listeners.push(fn); }

  // 顶部工具条的语言切换：≤4 种语言用分段按钮（与 .dev-seg 一致），更多时自动换成下拉框
  function mountSwitch() {
    const host = document.getElementById('devLang');
    if (!host) return;
    host.innerHTML = '';
    if (LANGS.length <= 4) {
      host.className = 'dev-seg';
      host.innerHTML = LANGS.map(l => `<button data-lang="${l.code}" title="${l.label}" translate="no">${l.short}</button>`).join('');
      host.onclick = e => { const b = e.target.closest('[data-lang]'); if (b) setLang(b.dataset.lang); };
    } else {
      host.className = '';
      host.innerHTML = `<select aria-label="Language" translate="no">${LANGS.map(l => `<option value="${l.code}">${l.label}</option>`).join('')}</select>`;
      host.firstChild.onchange = e => setLang(e.target.value);
      host.onclick = null;
    }
    syncSwitch();
  }
  function syncSwitch() {
    const host = document.getElementById('devLang');
    if (!host) return;
    host.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
    const s = host.querySelector('select'); if (s) s.value = lang;
  }

  const I18N = window.I18N = {
    register, add, t, setLang, onChange, langs: LANGS,
    get lang() { return lang; },
    locale: () => (byCode(lang) || LANGS[0]).locale,
    apply: applyAll,
    has: s => lang === 'zh' || translate(String(s).trim(), lang) != null,
  };
  window.t = t;

  // 启动：读取上次的选择；先挂观察器，边解析边翻译，避免先闪一下中文
  let saved = 'zh';
  try { saved = localStorage.getItem(KEY) || 'zh'; } catch (e) {}
  lang = saved;
  if (lang !== 'zh') { startObs(); applyAll(); }
  document.addEventListener('DOMContentLoaded', () => { if (!byCode(lang)) lang = 'zh'; mountSwitch(); applyAll(); if (lang !== 'zh') startObs(); else stopObs(); });
})();
