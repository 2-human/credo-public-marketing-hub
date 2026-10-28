/* review-mode.js — review widget (loads only on ?review=1). Classic script.
 * Floating add-comment pill (deepest hovered anchor) + banner + sidebar with
 * three status tabs (Active/Applied/Archived) per comment-lifecycle.md.
 * Persists via Firebase RTDB (/comments/{id}) or a localStorage fallback. */
/* C6 · library/features/review-widget/js-isolation.md — the entire widget body
 * is wrapped in one IIFE so its helpers (el, esc, render, modal, store, …) are
 * IIFE-locals, never bare top-level globals. A host page that declares its own
 * top-level `esc`/`render` (e.g. ads-map.html / phone-map.html data grids) no
 * longer collides with the widget, so those pages need no defensive wrap of
 * their own. The only cross-boundary surface is the window.__rw* hooks below
 * (host-called re-render/reveal), which already go through `window.` explicitly
 * and so survive the wrap. This is the JS-scope parallel to css-isolation.md. */
(function(){
const CFG = (window.CREDO_REVIEW_CONFIG) || {};
const L = Object.assign({
  bannerTitle:'Review mode', localOnly:'Local-only', exit:'Exit review', sidebarTitle:'Comments',
  empty:'No comments here yet. Hover an ad, its copy, headline, description, or image and click the +.',
  add:'+ Comment', save:'Post comment', cancel:'Cancel',
  edit:'Edit', del:'Delete', resolve:'Resolve', reopen:'Reopen',
  tabOpen:'Open', tabResolved:'Resolved', resolvePrompt:'Resolution note (what was done):',
  placeholder:'Your feedback…', replacementPlaceholder:'Suggested change (optional)…', namePrompt:'Your name:'
}, CFG.REVIEW_LABELS || {});
const FB = CFG.FIREBASE_CONFIG || {};
const FB_OK = FB.apiKey && FB.apiKey.indexOf('PASTE') !== 0 && FB.databaseURL && FB.databaseURL.indexOf('PASTE') < 0;
const _MEM = {};
const store = {get(k){try{return localStorage.getItem(k)}catch(e){return (k in _MEM)?_MEM[k]:null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){_MEM[k]=v}}};

/* 2026-06-23: switched from canonical 'allowlist' mode to 'direct-text' mode
 * per library/features/review-widget/commentable-everything.md. Every element
 * with direct text content (≥2 chars) becomes commentable, except those in
 * the curated NEVER_ANCHOR deny-list (form controls, SVG internals, void
 * elements, layout-only table cells). Site chrome (nav/header[role=banner]/
 * footer) is still skipped because chromeAnchored is left at false; flip
 * that and add CHROME_COUNTERS routing if you want footer / nav comments. */
const NEVER_ANCHOR = new Set([
  'input','select','textarea','option','optgroup','datalist','fieldset','legend',
  'script','style','template','noscript','meta','link','title','head','html','body',
  'svg','path','circle','rect','ellipse','polygon','polyline','line','g','use','defs','symbol','marker',
  'iframe','embed','object','param',
  'br','hr','img','video','audio','source','track','picture',
  'col','colgroup'
]);
const CHROME_SEL = '.review-banner,.review-sidebar,.review-modal-overlay,.review-floating-pill,[data-review-skip]';
/* C17 · library/features/review-widget/commentable-everything.md → anchorEmpty.
   A tag listed in CREDO_REVIEW_CONFIG.anchorEmpty bypasses the direct-text gate
   when the element is genuinely (near-)empty, so blank data-grid cells (— / empty)
   are commentable. A page opts in via config (phone-map sets anchorEmpty:['td']);
   off by default, so LP pages are unaffected. Replaces the former hardcoded
   ANCHOR_CELLS / window.CREDO_REVIEW_ANCHOR_ALL core-gate flag. */
const ANCHOR_EMPTY = Array.isArray(CFG.anchorEmpty) ? CFG.anchorEmpty : [];
function hasDirectText(el){
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && child.textContent.trim().length >= 2) return true;
  }
  return false;
}
function isInSiteChrome(el){ return !!el.closest('nav, header[role="banner"], footer'); }

function pageSlug(){if(typeof CFG.pageKey==='function')return CFG.pageKey(window.location);let p=window.location.pathname.replace(/\/index\.html?$/,'');if(p===''||p==='/')return 'home';return p.replace(/^\/|\/$/g,'').replace(/\//g,'-')||'home';}
const SLUG = pageSlug();

/* Anchor counters persist across re-anchor passes (added 2026-06-24 with the
 * MutationObserver). Resetting per-call caused new step-2 form labels to
 * collide with already-issued step-1 label-N IDs once content swaps in. */
const ANCHOR_COUNTERS = {};

/* ───── Variant-scoped commenting (added 2026-06-24) ─────────────────────────
 * Goal: a comment on the hero IMAGE in the M·M mix should not appear when the
 * reviewer flips to W·W — but a comment on the hero HEADLINE applies to every
 * mix. Generalised so any future page-internal variation (mix, layout A/B,
 * copy A/B/C, etc.) can opt in.
 *
 * Contract:
 *   1. The page declares its dimensions in `window.CREDO_VARIANT_DIMENSIONS`,
 *      a map of `dimensionKey → () => currentValue` (e.g. {hero:()=>'m', who:()=>'w'}).
 *   2. Any element that varies along one or more dimensions carries
 *      `data-variant-scope="<dim1> <dim2> …"` (space-separated keys).
 *   3. When commenting on such an element, the widget tags the comment record's
 *      `page` field with `<pageSlug>#<dim>=<value>,…` for the dimensions it
 *      varies along. Untagged comments stay at bare `<pageSlug>`.
 *   4. When filtering comments on render, the widget shows a tagged comment
 *      only when every dimension/value in its page key matches the page's
 *      current dimension state.
 *
 * Untagged elements + untagged comments behave exactly as before. */
function _dims(){ return window.CREDO_VARIANT_DIMENSIONS || {}; }
function getVariantScope(elm){
  if(!elm||!elm.closest)return [];
  const carrier = elm.closest('[data-variant-scope]');
  if(!carrier) return [];
  return (carrier.getAttribute('data-variant-scope')||'').split(/\s+/).filter(Boolean);
}
function currentVariantSuffix(dimKeys){
  if(!dimKeys||!dimKeys.length) return '';
  const cfg = _dims();
  const parts = dimKeys.map(k=>{
    const fn = cfg[k];
    const v = (typeof fn === 'function') ? fn() : null;
    return (v==null) ? null : (k+'='+String(v));
  }).filter(Boolean);
  return parts.length ? ('#'+parts.join(',')) : '';
}
function effectivePage(elm){ return SLUG + currentVariantSuffix(getVariantScope(elm)); }
function pageMatches(commentPage){
  if(commentPage === SLUG) return true;
  if(typeof commentPage !== 'string') return false;
  if(!commentPage.startsWith(SLUG+'#')) return false;
  const dimsStr = commentPage.slice(SLUG.length+1);
  if(!dimsStr) return true;
  const cfg = _dims();
  for(const part of dimsStr.split(',')){
    const eq = part.indexOf('=');
    if(eq < 0) continue;
    const k = part.slice(0, eq);
    const v = part.slice(eq+1);
    const fn = cfg[k];
    if(typeof fn !== 'function') return false;     // unknown dimension → hide
    if(String(fn()) !== v) return false;            // mismatched value → hide
  }
  return true;
}

/* ───── Cross-LP slot-portable commenting (added 2026-06-30) ──────────────────
 * A comment left on a slot-tagged element (data-slot="hero.h1" etc.) can opt
 * to apply across many LPs. The composer asks the reviewer at write time
 * which pages it applies to and stores the choice on the record:
 *
 *   { slot: 'hero.h1', scope: 'all' }                  // every LP with hero.h1
 *   { slot: 'hero.h1', scope: ['attorney-…','stop-…'] } // explicit subset
 *   (no slot field)                                     // page-local (legacy)
 *
 * Filter logic: commentAppliesHere() shows untagged comments on their origin
 * page only (page === SLUG); shows slot-portable comments wherever the
 * current LP both has the slot AND is in the scope. The hub injects the LP
 * catalog via postMessage so the chooser can show counts + a picker. */
const LP_CATALOG = []; // populated by postMessage from the hub
window.addEventListener('message', e => {
  if(!e || !e.data || e.data.type !== 'credo:lp-catalog') return;
  if(!Array.isArray(e.data.catalog)) return;
  LP_CATALOG.length = 0;
  for(const lp of e.data.catalog) LP_CATALOG.push(lp);
  // refresh sidebar counts so "applies to N pages" badges land correct.
  if(typeof render === 'function') render();
});
function _slots(){ return (window.CREDO_SLOTS && Array.isArray(window.CREDO_SLOTS.declared)) ? window.CREDO_SLOTS.declared : []; }
function _broadcastPrefixes(){ return (window.CREDO_SLOTS && Array.isArray(window.CREDO_SLOTS.broadcastDefaultPrefixes)) ? window.CREDO_SLOTS.broadcastDefaultPrefixes : []; }
function hasSlot(slot){ return _slots().indexOf(slot) >= 0; }
function defaultScopeForSlot(slot){
  if(!slot) return 'single';
  const prefixes = _broadcastPrefixes();
  for(const p of prefixes){ if(slot.indexOf(p) === 0) return 'all'; }
  return 'single';
}
/* Live-page map (added 2026-09-22 with the Webflow audit): prototype key → the
 * slug it shipped as on enroll.credolegal.com. Keyed by the prototype filename
 * with the variant suffix stripped, so every variant of an LP resolves to the
 * same live page. Seven prototypes have no live page yet and simply get no chip.
 * Every comment row renders a "live ↗" link for the page it is being shown on —
 * so a slot-portable comment points at the live counterpart of whichever LP the
 * reviewer is looking at, not at the page it was written on. */
const LIVE_BASE = 'https://enroll.credolegal.com/';
const LIVE_MAP = {
  'attorney': 'debt-harassment-fdcpa-attorney',
  'cc-challenge': 'credit-card-debt-challenge',
  'cc-lawsuit-records': 'credit-card-debt-lawsuit-records',
  'cc-lawsuit-respond': 'credit-card-debt-lawsuit-respond',
  'cc-negotiation': 'credit-card-debt-negotiation',
  'cc-stop-calls': 'credit-card-debt-stop-calls',
  'cc-violations': 'credit-card-debt-violations',
  'garn-attorney': 'wage-garnishment-attorney',
  'garn-exemptions': 'wage-garnishment-exemptions',
  'garn-prevention': 'wage-garnishment-prevention',
  'lawsuit-attorney': 'debt-lawsuit-attorney',
  'lawsuit-fight-back': 'debt-lawsuit-fight-back',
  'lawsuit-options': 'debt-lawsuit-options',
  'lawsuit-proof': 'debt-lawsuit-proof',
  'lawsuit-respond': 'debt-lawsuit-respond-on-time',
  'lawsuit-summons': 'debt-lawsuit-summons-respond',
  'med-bills-errors': 'medical-debt-bills-errors',
  'med-credit-report': 'medical-debt-credit-report-removal',
  'med-fdcpa-rights': 'medical-debt-fdcpa-rights',
  'med-lawsuit-respond': 'medical-debt-lawsuit-respond',
  'one-attorney': 'multiple-collectors-one-attorney',
  'payday-harassment': 'payday-loan-debt-harassment',
  'payday-violations': 'payday-loan-debt-violations',
  'rights-verbatim': 'debt-harassment-fdcpa-rights',
  'stop-calls': 'debt-harassment-stop-calls',
  'violations': 'debt-harassment-violations'
};
function livePageUrl(){
  const file = (location.pathname.split('/').pop() || '').replace(/\.html?$/, '');
  const key = file.replace(/-locked-paired-(portrait|watercolor)(-noborders)?$/, '')
                  .replace(/-sticky-rail-(portrait|watercolor)(-noborders)?$/, '');
  const slug = LIVE_MAP[key] || null;
  return slug ? (LIVE_BASE + slug) : null;
}

function commentAppliesHere(c){
  if(!c) return false;
  // 1) legacy single-page (no slot): match the page filter as before.
  if(!c.slot) return pageMatches(c.page);
  // 2) slot-portable: this LP must actually have the slot…
  if(!hasSlot(c.slot)) return false;
  // 3) …and the current SLUG must be in the comment's scope.
  if(c.scope === 'all') return true;
  if(Array.isArray(c.scope)) return c.scope.indexOf(SLUG) >= 0;
  // No scope, just slot: treat as 'all' (defensive — shouldn't happen).
  return true;
}
function scopeCountText(slot, scope){
  if(scope === 'all'){
    // LP_CATALOG is only populated when the page is embedded in the hub; standalone
    // (opened directly, as reviewers usually do) it is empty — say "all pages"
    // rather than the misleading "all 1 page".
    const n = LP_CATALOG.length;
    return n ? ('all ' + n + ' pages with this slot') : 'all pages with this slot';
  }
  if(Array.isArray(scope)) return scope.length + ' selected page' + (scope.length === 1 ? '' : 's');
  return 'this page only';
}
function reviewer(){let n=store.get('credo_reviewer');if(!n){n=(window.prompt(L.namePrompt,'')||'Anonymous').trim()||'Anonymous';store.set('credo_reviewer',n);}return n;}

/* status normalize (reader shim for legacy boolean records) */
function statusOf(c){ const s=c.status; if(s==='resolved'||s==='applied'||s==='archived'||c.archived||c.applied)return 'resolved'; return 'pending'; }

/* ---- adapter ---- */
function localAdapter(){
  const KEY='credo_review_comments'; let cb=null;
  const read=()=>{try{return JSON.parse(store.get(KEY)||'{}')}catch(e){return {}}};
  const write=o=>store.set(KEY,JSON.stringify(o)); const ping=()=>cb&&cb(read());
  return { local:true,
    subscribe(fn){cb=fn;fn(read());window.addEventListener('storage',e=>{if(e.key===KEY)fn(read())});return()=>{cb=null}},
    create(rec){const o=read();const id='c'+Date.now()+Math.random().toString(36).slice(2,7);o[id]=rec;write(o);ping();return Promise.resolve(id)},
    update(id,patch){const o=read();o[id]=Object.assign({},o[id],patch);write(o);ping();return Promise.resolve()},
    remove(id){const o=read();delete o[id];write(o);ping();return Promise.resolve()} };
}
async function firebaseAdapter(){
  const A=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const D=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
  const app=(A.getApps&&A.getApps().length)?A.getApp():A.initializeApp(FB);
  const db=D.getDatabase(app); const root=D.ref(db,'comments');
  return { local:false,
    subscribe(fn){return D.onValue(root,s=>fn(s.val()||{}))},
    create(rec){const r=D.push(root);return D.set(r,rec).then(()=>r.key)},
    update(id,patch){return D.update(D.ref(db,'comments/'+id),patch)},
    remove(id){return D.remove(D.ref(db,'comments/'+id))} };
}

function el(t,c,h){const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e}
function esc(s){return (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function when(ts){const d=new Date(ts||Date.now());return d.toLocaleDateString()+' '+d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}

let SIDE,LIST,TABS,PILL,ADAPTER,ME,COMMENTS={},FILTER='open',curEl=null,curId=null,hideT=null;
let SELID=null,SELANCHOR=null; /* clicked comment: row id + its anchor (persist across re-renders) */
const TAB_OF={open:'pending',resolved:'resolved'};
let SCOPE='page'; /* sidebar list scope: 'page' (default — comments on this page only) | 'all' (every comment in the hub, grouped by page). Session-only; resets to 'page' each load. */
let FOCUS_ID=(function(){try{return new URLSearchParams(location.search).get('rwfocus')||null;}catch(e){return null;}})();
let FOCUS_TRIES=0; /* cross-page focus token (?rwfocus=<id>): spotlight this comment on arrival */

function buildChrome(){
  const ban=el('div','review-banner');
  ban.innerHTML='<span class="rw-title">'+esc(L.bannerTitle)+'</span>'+(ADAPTER.local?'<span class="rw-local">'+esc(L.localOnly)+'</span>':'')+'<span class="rw-spacer"></span><span class="rw-name">'+esc(ME)+'</span>';
  const exit=el('button',null,esc(L.exit)); exit.onclick=()=>{const u=new URL(location.href);u.searchParams.delete('review');location.href=u.toString()};
  ban.appendChild(exit); document.body.appendChild(ban);

  SIDE=el('aside','review-sidebar');
  SIDE.appendChild(el('h3',null,'<span>'+esc(L.sidebarTitle)+'</span>'));
  /* Scope toggle: this page (default) vs every comment in the hub. */
  const SCOPEBAR=el('div','rw-scopebar');
  [['page',L.scopePage||'This page'],['all',L.scopeAll||'All pages']].forEach(([k,lbl])=>{
    const b=el('button',k===SCOPE?'on':null,esc(lbl)); b.dataset.s=k;
    b.onclick=()=>{SCOPE=k;SCOPEBAR.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x.dataset.s===k));render();};
    SCOPEBAR.appendChild(b);
  });
  SIDE.appendChild(SCOPEBAR);
  TABS=el('div','review-tabs');
  [['open',L.tabOpen],['resolved',L.tabResolved]].forEach(([k,lbl])=>{
    const b=el('button',k===FILTER?'on':null,esc(lbl)+' <span class="rw-c">0</span>'); b.dataset.k=k;
    b.onclick=()=>{FILTER=k;TABS.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x.dataset.k===k));render();};
    TABS.appendChild(b);
  });
  SIDE.appendChild(TABS);
  LIST=el('div','review-list'); SIDE.appendChild(LIST); document.body.appendChild(SIDE);

  PILL=el('button','review-floating-pill',esc(L.add)); PILL.type='button'; PILL.setAttribute('data-review-skip','');
  document.body.appendChild(PILL);
  PILL.addEventListener('mouseenter',()=>clearTimeout(hideT));
  PILL.addEventListener('mouseleave',hidePillSoon);
  PILL.addEventListener('click',()=>{if(curId&&curEl)openComposer(curId,curEl)});
  /* Hover-time fallback (added 2026-06-24): if the hovered element is in a
   * freshly rendered region (e.g. the form overlay just appeared and the
   * MutationObserver re-anchor is queued for the next microtask), force an
   * anchor pass on the spot so the pill appears without the user having to
   * mouse out and back in. Cheap because anchorPass skips already-anchored
   * elements via the data-comment-id check. */
  document.addEventListener('mouseover',e=>{
    if(e.target.closest(CHROME_SEL))return;
    let a=e.target.closest('[data-comment-id]');
    if(!a){
      const tag=(e.target.tagName||'').toLowerCase();
      const looksAnchorable = tag && !NEVER_ANCHOR.has(tag) && hasDirectText(e.target) && !isInSiteChrome(e.target);
      const inUnanchoredImg = !!(e.target.closest && e.target.closest('img,picture,.hero-figure,.body-fig,figure'));
      if(looksAnchorable || inUnanchoredImg){
        anchorPass();
        anchorImagePass();
        a = e.target.closest('[data-comment-id]');
      }
    }
    if(a){clearTimeout(hideT);placePill(a);}
  });
  document.addEventListener('mouseout',e=>{const to=e.relatedTarget;if(to&&(to===PILL||(to.closest&&to.closest('[data-comment-id]'))))return;hidePillSoon();});
  window.addEventListener('scroll',()=>{if(curEl&&PILL.style.display==='block')placePill(curEl)},true);
}
function placePill(elm){curEl=elm;curId=elm.getAttribute('data-comment-id');PILL.style.display='block';const r=elm.getBoundingClientRect();PILL.style.top=Math.max(52,Math.min(r.top+6,window.innerHeight-34))+'px';PILL.style.left=Math.max(6,r.right-PILL.offsetWidth-8)+'px';}
function hidePillSoon(){hideT=setTimeout(()=>{PILL.style.display='none';curEl=null;curId=null;},140);}

function anchorPass(){
  /* commentable-everything 'direct-text' mode: iterate ALL elements; anchor
   * any element whose own text-node children include ≥2 trimmed chars, except
   * those in NEVER_ANCHOR. Counters live module-scope (ANCHOR_COUNTERS) so
   * re-runs after DOM mutations don't reissue duplicate IDs for new content. */
  document.querySelectorAll('*').forEach(elm=>{
    if(elm.closest(CHROME_SEL))return;             // widget chrome
    if(elm.hasAttribute('data-comment-id'))return;
    if(elm.hasAttribute('data-review-skip'))return;
    const tag=elm.tagName.toLowerCase();
    if(NEVER_ANCHOR.has(tag))return;
    if(!hasDirectText(elm) && !(ANCHOR_EMPTY.includes(tag) && (elm.textContent||'').trim().length<=1))return;   // anchorEmpty: listed tags anchorable even when (near-)empty
    if(isInSiteChrome(elm))return;                 // chromeAnchored opt-in not enabled
    ANCHOR_COUNTERS[tag]=(ANCHOR_COUNTERS[tag]||0)+1;
    elm.setAttribute('data-comment-id',SLUG+'-'+tag+'-'+ANCHOR_COUNTERS[tag]);
  });
}

/* Image anchor pass (added 2026-06-24). Images themselves are in NEVER_ANCHOR
 * and their wrapping <picture> is too, so the text pass skips both. Walk
 * <img> elements and anchor the nearest meaningful container instead — the
 * .hero-figure / .body-fig / <figure> / <picture> / fallback parent. The pill
 * already resolves the deepest anchor via closest('[data-comment-id]'), so
 * hovering an image lands on its container's anchor. */
function anchorImagePass(){
  document.querySelectorAll('img').forEach(img=>{
    if(img.closest(CHROME_SEL))return;
    if(isInSiteChrome(img))return;
    if(img.closest('[data-review-skip]'))return;
    const target = img.closest('.hero-figure')
                 || img.closest('.body-fig')
                 || img.closest('figure')
                 || img.closest('picture')
                 || img.parentElement;
    if(!target) return;
    if(target.hasAttribute('data-comment-id')) return;
    let prefix = 'img';
    if(target.classList && target.classList.contains('hero-figure')) prefix = 'hero-image';
    else if(target.classList && target.classList.contains('body-fig')) prefix = 'body-image';
    ANCHOR_COUNTERS[prefix] = (ANCHOR_COUNTERS[prefix]||0) + 1;
    target.setAttribute('data-comment-id', SLUG+'-'+prefix+'-'+ANCHOR_COUNTERS[prefix]);
  });
}

function modal(title,ctx,initText,initRepl,onSave,opts){
  opts = opts || {};
  const ov=el('div','review-modal-overlay');const m=el('div','review-modal');
  m.innerHTML='<h4>'+esc(title)+'</h4><div class="rw-ctx">'+esc(ctx)+'</div>';
  const ta=el('textarea');ta.placeholder=L.placeholder;ta.value=initText||'';
  const tr=el('textarea');tr.placeholder=L.replacementPlaceholder;tr.value=initRepl||'';tr.style.minHeight='44px';
  m.appendChild(ta);m.appendChild(tr);
  /* Scope chooser (added 2026-06-30 for cross-LP commenting). Only shown when
   * opts.slot is provided (anchored element had data-slot). Three radios; the
   * "Specific pages…" choice expands a checkbox list. State held inside the
   * modal; passed to onSave as a third arg. */
  let scopeChoice = opts.defaultScope || 'single';
  let pickedPages = [];
  if(opts.slot){
    const sc = el('div','rw-scope');
    const slotPills = opts.slot ? '<span class="rw-scope-slot">slot · '+esc(opts.slot)+'</span>' : '';
    sc.innerHTML = '<div class="rw-scope-head">Apply this comment to '+slotPills+'</div>';
    const rGroup = el('div','rw-scope-radios');
    function radio(value, label, hint){
      const id = 'rw-scope-'+value;
      const r = '<label class="rw-scope-opt"><input type="radio" name="rw-scope" value="'+value+'"' + (value===scopeChoice?' checked':'') + '/> <span class="rw-scope-lbl">'+esc(label)+'</span>' + (hint?' <span class="rw-scope-hint">'+esc(hint)+'</span>':'') + '</label>';
      return r;
    }
    const otherCount = LP_CATALOG.length || 0;
    rGroup.innerHTML =
      radio('single', 'This page only', '(' + SLUG + ')') +
      radio('all',    'All pages that have this slot', otherCount ? '(' + otherCount + ' pages)' : '') +
      radio('subset', 'Specific pages…',  otherCount ? '(' + otherCount + ' available)' : '(catalog unavailable)');
    sc.appendChild(rGroup);
    const picker = el('div','rw-scope-picker');
    picker.style.display = 'none';
    /* Group catalog by cluster and render checkboxes; current page is checked + locked. */
    if(LP_CATALOG.length){
      const byCluster = {};
      LP_CATALOG.forEach(lp => { (byCluster[lp.cluster] = byCluster[lp.cluster] || []).push(lp); });
      let html = '';
      Object.keys(byCluster).forEach(cluster => {
        html += '<div class="rw-scope-cluster">'+esc(cluster)+'</div>';
        byCluster[cluster].forEach(lp => {
          const isSelf = lp.slug === SLUG;
          html += '<label class="rw-scope-page"><input type="checkbox" value="'+esc(lp.slug)+'"' + (isSelf?' checked disabled':'') + '/> '+esc(lp.name)+' <span class="rw-scope-page-slug">'+esc(lp.slug)+'</span></label>';
        });
      });
      picker.innerHTML = html;
    } else {
      picker.innerHTML = '<div class="rw-scope-empty">No catalog received (open via the hub for cross-LP scope).</div>';
    }
    sc.appendChild(picker);
    m.appendChild(sc);
    rGroup.addEventListener('change', e => {
      if(e.target && e.target.name === 'rw-scope'){
        scopeChoice = e.target.value;
        picker.style.display = (scopeChoice === 'subset') ? 'block' : 'none';
      }
    });
    if(scopeChoice === 'subset') picker.style.display = 'block';
    picker.addEventListener('change', () => {
      pickedPages = Array.from(picker.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
    });
  }
  const acts=el('div','rw-modal-acts');
  const cancel=el('button','rw-cancel',esc(L.cancel));cancel.onclick=()=>ov.remove();
  const save=el('button','rw-save',esc(L.save));
  save.onclick=()=>{
    const t=ta.value.trim(),r=tr.value.trim();
    if(!t&&!r)return;
    let resolvedScope = null;
    if(opts.slot){
      if(scopeChoice === 'all') resolvedScope = 'all';
      else if(scopeChoice === 'subset'){
        const subset = pickedPages.length ? pickedPages.slice() : [SLUG];
        if(subset.indexOf(SLUG) < 0) subset.push(SLUG);
        resolvedScope = subset;
      } // 'single' → leave resolvedScope null (page-local)
    }
    onSave(t, r, resolvedScope);
    ov.remove();
  };
  acts.appendChild(cancel);acts.appendChild(save);m.appendChild(acts);ov.appendChild(m);
  ov.onclick=e=>{if(e.target===ov)ov.remove()};document.body.appendChild(ov);ta.focus();
}
function openComposer(anchor,elm){
  const note=elm.getAttribute('data-variant-note');
  const prev=note||(elm.textContent||'').replace(/\s+/g,' ').trim().slice(0,80)||(elm.querySelector('img,video')?'[creative]':'');
  /* effectivePage tags the comment with the active variant state for any
   * dimension the anchored element varies along (data-variant-scope). For an
   * untagged element, effectivePage === SLUG and behaviour is unchanged. */
  const pageKey = effectivePage(elm);
  /* Slot lookup (added 2026-06-30): walk up to the nearest [data-slot]. If
   * present, the composer offers cross-LP scope. */
  const slotCarrier = elm.closest && elm.closest('[data-slot]');
  const slot = slotCarrier ? slotCarrier.getAttribute('data-slot') : null;
  const defaultScope = defaultScopeForSlot(slot);
  modal('Add comment', anchor, '', '', (text, repl, scope) => {
    const rec = {
      comment: text, replacement: repl || null,
      anchor: anchor, page: pageKey,
      author: ME, status: 'pending', timestamp: Date.now(),
      text_preview: prev, url: location.href, user_agent: navigator.userAgent
    };
    if(slot){
      rec.slot = slot;
      // 'single' (default) leaves scope undefined → behaves as page-local.
      if(scope) rec.scope = scope;
    }
    ADAPTER.create(rec);
  }, { slot: slot, defaultScope: defaultScope });
}

function actBtn(label,cls,fn){const b=el('button',cls,esc(label));b.onclick=ev=>{ev.stopPropagation();fn()};return b;}
function render(){
  /* Filter cascade (oldest → newest behaviour):
   *  1. commentAppliesHere() handles slot-portable comments (cross-LP scope).
   *  2. Falls through to pageMatches() for legacy single-page records.
   * Untagged comments behave exactly as before; slot-portable comments show
   * on every LP whose CREDO_SLOTS.declared includes the slot AND whose SLUG
   * is in the comment's scope. */
  /* Sidebar list scope (2026-07-21): SCOPE 'all' lists every comment across the
   * whole hub (grouped by page, cross-page click jumps); 'page' (default) lists
   * only comments on the current page. `listSource` drives the list + tab counts.
   * On-page decoration (outlines / status dots) can only touch elements that
   * actually live here, so it always uses the page-scoped subset `pageComments`. */
  const all=Object.entries(COMMENTS).filter(([id,c])=> c && (typeof CFG.pageFilter!=='function' || CFG.pageFilter(String(c.page||''))));
  const pageComments=all.filter(([id,c])=> commentAppliesHere(c));
  const listSource=SCOPE==='all'?all:pageComments;
  const counts={pending:0,resolved:0};
  listSource.forEach(([id,c])=>{counts[statusOf(c)]=(counts[statusOf(c)]||0)+1});
  TABS.querySelectorAll('button').forEach(b=>{b.querySelector('.rw-c').textContent=counts[TAB_OF[b.dataset.k]]||0;});
  // outlines — when a comment has c.slot, attach to elements with that slot
  // on the current page (the slot is stable across LPs; the anchor isn't).
  document.querySelectorAll('.has-comment,.has-applied-comment').forEach(e=>e.classList.remove('has-comment','has-applied-comment'));
  document.querySelectorAll('.rw-dots').forEach(e=>e.remove());
  /* Group every applying comment by its target selector, tallying active (open)
   * vs resolved. Each commented component then gets a full outline (red while any
   * comment is open, green when only resolved remain) and a vertical stack of dots
   * just outside its right border — one red dot per active comment, one green per
   * resolved. */
  const byTarget={};
  pageComments.forEach(([id,c])=>{
    const st=statusOf(c);
    const sel = c.slot
      ? '[data-slot="'+(window.CSS&&CSS.escape?CSS.escape(c.slot):c.slot)+'"]'
      : '[data-comment-id="'+(window.CSS&&CSS.escape?CSS.escape(c.anchor):c.anchor)+'"]';
    const r=byTarget[sel]||(byTarget[sel]={active:0,resolved:0});
    if(st==='resolved')r.resolved++;else r.active++;
  });
  Object.keys(byTarget).forEach(sel=>{
    const r=byTarget[sel];
    document.querySelectorAll(sel).forEach(a=>{
      a.classList.add(r.active>0?'has-comment':'has-applied-comment');
      const d=document.createElement('span');d.className='rw-dots';d.setAttribute('aria-hidden','true');
      let h='';for(let i=0;i<r.active;i++)h+='<i class="rw-dot rw-dot-active"></i>';for(let i=0;i<r.resolved;i++)h+='<i class="rw-dot rw-dot-resolved"></i>';
      d.innerHTML=h;a.appendChild(d);
    });
  });
  // list for current tab
  const want=TAB_OF[FILTER];
  const rows=readingOrder(listSource.filter(([id,c])=>statusOf(c)===want));
  LIST.innerHTML='';
  if(!rows.length){LIST.appendChild(el('div','review-empty',esc(L.empty)));return}
  /* Group by page (the origin slug, ignoring any #variant suffix). The current
   * page floats to the top; the rest sort by their friendly label. Each group
   * gets a header so the reviewer always knows where a comment lives. */
  /* Group by origin page ONLY in hub-wide scope. Page scope lists nothing but
   * comments that apply to the page in front of you, so a header saying which
   * LP a slot comment was first written on adds nothing and — because the
   * current page's group floats to the top — it would break the reading order
   * the list is now sorted in. Flat list there, groups (each internally in
   * reading order) in 'all'. */
  const grouped = SCOPE==='all';
  const groups={};
  let order;
  if(grouped){
    rows.forEach(entry=>{const pg=String(entry[1].page||'home').split('#')[0];(groups[pg]||(groups[pg]=[])).push(entry);});
    order=Object.keys(groups).sort((a,b)=>{
      if(a===SLUG)return -1; if(b===SLUG)return 1;
      return pageLabel(a).localeCompare(pageLabel(b));
    });
  } else { groups['']=rows; order=['']; }
  order.forEach(pg=>{
    if(grouped){
      const hdr=el('div','rw-group'+(pg===SLUG?' rw-group-here':''));
      hdr.innerHTML='<span class="rw-group-name">'+esc(pg===SLUG?(L.thisPage||'This page'):pageLabel(pg))+'</span><span class="rw-group-count">'+groups[pg].length+'</span>';
      LIST.appendChild(hdr);
    }
    groups[pg].forEach(([id,c])=>{
    const st=statusOf(c);
    const here=commentAppliesHere(c);
    const row=el('div','review-row'+(id===SELID?' rw-selected':'')+(here?'':' rw-offpage'));
    const blabel=st==='resolved'?'resolved':'open';
    /* Scope badge (added 2026-06-30): if the comment is slot-portable, show
     * a small green chip stating which pages it applies to, so the reviewer
     * scanning the sidebar can tell page-local from brand-wide at a glance. */
    let scopeBadge = '';
    if(c.slot){
      if(c.scope === 'all'){
        // Standalone (no hub catalog) we cannot count the LPs — say "all pages"
        // rather than "applies to 1 page", which read as page-local.
        const n = LP_CATALOG.length;
        const label = n ? ('applies to all ' + n + ' pages') : 'applies to all pages';
        scopeBadge = ' <span class="rw-scope-badge" title="'+esc(c.slot)+'">'+label+'</span>';
      } else {
        const n = Array.isArray(c.scope) ? c.scope.length : 1;
        scopeBadge = ' <span class="rw-scope-badge" title="'+esc(c.slot)+'">applies to '+n+' page'+(n===1?'':'s')+'</span>';
      }
    }
    const jumpChip = here ? '' : ' <span class="rw-jump" title="'+esc('Opens '+pageLabel(String(c.page||'home').split('#')[0]))+'">opens ↗</span>';
    /* Live-page chip (2026-09-22): links to the page this prototype shipped as.
     * Rendered per row so slot-portable comments resolve to the live counterpart
     * of the LP currently open, which is what a reviewer needs to compare. */
    const liveUrl = livePageUrl();
    const liveChip = liveUrl
      ? ' <a class="rw-live" href="'+esc(liveUrl)+'" target="_blank" rel="noopener" title="'+esc('Open the live page: '+liveUrl)+'">live ↗</a>'
      : ' <span class="rw-live rw-live-none" title="This prototype has no live page yet">not live</span>';
    row.innerHTML='<div class="rw-meta"><b>'+esc(c.author||'Anonymous')+'</b><span class="rw-badge rw-'+st+'">'+blabel+'</span>'+scopeBadge+liveChip+jumpChip+'<span>'+when(c.timestamp)+(c.edited_at?' · edited':'')+'</span></div>'+
      '<div class="rw-body">'+esc(c.comment||'')+'</div>'+
      (c.replacement?'<div class="rw-repl">↳ '+esc(c.replacement)+'</div>':'')+
      (st==='resolved'&&c.resolution?'<div class="rw-resolution">✓ '+esc(c.resolution)+'</div>':'')+
      '<div class="rw-anchor">'+esc(c.slot ? ('slot · '+c.slot) : c.anchor)+'</div>';
    const acts=el('div','rw-acts');
    if(st==='pending'){
      acts.appendChild(actBtn(L.edit,'edit-btn',()=>modal('Edit comment',c.anchor,c.comment||'',c.replacement||'',(t,r)=>ADAPTER.update(id,{comment:t,replacement:r||null,edited_at:Date.now()}))));
      acts.appendChild(actBtn(L.resolve,'resolve-btn',()=>{const note=(window.prompt(L.resolvePrompt,'')||'').trim();ADAPTER.update(id,{status:'resolved',resolution:note||('Resolved · '+ME),resolved_at:Date.now(),resolved_by:ME});}));
    } else {
      acts.appendChild(actBtn(L.reopen,'restore-btn',()=>ADAPTER.update(id,{status:'pending',resolution:null})));
    }
    acts.appendChild(actBtn(L.del,'delete-btn',()=>{if(confirm('Delete this comment?'))ADAPTER.remove(id)}));
    row.appendChild(acts);
    /* Same page → spotlight in place. Other page → navigate to its page (carrying
     * the review session) with a focus token the target page consumes on load. */
    row.onclick = here
      ? (()=>{SELID=id;spotlight(c);})
      : (()=>{location.href=commentHref(c,id);});
    LIST.appendChild(row);
    });
  });
  applyActive();
}
/* persistent strong highlight on the currently-selected comment's element(s).
 * querySelectorAll because a campaign-wide headline anchor (hl-{i}) can match
 * several ads at once. */
/* An anchor can land on an element the variant hides (e.g. the hero eyebrow is
 * display:none under [data-labels="plain"]). Such an element cannot be scrolled
 * to and shows no outline, so the click looks broken. Climb to the nearest
 * ancestor that actually occupies space and use that instead. */
function visibleTarget(el){
  for(let e=el; e && e.getBoundingClientRect; e=e.parentElement){
    const r=e.getBoundingClientRect();
    if(r.width||r.height) return e;
  }
  return null;
}
function commentTarget(c){
  if(!c) return null;
  const sel = c.slot
    ? '[data-slot="'+(window.CSS&&CSS.escape?CSS.escape(c.slot):c.slot)+'"]'
    : '[data-comment-id="'+(window.CSS&&CSS.escape?CSS.escape(c.anchor):c.anchor)+'"]';
  return visibleTarget(document.querySelector(sel));
}
/* Sidebar order (2026-09-22): reading order of the components themselves —
 * top row left→right, then the next row, down to the bottom. Comments whose
 * element isn't on this page (another LP's, in the hub's "all" scope) keep the
 * old oldest-first order and sit after the placed ones inside their own group.
 *
 * Rows are found by vertical overlap rather than a fixed tolerance: an element
 * joins the current row while it still starts above that row's running bottom,
 * and the bottom shrinks to the shortest member so one tall element (a hero
 * image beside a stack of cards) can't swallow everything below it. */
function readingOrder(entries){
  const pos=new Map();
  entries.forEach(e=>{
    const t=commentTarget(e[1]);
    if(!t) return;
    const r=t.getBoundingClientRect();
    if(!r.width && !r.height) return;
    pos.set(e[0],{top:r.top+window.pageYOffset,bottom:r.bottom+window.pageYOffset,left:r.left+window.pageXOffset});
  });
  const ts=e=>e[1].timestamp||0;
  const placed=entries.filter(e=>pos.has(e[0])).sort((a,b)=>pos.get(a[0]).top-pos.get(b[0]).top||ts(a)-ts(b));
  const band=new Map();
  let row=0, bottom=-Infinity;
  placed.forEach(e=>{
    const p=pos.get(e[0]);
    if(p.top>=bottom){ row++; bottom=p.bottom; }
    else bottom=Math.min(bottom,p.bottom);
    band.set(e[0],row);
  });
  placed.sort((a,b)=>
    band.get(a[0])-band.get(b[0])
    || pos.get(a[0]).left-pos.get(b[0]).left
    || pos.get(a[0]).top-pos.get(b[0]).top
    || ts(a)-ts(b));
  return placed.concat(entries.filter(e=>!pos.has(e[0])).sort((a,b)=>ts(a)-ts(b)));
}
function applyActive(){
  document.querySelectorAll('.rw-active-anchor').forEach(e=>e.classList.remove('rw-active-anchor'));
  if(!SELANCHOR)return;
  /* SELANCHOR is either a page anchor (…-h1-1) or, for a cross-LP comment, a
   * slot name (hero.h1). Match both: before this the slot case matched nothing,
   * so clicking a cross-page comment scrolled to the element but never outlined
   * it. querySelectorAll because one anchor can legitimately match several
   * elements (a headline repeated per variant). */
  const v = (window.CSS&&CSS.escape) ? CSS.escape(SELANCHOR) : SELANCHOR;
  document.querySelectorAll('[data-comment-id="'+v+'"],[data-slot="'+v+'"]')
    .forEach(a=>{const t=visibleTarget(a); if(t) t.classList.add('rw-active-anchor');});
}
function spotlight(anchorOrComment){
  /* Accepts either a bare anchor string (legacy) or a comment record (so we
   * can prefer slot-based lookup for cross-LP comments). Falls back to the
   * anchor when no slot is available. */
  let anchor, slot;
  if(typeof anchorOrComment === 'string'){ anchor = anchorOrComment; }
  else if(anchorOrComment){ anchor = anchorOrComment.anchor; slot = anchorOrComment.slot; }
  SELANCHOR = slot || anchor;
  let a=null;
  /* the prototype exposes __rwReveal: it flips the right dropdown/tab so the
   * commented variant is on screen, then returns that zone's element. */
  if(window.__rwReveal){try{a=window.__rwReveal(SELANCHOR)}catch(e){}}
  if(!a && slot) a = document.querySelector('[data-slot="'+(window.CSS&&CSS.escape?CSS.escape(slot):slot)+'"]');
  if(!a) a = document.querySelector('[data-comment-id="'+(window.CSS&&CSS.escape?CSS.escape(anchor):anchor)+'"]');
  applyActive();
  if(!a)return null;
  a = visibleTarget(a) || a;
  a.scrollIntoView({behavior:'smooth',block:'center'});
  a.classList.remove('rw-spot');void a.offsetWidth;a.classList.add('rw-spot');setTimeout(()=>a.classList.remove('rw-spot'),1200);
  return a;
}
/* Friendly page label for a slug: the hub catalog carries {slug,name}; fall back
 * to the slug itself when the catalog hasn't been injected (postMessage) yet. */
function pageLabel(slug){
  if(!slug) return 'home';
  for(const lp of LP_CATALOG){ if(lp && lp.slug===slug) return lp.name||slug; }
  return slug;
}
/* URL to open a comment's page with the review session carried and a focus token
 * the target page consumes on load. Prefer the comment's stored full url (most
 * reliable); fall back to `<slug>.html` for legacy records without one. */
function commentHref(c,id){
  let path='';
  try{ if(c.url) path=new URL(c.url, location.href).pathname; }catch(e){}
  if(!path){ const pg=String(c.page||'home').split('#')[0]; path=(pg==='home'?'index':pg)+'.html'; }
  const u=new URL(path, location.href);
  u.searchParams.set('review','1');
  u.searchParams.set('rwfocus', id);
  return u.toString();
}
/* Cross-page focus handoff: when a page loads carrying ?rwfocus=<id>, spotlight
 * that comment once its record is in memory. Retries a few times so a
 * late-anchored target (MutationObserver-driven DOM) still resolves, then strips
 * the token so a refresh / back-nav doesn't re-fire it. */
function clearFocusToken(){try{const u=new URL(location.href);u.searchParams.delete('rwfocus');history.replaceState(null,'',u.toString());}catch(e){}}
function maybeConsumeFocus(){
  if(!FOCUS_ID)return;
  const id=FOCUS_ID,c=COMMENTS[id];
  if(!c){ if(++FOCUS_TRIES>20){FOCUS_ID=null;clearFocusToken();} return; } // wait for data; give up after ~a few seconds
  FOCUS_ID=null;                                                          // consume once
  SELID=id;
  const wantKey=statusOf(c)==='resolved'?'resolved':'open';               // ensure the comment's tab is the active one
  if(FILTER!==wantKey){FILTER=wantKey;if(TABS)TABS.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x.dataset.k===wantKey));}
  render();                                                               // reflect tab switch + row selection
  let tries=0;
  (function tryspot(){ const a=spotlight(c); if(!a && ++tries<6){setTimeout(tryspot,250);return;} clearFocusToken(); })();
}

(async function init(){
  ME=reviewer();
  try{ADAPTER=FB_OK?await firebaseAdapter():localAdapter();}catch(e){console.warn('[review] firebase init failed, using local',e);ADAPTER=localAdapter();}
  buildChrome();
  anchorPass();
  anchorImagePass();
  /* MutationObserver (added 2026-06-24): re-anchor + re-render whenever new
   * non-chrome DOM appears. Drives 'comment on every step of the form': each
   * step's labels/buttons get anchored as soon as the step DOM renders.
   *
   * Implementation notes:
   *   - We look at addedNodes specifically (not just any mutation target).
   *     For renderOverlay()-style flows (removeChild + appendChild on body),
   *     only the appended overlay's subtree matters — anchorPass auto-skips
   *     anchored elements anyway.
   *   - Re-anchor is scheduled on a microtask (queueMicrotask), not setTimeout,
   *     so it runs before the next user interaction tick. An 80ms debounce
   *     used to race with the user moving the mouse into the overlay before
   *     anchors existed; the pill would no-op once and the user would think
   *     'commenting on step 2 doesn't work'.
   *   - Watching childList+subtree only — render()'s class flips and
   *     attribute writes are not observed, so we don't loop. The ONE childList
   *     mutation render() makes is appending the `.rw-dots` status stacks
   *     (comment-status-indicators); those are skipped below so they don't
   *     re-trigger render() (which would be an infinite loop). As a safety net
   *     we still skip nodes inside widget chrome below.
   */
  let _scheduled = false;
  function _reanchorSoon(){
    if(_scheduled) return;
    _scheduled = true;
    queueMicrotask(()=>{
      _scheduled = false;
      anchorPass();
      anchorImagePass();
      render();
    });
  }
  const mo = new MutationObserver(muts=>{
    for(const m of muts){
      if(!m.addedNodes || !m.addedNodes.length) continue;
      for(const node of m.addedNodes){
        if(!node || node.nodeType !== 1) continue;
        if(node.closest && node.closest(CHROME_SEL)) continue;
        if(node.classList && node.classList.contains('rw-dots')) continue;   // our own status dots — not content to re-anchor (else render()'s append loops)
        _reanchorSoon();
        return;
      }
    }
  });
  mo.observe(document.body, { childList:true, subtree:true });
  /* variant-aware anchors (credo variation): the prototype rewrites a zone's
   * data-comment-id when its headline/message/creative selection changes, then
   * calls this hook so the highlight pass re-matches comments to the now-current
   * variant. Per-dimension scoping falls out of the existing match-by-anchor. */
  window.__rwRefresh=render;
  ADAPTER.subscribe(data=>{COMMENTS=data||{};render();maybeConsumeFocus();});
})();
})();  /* end C6 js-isolation IIFE — see file head */
