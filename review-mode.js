/* review-mode.js — review widget for the Credo Marketing Hub (loads only on ?review=1). Classic script, one IIFE.
 * Composed 8 Nov 2026 from library/features/review-widget, feature_version 1.6.0, for the hub on hub-chassis 1.3.0
 * (re-emit of the 27 Oct 1.3.0 composition, MH-95). Config: window.CREDO_REVIEW_CONFIG (data/review-config.js).
 *
 *  · Screens (hash-route-screens): the hub is one document; a screen is its hash route plus ?tab=. A record's `page` is
 *    PAGE_PREFIX + route [+ ?tab=], and a comment left in the chassis drawer also stores `drawer` = d=<type:id>[&dt=<tab>].
 *  · Anchors: renumbered per root on every pass, in document order (main "m-", drawer "d-"). A row or card the chassis
 *    marks with data-comment-key gets "<root>-k-<key>", and what is inside it counts within that key, so a comment stays
 *    on its entity when a filter or sort moves the other rows. Navigation and the top bar are chrome.
 *  · The chassis calls window.__rwRefresh after each render and drawer change; that is the full pass (keys, anchors,
 *    redraw). A MutationObserver covers late content. No polling.
 *  · Jumps set the hash; the chassis renders the screen and opens the drawer, and the widget spotlights once the anchor
 *    exists. "All screens" lists this hub's records only, grouped by screen.
 *  · One channel: window.__rwComments() is the read the chassis comments module (Hub.comments) uses.
 *  · 1.7.0 (12 Nov 2026): dots via a data-rw-pos mark + one layered zero-specificity rule (no inline position); storage under
 *    the hub's prefix with STORAGE_LEGACY_KEYS copied once; the widget keeps its own named Firebase app (credo-review).
 *  · 1.6.0: review mode never reflows the host page. Outlines are paint-only and the pill is fixed-positioned beside
 *    its element; the only style the widget sets on host elements is an inline position:relative on a commented element
 *    that is position:static, as the box for its status dots, removed on the next pass. Storage keys carry STORAGE_PREFIX.
 *  · No text preview is stored (operator 27 Oct): the database is readable without the hub password.
 *  · Records left before ANCHORS_FROM (the old hub's markup) are listed on their screen, not drawn on an element. */
(function () {
const CFG = window.CREDO_REVIEW_CONFIG || {};
const L = Object.assign({
  bannerTitle: 'Review mode', localOnly: 'Local-only', exit: 'Exit review', sidebarTitle: 'Comments',
  empty: 'No comments here yet. Hover any text and click the +.', add: '+ Comment', addTitle: 'Add comment', editTitle: 'Edit comment',
  save: 'Post comment', cancel: 'Cancel', edit: 'Edit', del: 'Delete', resolve: 'Resolve', reopen: 'Reopen',
  tabOpen: 'Open', tabResolved: 'Resolved', badgeOpen: 'open', badgeResolved: 'resolved',
  scopePage: 'This screen', scopeAll: 'All screens', thisPage: 'This screen', hideSide: 'Hide comments', showSide: 'Show comments',
  opens: 'opens ↗', edited: 'edited', earlierLayout: 'earlier layout', earlierLayoutTitle: '', drawerChipTitle: 'Left in a drawer',
  anonymous: 'Anonymous', resolvedBy: 'Resolved · {name}', resolvePrompt: 'Resolution note (what was done):',
  deleteConfirm: 'Delete this comment?', saveFailed: 'Could not save that. Check the connection and try again.',
  placeholder: 'Your feedback…', replacementPlaceholder: 'Suggested change (optional)…', namePrompt: 'Your name:'
}, CFG.REVIEW_LABELS || {});
const PREFIX = CFG.PAGE_PREFIX;                 /* required, no default (hash-route-screens) */
/* 1.7.0 storage namespace: STORAGE_PREFIX, else the hub-chassis hub's own prefix (HUB_CONFIG.storage.prefix, else id) + ':' */
const HUBC = window.HUB_CONFIG || {};
const SP = CFG.STORAGE_PREFIX || (((HUBC.storage && HUBC.storage.prefix) || HUBC.id) ? ((HUBC.storage && HUBC.storage.prefix) || HUBC.id) + ':' : '');
/* STORAGE_LEGACY_KEYS: keys the replaced deliverable used. { copy: 'key' } copies once (the old key stays for anything else
 * that reads it); a plain 'key' moves it. Each lands on the 1.7.0 key its name ends in: reviewer, comments or side. */
const LEGACY = CFG.STORAGE_LEGACY_KEYS || [];
const HR = CFG.HASH_ROUTES || {};
const DEFAULT_ROUTE = HR.defaultRoute || '/';
const RENAMES = CFG.PAGE_RENAMES || {}, DRAWER_RENAMES = CFG.DRAWER_RENAMES || {};
const ANCHORS_FROM = Number(CFG.ANCHORS_FROM) || 0;
const FB = CFG.FIREBASE_CONFIG || {};
const FB_OK = !!(FB.apiKey && FB.apiKey.indexOf('PASTE') !== 0 && FB.databaseURL && FB.databaseURL.indexOf('PASTE') < 0);
const NARROW = '(max-width:900px)';             /* below this the sidebar overlays the hub */

/* storage: every key carries the project prefix; a blocked store falls back to memory */
const _MEM = {};
function legacyFor(k) {
  const want = k.replace(/^review-/, '');
  for (const e of LEGACY) {
    const key = typeof e === 'string' ? e : e && e.copy; if (!key) continue;
    const tail = (key.match(/(reviewer|comments|side)$/) || [])[1]; if (tail !== want) continue;
    let v = null; try { v = localStorage.getItem(key); } catch (x) {}
    if (v == null) continue;
    try { localStorage.setItem(SP + k, v); if (typeof e === 'string') localStorage.removeItem(key); } catch (x) {}
    return v;
  }
  return null;
}
const store = {
  get(k) { try { const v = localStorage.getItem(SP + k); return v != null ? v : legacyFor(k); } catch (e) { return (SP + k in _MEM) ? _MEM[SP + k] : null; } },
  set(k, v) { try { localStorage.setItem(SP + k, v); } catch (e) { _MEM[SP + k] = v; } }
};
/* native dialogs can throw in an embedded browser (comment-lifecycle): one guard for all three */
function ask(kind, message, fallback) { try { return window[kind](message, kind === 'prompt' ? '' : undefined); } catch (e) { return fallback; } }
function reviewerName() {
  const saved = store.get('review-reviewer'); if (saved) return saved;   /* old names arrive through STORAGE_LEGACY_KEYS */
  const asked = ask('prompt', L.namePrompt, undefined);
  if (asked === undefined) return L.anonymous;   /* no dialog here: don't store it, a later session can still ask */
  const name = (asked || L.anonymous).trim() || L.anonymous;
  store.set('review-reviewer', name); return name;
}

/* commentable-everything, 'direct-text' mode: any element with ≥2 chars of its own text, except the deny-list */
const NEVER_ANCHOR = new Set([
  'input', 'select', 'textarea', 'option', 'optgroup', 'datalist', 'fieldset', 'legend',
  'script', 'style', 'template', 'noscript', 'meta', 'link', 'title', 'head', 'html', 'body',
  'svg', 'path', 'circle', 'rect', 'ellipse', 'polygon', 'polyline', 'line', 'g', 'use', 'defs', 'symbol', 'marker',
  'iframe', 'embed', 'object', 'param', 'br', 'hr', 'img', 'video', 'audio', 'source', 'track', 'picture', 'col', 'colgroup'
]);
const CHROME_SEL = '.review-banner,.review-sidebar,.review-modal-overlay,.review-floating-pill,.review-toggle-btn,[data-review-skip],.rw-dots';
const defaultOpen = el => { const a = el.closest('aside'); return !!(a && a.classList.contains('open')); };
const ROOTS = (HR.roots || []).map(r => ({ selector: r.selector, prefix: r.prefix, drawer: !!r.drawer, isOpen: typeof r.isOpen === 'function' ? r.isOpen : defaultOpen }));
const ROOT_SEL = ROOTS.map(r => r.selector).join(',');
function hasDirectText(el) { for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim().length >= 2) return true; return false; }
function classify(elm) {
  const tag = elm.tagName.toLowerCase();
  if (NEVER_ANCHOR.has(tag)) return null;
  if (hasDirectText(elm)) return tag;
  if (tag !== 'span' && elm.querySelector(':scope > img, :scope > picture, :scope > video')) return 'img';   /* image-anchoring: the image's container */
  return null;
}
const rootOpen = spec => { const r = document.querySelector(spec.selector); return !!(r && (!spec.drawer || spec.isOpen(r))); };
const rootSpecOf = elm => ROOTS.find(s => elm.closest && elm.closest(s.selector));

/* ───── screen key and drawer key, from the hash ───── */
function parseHash(hash) {
  const h = hash && hash !== '#' ? hash : '#' + DEFAULT_ROUTE, i = h.indexOf('?');
  const path = (i < 0 ? h : h.slice(0, i)).replace(/^#/, '') || DEFAULT_ROUTE;
  return { path, q: new URLSearchParams(i < 0 ? '' : h.slice(i + 1)) };
}
function screenKey() { const p = parseHash(location.hash), tab = p.q.get('tab'); return PREFIX + p.path + (tab ? '?tab=' + encodeURIComponent(tab) : ''); }
function drawerKey() {
  if (!ROOTS.some(s => s.drawer && rootOpen(s))) return '';
  const p = parseHash(location.hash), d = p.q.get('d'); if (!d) return '';
  const s = new URLSearchParams(); s.set('d', d); const dt = p.q.get('dt'); if (dt) s.set('dt', dt); return s.toString();
}

/* ───── page-rename-map: the same function a store migration uses ───── */
function renamePage(page, map) {
  const i = page.indexOf('?tab='), base = i < 0 ? page : page.slice(0, i), tail = i < 0 ? '' : page.slice(i), seen = new Set([base]);
  let cur = base;
  while (Object.prototype.hasOwnProperty.call(map, cur)) { cur = map[cur]; if (seen.has(cur)) throw new Error('page rename loop at ' + cur); seen.add(cur); }
  return cur + tail;
}
function renameRecord(rec) {
  const patch = {}, page = renamePage(rec.page, RENAMES);
  if (page !== rec.page) { patch.page = page; if (rec.anchor && rec.anchor.startsWith(rec.page + '-')) patch.anchor = page + rec.anchor.slice(rec.page.length); }
  if (rec.drawer) { const q = new URLSearchParams(rec.drawer), d = q.get('d'); if (d && Object.prototype.hasOwnProperty.call(DRAWER_RENAMES, d)) { q.set('d', DRAWER_RENAMES[d]); patch.drawer = q.toString(); } }
  return Object.keys(patch).length ? patch : null;
}
function withRenames(data) {
  const out = {};
  Object.keys(data || {}).forEach(id => { const c = data[id]; const p = c && typeof c.page === 'string' ? renameRecord(c) : null; out[id] = p ? Object.assign({}, c, p) : c; });
  return out;
}

/* ───── deterministic anchors, per root ───── */
function anchorRoot(root, spec) {
  const counters = {};
  root.querySelectorAll('*').forEach(elm => {
    if (elm.closest(CHROME_SEL)) return;
    const key = elm.getAttribute('data-comment-key');
    const kind = key ? null : classify(elm);
    let id = key ? spec.prefix + '-k-' + key : null;
    if (kind) {
      const host = elm.parentElement.closest('[data-comment-key]');   /* inside a keyed element, count within its key */
      const base = spec.prefix + (host && root.contains(host) ? '-k-' + host.getAttribute('data-comment-key') : '') + '-' + kind;
      counters[base] = (counters[base] || 0) + 1; id = base + '-' + counters[base];
    }
    if (id) { if (elm.getAttribute('data-comment-id') !== id) elm.setAttribute('data-comment-id', id); }
    else if (elm.hasAttribute('data-comment-id')) elm.removeAttribute('data-comment-id');
  });
}
function anchorPass() { ROOTS.forEach(spec => { const r = document.querySelector(spec.selector); if (r && (!spec.drawer || spec.isOpen(r))) anchorRoot(r, spec); }); }

/* ───── records ───── */
function statusOf(c) { const s = c.status; return (s === 'resolved' || s === 'applied' || s === 'archived' || c.archived || c.applied) ? 'resolved' : 'pending'; }
const isHub = c => !!(c && typeof c.page === 'string' && c.page.indexOf(PREFIX) === 0);
const current = c => !(ANCHORS_FROM && (c.timestamp || 0) < ANCHORS_FROM);   /* false: an anchor in the old hub's markup */
const onScreen = c => isHub(c) && c.page === SLUG;
const atPlace = c => onScreen(c) && (!c.drawer || c.drawer === DRAWER);   /* its screen, and its drawer open on its tab */
const visibleHere = c => atPlace(c) && current(c);                          /* decorated and spotlit here */
const cssq = v => (window.CSS && CSS.escape) ? CSS.escape(v) : v;
function commentRows() {
  return Object.entries(COMMENTS).filter(([, c]) => isHub(c)).map(([id, c]) => ({
    id, anchor: c.anchor, ref: new URLSearchParams(c.drawer || '').get('d') || undefined, route: c.page.slice(PREFIX.length),
    author: c.author || L.anonymous, text: c.comment || '', status: statusOf(c), at: c.timestamp
  }));
}

/* ───── adapters (firebase-rtdb-adapter: broad subscribe, filter here) ───── */
function localAdapter() {
  const KEY = 'review-comments'; let cb = null;
  const read = () => { try { return JSON.parse(store.get(KEY) || '{}'); } catch (e) { return {}; } };
  const write = o => store.set(KEY, JSON.stringify(o)); const ping = () => cb && cb(read());
  return { local: true,
    subscribe(fn) { cb = fn; fn(read()); window.addEventListener('storage', e => { if (e.key === SP + KEY) fn(read()); }); return () => { cb = null; }; },
    create(rec) { const o = read(); const id = 'c' + Date.now() + Math.random().toString(36).slice(2, 7); o[id] = rec; write(o); ping(); return Promise.resolve(id); },
    update(id, patch) { const o = read(); o[id] = Object.assign({}, o[id], patch); write(o); ping(); return Promise.resolve(); },
    remove(id) { const o = read(); delete o[id]; write(o); ping(); return Promise.resolve(); } };
}
async function firebaseAdapter() {
  const A = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const D = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
  /* a named app, so the widget always reaches this client's project whatever else the page initialises */
  const app = A.getApps().find(a => a.name === 'credo-review') || A.initializeApp(FB, 'credo-review');
  const db = D.getDatabase(app), root = D.ref(db, 'comments');
  return { local: false,
    subscribe(fn) { return D.onValue(root, s => fn(s.val() || {})); },
    create(rec) { const r = D.push(root); return D.set(r, rec).then(() => r.key); },
    update(id, patch) { return D.update(D.ref(db, 'comments/' + id), patch); },
    remove(id) { return D.remove(D.ref(db, 'comments/' + id)); } };
}

function el(t, c, h) { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function when(ts) { const d = new Date(ts || Date.now()); return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

let SLUG = '', DRAWER = '', LASTHASH = null;
let BANNER, SIDE, LIST, TABS, SCOPEEL, PILL, ROUTE, ADAPTER, ME, COMMENTS = {}, FILTER = 'open', SCOPE = 'page';
let curEl = null, curId = null, hideT = null, SELID = null, SELANCHOR = null, FOCUS = null, JUMPROW = null;
const TAB_OF = { open: 'pending', resolved: 'resolved' };

/* labels come from the key itself: "/ads/phone-numbers?tab=bing" → "ads › phone-numbers · bing" */
function pageLabel(page) {
  const s = String(page || '').slice(PREFIX.length), i = s.indexOf('?tab=');
  const path = (i < 0 ? s : s.slice(0, i)).replace(/^\//, '').split('/').map(x => { try { return decodeURIComponent(x); } catch (e) { return x; } }).join(' › ');
  return (path || DEFAULT_ROUTE.replace(/^\//, '')) + (i < 0 ? '' : ' · ' + decodeURIComponent(s.slice(i + 5)));
}
function drawerLabel(dr) { const q = new URLSearchParams(dr || ''); return (q.get('d') || '') + (q.get('dt') ? ' · ' + q.get('dt') : ''); }
function currentTitle() { return (document.title || '').split(' · ')[0] || pageLabel(SLUG); }
const narrow = () => window.matchMedia(NARROW).matches;

function setSide(hidden) {
  document.documentElement.setAttribute('data-rw-side', hidden ? 'hidden' : 'shown');
  if (SIDE) SIDE.classList.toggle('rw-collapsed', hidden);
  const b = document.querySelector('.rw-side-btn'); if (b) { b.textContent = hidden ? L.showSide : L.hideSide; b.setAttribute('aria-expanded', String(!hidden)); }
  store.set('review-side', hidden ? 'hidden' : 'shown');
}

function buildChrome() {
  BANNER = el('div', 'review-banner'); BANNER.setAttribute('data-review-skip', '');
  BANNER.innerHTML = '<span class="rw-title">' + esc(L.bannerTitle) + '</span><span class="rw-route"></span>' + (ADAPTER.local ? '<span class="rw-local">' + esc(L.localOnly) + '</span>' : '') + '<span class="rw-spacer"></span><span class="rw-name">' + esc(ME) + '</span>';
  const side = el('button', 'rw-side-btn', esc(L.hideSide)); side.type = 'button'; side.onclick = () => setSide(!SIDE.classList.contains('rw-collapsed'));
  const exit = el('button', null, esc(L.exit)); exit.type = 'button'; exit.onclick = () => { const u = new URL(location.href); u.searchParams.delete('review'); location.href = u.toString(); };
  BANNER.appendChild(side); BANNER.appendChild(exit); document.body.appendChild(BANNER);
  ROUTE = BANNER.querySelector('.rw-route');

  SIDE = el('aside', 'review-sidebar'); SIDE.setAttribute('aria-label', L.sidebarTitle);
  SIDE.appendChild(el('h3', null, '<span>' + esc(L.sidebarTitle) + '</span>'));
  SCOPEEL = el('div', 'rw-scopebar');
  [['page', L.scopePage], ['all', L.scopeAll]].forEach(([k, lbl]) => {
    const b = el('button', k === SCOPE ? 'on' : null, esc(lbl)); b.type = 'button'; b.dataset.s = k;
    b.onclick = () => { SCOPE = k; SCOPEEL.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.s === k)); render(); };
    SCOPEEL.appendChild(b);
  });
  SIDE.appendChild(SCOPEEL);
  TABS = el('div', 'review-tabs');
  [['open', L.tabOpen], ['resolved', L.tabResolved]].forEach(([k, lbl]) => {
    const b = el('button', k === FILTER ? 'on' : null, esc(lbl) + ' <span class="rw-c">0</span>'); b.type = 'button'; b.dataset.k = k;
    b.onclick = () => { FILTER = k; TABS.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.k === k)); render(); };
    TABS.appendChild(b);
  });
  SIDE.appendChild(TABS);
  LIST = el('div', 'review-list'); SIDE.appendChild(LIST); document.body.appendChild(SIDE);
  /* Tab inside the chrome stays there: the chassis' overlay-drawer trap would pull focus into the drawer */
  [BANNER, SIDE].forEach(n => n.addEventListener('keydown', e => { if (e.key === 'Tab') e.stopPropagation(); }));
  const saved = store.get('review-side');
  setSide(saved ? saved === 'hidden' : narrow());   /* phones start hidden; elsewhere the last choice is kept */

  PILL = el('button', 'review-floating-pill', esc(L.add)); PILL.type = 'button'; PILL.setAttribute('data-review-skip', '');
  document.body.appendChild(PILL);
  PILL.addEventListener('mouseenter', () => clearTimeout(hideT));
  PILL.addEventListener('mouseleave', hidePillSoon);
  PILL.addEventListener('click', () => { if (curId && curEl) openComposer(curId, curEl); });
  document.addEventListener('mouseover', e => {
    if (!e.target.closest || e.target.closest(CHROME_SEL)) return;
    let a = e.target.closest('[data-comment-id]');
    if (!a && e.target.closest(ROOT_SEL)) { anchorPass(); a = e.target.closest('[data-comment-id]'); }
    if (a && a.closest(ROOT_SEL)) { clearTimeout(hideT); placePill(a); }
  });
  /* touch: no hover, so a tap on commentable text shows the pill; the tap still does what it does in the hub */
  document.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch' || !e.target.closest || e.target.closest(CHROME_SEL)) return;
    if (e.target.closest(ROOT_SEL)) anchorPass();
    const a = e.target.closest('[data-comment-id]');
    if (a && a.closest(ROOT_SEL)) { clearTimeout(hideT); placePill(a); } else hidePillSoon();
  }, true);
  document.addEventListener('mouseout', e => { const to = e.relatedTarget; if (to && (to === PILL || (to.closest && to.closest('[data-comment-id]')))) return; hidePillSoon(); });
  window.addEventListener('scroll', () => { if (curEl && PILL.style.display === 'block') placePill(curEl); }, true);
  window.addEventListener('resize', () => render());
}
/* fixed, beside its element, not over it: on a short tab or link the pill would block the click. No containing block
 * is needed, so hovering never touches the host's styles. */
function placePill(elm) {
  curEl = elm; curId = elm.getAttribute('data-comment-id'); PILL.style.display = 'block';
  const r = elm.getBoundingClientRect(), w = PILL.offsetWidth;
  /* the right edge is the sidebar's left edge while it shows, or the pill lands under it (next to the docked drawer) */
  const edge = SIDE && !SIDE.classList.contains('rw-collapsed') && !narrow() ? SIDE.getBoundingClientRect().left : window.innerWidth;
  PILL.style.top = Math.max(52, Math.min(r.top, window.innerHeight - 34)) + 'px';
  PILL.style.left = (r.right + 6 + w < edge ? r.right + 6 : r.left - w - 6 >= 6 ? r.left - w - 6 : Math.max(6, Math.min(r.right, edge) - w - 6)) + 'px';
}
function hidePillSoon() { clearTimeout(hideT); hideT = setTimeout(() => { PILL.style.display = 'none'; curEl = null; curId = null; }, 160); }

function modal(title, ctx, initText, initRepl, onSave, back) {
  const ov = el('div', 'review-modal-overlay'), m = el('div', 'review-modal');
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', title);
  m.innerHTML = '<h4>' + esc(title) + '</h4><div class="rw-ctx">' + esc(ctx) + '</div>';
  const ta = el('textarea'); ta.placeholder = L.placeholder; ta.value = initText || '';
  const tr = el('textarea'); tr.placeholder = L.replacementPlaceholder; tr.value = initRepl || ''; tr.style.minHeight = '44px';
  const acts = el('div', 'rw-modal-acts');
  const close = () => { ov.remove(); const b = typeof back === 'function' ? back() : back; if (b && b.focus && document.contains(b)) b.focus({ preventScroll: true }); };
  const cancel = el('button', 'rw-cancel', esc(L.cancel)); cancel.type = 'button'; cancel.onclick = close;
  const save = el('button', 'rw-save', esc(L.save)); save.type = 'button';
  save.onclick = () => { const t = ta.value.trim(), r = tr.value.trim(); if (!t && !r) return; onSave(t, r); close(); };
  acts.appendChild(cancel); acts.appendChild(save); m.appendChild(ta); m.appendChild(tr); m.appendChild(acts); ov.appendChild(m);
  ov.onclick = e => { if (e.target === ov) close(); };
  /* its own Escape and Tab, stopped here: one Escape must not also close the hub's drawer, and the drawer's Tab trap
   * must not pull focus out of the dialog. The dialog moves focus itself (WebKit's Tab skips buttons). */
  ov.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); return; }
    if (e.key === 'Tab') { e.stopPropagation(); e.preventDefault(); const f = [ta, tr, cancel, save], i = f.indexOf(document.activeElement); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
  });
  document.body.appendChild(ov); ta.focus();
}
function openComposer(anchor, elm) {
  /* the element's text is shown so the reviewer knows what they comment on; it is not stored */
  const live = (elm.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90) || (elm.querySelector('img,video') ? '[image]' : '');
  const spec = rootSpecOf(elm), page = SLUG, drawer = spec && spec.drawer ? DRAWER : '';   /* kept from the moment it opened */
  const trigger = document.activeElement;
  const back = () => {
    if (trigger && trigger !== PILL && trigger !== document.body && document.contains(trigger)) return trigger;
    const a = document.contains(elm) ? elm : document.querySelector('[data-comment-id="' + cssq(anchor) + '"]');
    return (a && a.closest('a[href],button,[tabindex]')) || (spec && document.querySelector(spec.selector)) || null;
  };
  modal(L.addTitle, currentTitle() + (drawer ? ' · ' + drawerLabel(drawer) : '') + ' · ' + live, '', '', (text, repl) => {
    const rec = { comment: text, replacement: repl || null, anchor: anchor, page: page, author: ME, status: 'pending', timestamp: Date.now() };
    if (drawer) rec.drawer = drawer;
    saveOr(ADAPTER.create(rec));
  }, back);
}
function saveOr(pr) { return Promise.resolve(pr).catch(e => { console.warn('[review] write failed', e); ask('alert', L.saveFailed); }); }
function actBtn(label, cls, fn) { const b = el('button', cls, esc(label)); b.type = 'button'; b.onclick = ev => { ev.stopPropagation(); fn(); }; return b; }

/* spotlight-on-click: an anchor that takes no space climbs to the nearest ancestor that does (both dimensions) */
function visibleTarget(e0, stop) {
  let found = null;
  for (let e = e0; e && e !== stop && e.getBoundingClientRect; e = e.parentElement) {
    const r = e.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) found = found || e; else found = null;   /* a collapsed ancestor clips what is inside it */
  }
  return found;
}
function targetOf(c) { if (!c || !visibleHere(c)) return null; return visibleTarget(document.querySelector('[data-comment-id="' + cssq(c.anchor) + '"]'), document.body); }

/* comment-status-indicators: outline + one dot per comment. The dots sit inside the element's right edge (the hub's
 * panels and tables scroll); a row's dots go in its last cell, since a <tr> can't hold a box of its own. */
function dotHost(a) {
  const t = a.tagName;
  if (t === 'TR') { const c = a.lastElementChild; return c && (c.tagName === 'TD' || c.tagName === 'TH') ? c : null; }
  if (t === 'TABLE' || t === 'THEAD' || t === 'TBODY' || t === 'TFOOT') return null;
  return a;
}
/* 1.7.0 (comment-status-indicators): the one positioning rule, in cascade layer rw-pos, in its own style element kept first
 * in <head>, so any host rule, layered (Tailwind v4) or not, beats it; dialogs and popovers keep the browser's position */
function ensurePosLayer() {
  let st = document.getElementById('rw-pos-layer');
  if (!st) { st = document.createElement('style'); st.id = 'rw-pos-layer';
    st.textContent = '@layer rw-pos{:where([data-review-mode="on"] [data-rw-pos]:not(dialog,[popover])){position:relative}}'; }
  if (document.head.firstChild !== st) document.head.insertBefore(st, document.head.firstChild);
}
function decorate(here) {
  document.querySelectorAll('.has-comment,.has-applied-comment').forEach(e => e.classList.remove('has-comment', 'has-applied-comment'));
  document.querySelectorAll('.rw-dots').forEach(e => e.remove());
  document.querySelectorAll('[data-rw-pos]').forEach(e => e.removeAttribute('data-rw-pos'));   /* released at the start of every pass */
  ensurePosLayer();
  const by = {};
  here.forEach(([, c]) => { const r = by[c.anchor] || (by[c.anchor] = { active: 0, resolved: 0 }); if (statusOf(c) === 'resolved') r.resolved++; else r.active++; });
  Object.keys(by).forEach(an => {
    const r = by[an];
    document.querySelectorAll('[data-comment-id="' + cssq(an) + '"]').forEach(a => {
      a.classList.add(r.active > 0 ? 'has-comment' : 'has-applied-comment');
      const host = dotHost(a); if (!host) return;
      /* 1.7.0: mark the host; the zero-specificity rule in the weakest layer positions it only where no host rule does */
      host.setAttribute('data-rw-pos', '');
      const d = document.createElement('span'); d.className = 'rw-dots'; d.setAttribute('aria-hidden', 'true');
      let h = ''; for (let i = 0; i < r.active; i++) h += '<i class="rw-dot rw-dot-active"></i>'; for (let i = 0; i < r.resolved; i++) h += '<i class="rw-dot rw-dot-resolved"></i>';
      d.innerHTML = h; host.appendChild(d);
    });
  });
}

function render() {
  if (!LIST) return;
  const fr = document.activeElement && document.activeElement.closest && document.activeElement.closest('.review-row');
  const focusId = fr && LIST.contains(fr) ? fr.dataset.id : null;   /* hosts redraw often: keep focus on the row it was on */
  if (ROUTE) ROUTE.textContent = '· ' + currentTitle() + (DRAWER ? ' · ' + drawerLabel(DRAWER) : '');
  const all = Object.entries(COMMENTS).filter(([, c]) => isHub(c));
  const screen = all.filter(([, c]) => onScreen(c));
  decorate(screen.filter(([, c]) => visibleHere(c)));
  const source = SCOPE === 'all' ? all : screen;
  const counts = { pending: 0, resolved: 0 };
  source.forEach(([, c]) => { counts[statusOf(c)]++; });
  TABS.querySelectorAll('button').forEach(b => { b.querySelector('.rw-c').textContent = counts[TAB_OF[b.dataset.k]] || 0; });
  const rows = readingOrder(source.filter(([, c]) => statusOf(c) === TAB_OF[FILTER]));
  LIST.innerHTML = '';
  if (!rows.length) { LIST.appendChild(el('div', 'review-empty', esc(L.empty))); applyActive(); return; }
  const grouped = SCOPE === 'all', groups = {};
  rows.forEach(e => { const k = grouped ? e[1].page : ''; (groups[k] || (groups[k] = [])).push(e); });
  const order = Object.keys(groups).sort((a, b) => a === SLUG ? -1 : b === SLUG ? 1 : pageLabel(a).localeCompare(pageLabel(b)));
  order.forEach(pg => {
    if (grouped) {
      const hdr = el('div', 'rw-group' + (pg === SLUG ? ' rw-group-here' : ''));
      hdr.innerHTML = '<span class="rw-group-name">' + esc(pg === SLUG ? L.thisPage : pageLabel(pg)) + '</span><span class="rw-group-count">' + groups[pg].length + '</span>';
      LIST.appendChild(hdr);
    }
    groups[pg].forEach(([id, c]) => LIST.appendChild(rowFor(id, c)));
  });
  if (focusId) { const r = LIST.querySelector('.review-row[data-id="' + cssq(focusId) + '"]'); if (r) r.focus({ preventScroll: true }); }
  applyActive();
}
function rowFor(id, c) {
  const st = statusOf(c), here = atPlace(c), old = !current(c);
  const row = el('div', 'review-row' + (id === SELID ? ' rw-selected' : '') + (here ? '' : ' rw-offpage') + (old ? ' rw-old' : ''));
  row.dataset.id = id; row.tabIndex = 0;
  row.innerHTML = '<div class="rw-meta"><b>' + esc(c.author || L.anonymous) + '</b><span class="rw-badge rw-' + st + '">' + esc(st === 'resolved' ? L.badgeResolved : L.badgeOpen) + '</span>' +
    (c.drawer ? '<span class="rw-drawer-chip" title="' + esc(L.drawerChipTitle) + '">' + esc(drawerLabel(c.drawer)) + '</span>' : '') +
    (old ? '<span class="rw-old-chip" title="' + esc(L.earlierLayoutTitle) + '">' + esc(L.earlierLayout) + '</span>' : '') +
    (here ? '' : '<span class="rw-jump">' + esc(L.opens) + '</span>') +
    '<span>' + when(c.timestamp) + (c.edited_at ? ' · ' + esc(L.edited) : '') + '</span></div>' +
    '<div class="rw-body">' + esc(c.comment || '') + '</div>' +
    (c.replacement ? '<div class="rw-repl">↳ ' + esc(c.replacement) + '</div>' : '') +
    (st === 'resolved' && c.resolution ? '<div class="rw-resolution">✓ ' + esc(c.resolution) + '</div>' : '') +
    '<div class="rw-anchor">' + esc(c.anchor) + '</div>';
  const acts = el('div', 'rw-acts');
  if (st === 'pending') {
    acts.appendChild(actBtn(L.edit, 'edit-btn', () => modal(L.editTitle, c.anchor, c.comment || '', c.replacement || '', (t, r) => saveOr(ADAPTER.update(id, { comment: t, replacement: r || null, edited_at: Date.now() })), () => LIST.querySelector('.review-row[data-id="' + cssq(id) + '"]'))));
    acts.appendChild(actBtn(L.resolve, 'resolve-btn', () => { const note = (ask('prompt', L.resolvePrompt, '') || '').trim(); saveOr(ADAPTER.update(id, { status: 'resolved', resolution: note || L.resolvedBy.replace('{name}', ME), resolved_at: Date.now(), resolved_by: ME })); }));
  } else acts.appendChild(actBtn(L.reopen, 'restore-btn', () => saveOr(ADAPTER.update(id, { status: 'pending', resolution: null }))));
  acts.appendChild(actBtn(L.del, 'delete-btn', () => { if (ask('confirm', L.deleteConfirm, false)) saveOr(ADAPTER.remove(id)); }));
  row.appendChild(acts);
  const go = here ? () => { SELID = id; spotlight(c); render(); if (narrow()) setSide(true); } : () => jumpTo(id, c);
  row.onclick = go; row.onkeydown = e => { if (e.key === 'Enter' && e.target === row) go(); };
  return row;
}
/* global-comment-list reading order: rows of the screen top to bottom, left to right; the rest after, oldest first */
function readingOrder(entries) {
  const pos = new Map();
  entries.forEach(e => { const t = targetOf(e[1]); if (!t) return; const r = t.getBoundingClientRect(); if (!r.width && !r.height) return; pos.set(e[0], { top: r.top + window.pageYOffset, bottom: r.bottom + window.pageYOffset, left: r.left + window.pageXOffset }); });
  const ts = e => e[1].timestamp || 0;
  const placed = entries.filter(e => pos.has(e[0])).sort((a, b) => pos.get(a[0]).top - pos.get(b[0]).top || ts(a) - ts(b));
  const band = new Map(); let row = 0, bottom = -Infinity;
  placed.forEach(e => { const p = pos.get(e[0]); if (p.top >= bottom) { row++; bottom = p.bottom; } else bottom = Math.min(bottom, p.bottom); band.set(e[0], row); });
  placed.sort((a, b) => band.get(a[0]) - band.get(b[0]) || pos.get(a[0]).left - pos.get(b[0]).left || pos.get(a[0]).top - pos.get(b[0]).top || ts(a) - ts(b));
  return placed.concat(entries.filter(e => !pos.has(e[0])).sort((a, b) => ts(a) - ts(b)));
}
/* the selected comment's element keeps a solid outline, only while that comment is visible here (anchor ids repeat
 * across drawer tabs) */
function applyActive() {
  document.querySelectorAll('.rw-active-anchor').forEach(e => e.classList.remove('rw-active-anchor'));
  const c = SELID && COMMENTS[SELID]; if (!c || !SELANCHOR || !visibleHere(c)) return;
  const v = cssq(SELANCHOR);
  document.querySelectorAll('[data-comment-id="' + v + '"],[data-slot="' + v + '"]').forEach(a => { const t = visibleTarget(a, document.body); if (t) t.classList.add('rw-active-anchor'); });
}
function spotlight(c) {
  SELANCHOR = c.anchor; applyActive();
  const a = targetOf(c); if (!a) return null;
  a.scrollIntoView({ behavior: 'smooth', block: 'center' });
  a.classList.remove('rw-spot'); void a.offsetWidth; a.classList.add('rw-spot'); setTimeout(() => a.classList.remove('rw-spot'), 1200);
  return a;
}
/* another screen or drawer: set the hash (the chassis renders the screen and opens the drawer), then spotlight once the
 * anchor exists. ?review=1 lives in the query, so the session survives. */
function commentHash(c) { let h = '#' + c.page.slice(PREFIX.length); if (c.drawer) h += (h.indexOf('?') < 0 ? '?' : '&') + c.drawer; return h; }
function jumpTo(id, c) {
  FOCUS = { id: id, tries: 0 }; JUMPROW = c.drawer ? id : null;
  if (narrow()) setSide(true);   /* below the overlay width the target is under the sidebar */
  const h = commentHash(c);
  if (location.hash !== h) location.hash = h;
  setTimeout(tryFocus, 60);
}
function tryFocus() {
  if (!FOCUS) return;
  const id = FOCUS.id, c = COMMENTS[id]; if (!c) { FOCUS = null; return; }
  syncRoute();
  if (atPlace(c)) {
    anchorPass();
    const want = statusOf(c) === 'resolved' ? 'resolved' : 'open';
    if (FILTER !== want) { FILTER = want; TABS.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.k === want)); }
    SELID = id;   /* the jump sets its selection when it arrives */
    if (!current(c) || spotlight(c)) { FOCUS = null; render(); return; }   /* an old-layout record: its screen, no element */
  }
  if (++FOCUS.tries < 12) setTimeout(tryFocus, 250); else { FOCUS = null; render(); }
}
/* re-read the screen and drawer; a screen change clears the selection unless a jump is arriving */
function syncRoute() {
  const s = screenKey(), d = drawerKey(), wasDrawer = DRAWER;
  if (location.hash === LASTHASH && s === SLUG && d === DRAWER) return false;
  LASTHASH = location.hash;
  if (s !== SLUG && !FOCUS) { SELANCHOR = null; SELID = null; }
  SLUG = s; DRAWER = d;
  /* a drawer reached by a jump closed: focus goes back to the row that opened it, or to the sidebar toggle */
  if (wasDrawer && !d && JUMPROW && !FOCUS) {
    const id = JUMPROW; JUMPROW = null;
    setTimeout(() => {
      const r = SIDE && !SIDE.classList.contains('rw-collapsed') && LIST.querySelector('.review-row[data-id="' + cssq(id) + '"]');
      (r || document.querySelector('.rw-side-btn')).focus({ preventScroll: true });
    }, 0);
  }
  return true;
}

/* the full pass the host calls (hash-route-screens "Keeping up with the host"), batched to one microtask */
function startRouteSync() {
  let scheduled = false;
  const soon = () => {
    if (scheduled) return; scheduled = true;
    queueMicrotask(() => { scheduled = false; syncRoute(); anchorPass(); render(); if (FOCUS) tryFocus(); });
  };
  window.__rwRefresh = soon;
  window.addEventListener('hashchange', soon);
  if (!HR.hostRefresh) {   /* fallback for a host that can't call: poll the hash and the drawers' open state */
    const state = () => location.hash + '|' + ROOTS.map(s => rootOpen(s) ? 1 : 0).join('');
    let last = state();
    setInterval(() => { const now = state(); if (now !== last) { last = now; soon(); } }, 400);
  }
  /* late content (lazy tabs, table filters); our own dots are skipped, or render() would loop */
  new MutationObserver(muts => {
    for (const m of muts) for (const node of m.addedNodes || []) {
      if (!node || node.nodeType !== 1) continue;
      if (node.closest && node.closest(CHROME_SEL)) continue;
      soon(); return;
    }
  }).observe(document.body, { childList: true, subtree: true });
  return soon;
}

async function init() {
  /* page-rename-map: a loop in the map is a config error, so fail at load */
  try { Object.keys(RENAMES).forEach(k => renamePage(k, RENAMES)); } catch (e) { console.error('[review] ' + e.message + '; the widget does not start'); return; }
  ME = reviewerName();
  try { ADAPTER = FB_OK ? await firebaseAdapter() : localAdapter(); } catch (e) { console.warn('[review] firebase init failed, using local', e); ADAPTER = localAdapter(); }
  buildChrome();
  syncRoute(); anchorPass(); render();
  startRouteSync();
  /* one channel: the chassis comments module reads the widget's records, never a store of its own */
  window.__rwComments = commentRows;
  let connected = false;
  ADAPTER.subscribe(data => {
    COMMENTS = withRenames(data || {}); render(); if (FOCUS) tryFocus();
    const H = window.Hub;
    if (H && H.comments) { if (!connected) { connected = true; H.comments.source(() => Promise.resolve(commentRows())); } else H.comments.read(); }
  });
}

/* TDZ-safe: every const above has run. Refuse to start without a page prefix or a storage namespace. */
if (!PREFIX) console.error('[review] PAGE_PREFIX is not set in CREDO_REVIEW_CONFIG; the widget does not start');
else if (!SP) console.error('[review] STORAGE_PREFIX is not set in CREDO_REVIEW_CONFIG; the widget does not start');
else if (!ROOTS.length) console.error('[review] HASH_ROUTES.roots is empty; the widget does not start');
else init();
})();   /* js-isolation: window.__rwRefresh and window.__rwComments are the only exports */
