/* Proposed top-of-page UX for the prototype pages (operator 29 Oct 2026, after reviewing start.credolegal.com on a phone:
 * "the header is sticky, there is no floating call button, and we keep the chat icon. In the header, we show Call Now
 * during operating hours and Free Review out of operating hours.")
 *  - the header stays at the top while the page scrolls (all widths), on a solid background (operator 30 Oct);
 *  - the floating "Is your debt situation becoming urgent? / Call now" bar is removed (it covered the form's Continue);
 *  - a chat icon bottom right stands in for the live site's Tidio chat (Tidio does not load on the prototype);
 *  - form steps 2 and 3 have no big title (the rule start.credolegal.com uses) and no "Step 2 of 3" line in the popup header;
 *    step 3's send button reads Submit (operator 30 Oct, was Get a free case evaluation), on one row with Back at every width;
 *  - the debt types dropdown on step 2 has a Done button, active from the first ticked box, that closes it;
 *  - the desktop header button (#btnCTA) always reads Free Review (the phone number is beside it);
 *  - the mobile header button (staging's .mobile-call, the phone number) reads "Call Now" and calls the page's number in
 *    operating hours, and "Free Review" and scrolls to the form outside them. Hours are staging's own rule: Monday to
 *    Friday 9 am to 9 pm ET, Saturday 9 am to 5 pm ET, Sunday closed.
 *  - phones (operator 29 Oct: "correct the current design without significant changes so that the entire form fits into
 *    the first fold … Do not reduce font size below w3 recommended threshold"): tighter vertical spacing in the hero and the
 *    form's first step only, so the whole form (to Continue) shows above the fold in a phone browser (390 × 664: an iPhone
 *    with Safari's bars). No font size changes.
 *  - phones (operator 30 Oct: "Let's remove the hero image from mobile"): no hero photo below 768 px, so no hero switcher
 *    there either; the page goes from the form straight to the next section.
 * Added by build-microsites.mjs to every mirrored page, so the new pages built in the hub from a mirror carry it too.
 * ?ux=staging shows the page exactly as staging has it (the mirror checks load it that way); ?hours=open|closed previews
 * either header state. A Work hours switch (operator 30 Oct) overrides the clock, remembered in this browser: Off also hides
 * the phone calls to action below the form (Or call under the form and in the closing section, the footer's New clients
 * row); the footer's Existing clients line stays. The hub drives it through window.CREDO_UX.hours(on).
 * A page opened on its own (not in a hub preview) also gets a Desktop / Mobile switch (operator 29 Oct: "When I open a page
 * from landing pages or microsites in a new tab, aside from the hero images switcher i want the desktop and mobile switcher
 * as well"): Mobile shows the same page in a 390 px phone frame. */
(function () {
  var framed = false; try { framed = window.self !== window.top; } catch (e) { framed = true; }
  if (framed) return;   /* the hub's previews and the phone frame below have their own view */
  var KEY = 'credo-view', W = 390, H = 844, wrap = null, bar;
  function frameView() {
    if (wrap) return; var f = document.createElement('iframe'); f.src = location.href; f.title = 'This page on a phone, ' + W + ' px wide';
    f.setAttribute('data-hero-ctl', ''); f.setAttribute('data-ux-frame', '');
    wrap = document.createElement('div'); wrap.setAttribute('data-ux-view', '');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:2147482000;background:#e6e9ee;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:16px;box-sizing:border-box';
    var h = Math.min(H, window.innerHeight - 90);
    f.style.cssText = 'width:' + W + 'px;height:' + h + 'px;border:0;border-radius:18px;background:#fff;box-shadow:0 10px 36px rgba(0,0,0,.22)';
    var cap = document.createElement('div'); cap.style.cssText = 'font:600 12px/1 system-ui,-apple-system,sans-serif;color:#5b6470'; cap.textContent = 'Phone, ' + W + ' × ' + h + ' px';
    wrap.appendChild(f); wrap.appendChild(cap); document.body.appendChild(wrap); document.documentElement.style.overflow = 'hidden';
  }
  function show(mode) {
    if (mode === 'mobile') frameView(); else if (wrap) { wrap.remove(); wrap = null; document.documentElement.style.overflow = ''; }
    document.documentElement.setAttribute('data-view', mode);   /* the rule in start(): the framed page has its own chat, and phones have no hero image */
    [].forEach.call(bar.querySelectorAll('button[data-v]'), function (b) { var on = b.getAttribute('data-v') === mode; b.setAttribute('aria-pressed', String(on)); b.style.background = on ? '#c92028' : 'transparent'; });
    try { localStorage.setItem(KEY, mode); } catch (e) {}
  }
  function start() {
    var st = document.createElement('style');
    st.textContent = 'html[data-view="mobile"] body>[data-ux-chat],html[data-view="mobile"] body>[data-hero-switch]{display:none!important}@media (max-width:767px){[data-view-switch]{display:none!important}}';
    document.head.appendChild(st);
    bar = document.createElement('div'); bar.setAttribute('data-view-switch', ''); bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'View');
    bar.style.cssText = 'position:fixed;left:12px;bottom:58px;z-index:2147483001;display:flex;align-items:center;gap:4px;padding:6px 8px;background:rgba(17,20,24,.88);color:#fff;border-radius:999px;font:600 12px/1 system-ui,-apple-system,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25)';
    bar.innerHTML = '<span style="padding:0 6px 0 4px;opacity:.8">View</span>' + [['desktop', 'Desktop'], ['mobile', 'Mobile']].map(function (v) {
      return '<button type="button" data-v="' + v[0] + '" style="border:0;border-radius:999px;padding:6px 10px;font:inherit;color:#fff;cursor:pointer">' + v[1] + '</button>'; }).join('');
    var UX = window.CREDO_UX;
    if (UX) bar.insertAdjacentHTML('beforeend', '<span style="padding:0 6px 0 10px;opacity:.8">Work hours</span>' + [['1', 'On'], ['0', 'Off']].map(function (v) {
      return '<button type="button" data-h="' + v[0] + '" style="border:0;border-radius:999px;padding:6px 10px;font:inherit;color:#fff;cursor:pointer">' + v[1] + '</button>'; }).join(''));
    var markHours = function (on) { [].forEach.call(bar.querySelectorAll('button[data-h]'), function (b) { var v = b.getAttribute('data-h') === (on ? '1' : '0'); b.setAttribute('aria-pressed', String(v)); b.style.background = v ? '#c92028' : 'transparent'; }); };
    bar.addEventListener('click', function (e) { var b = e.target.closest('button[data-v]'); if (b) show(b.getAttribute('data-v'));
      var h = e.target.closest('button[data-h]'); if (h && UX) { var on = h.getAttribute('data-h') === '1'; UX.hours(on); markHours(on); if (wrap) try { wrap.querySelector('iframe').contentWindow.CREDO_UX.hours(on); } catch (x) {} } });
    if (UX) markHours(UX.isOn());
    document.body.appendChild(bar);
    var v = new URLSearchParams(location.search).get('view'); try { v = v || localStorage.getItem(KEY); } catch (e) {}
    show(v === 'mobile' ? 'mobile' : 'desktop');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
(function () {
  var q = new URLSearchParams(location.search);
  if (q.get('ux') === 'staging') return;
  document.documentElement.setAttribute('data-ux', 'proposed');

  var HOURS_KEY = 'credo-hours', FORCE = null;
  function openNow() {
    if (FORCE !== null) return FORCE;
    var f = q.get('hours'); if (f === 'open') return true; if (f === 'closed') return false;
    try { var st = localStorage.getItem(HOURS_KEY); if (st) return st === 'on'; } catch (e) {}
    var et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })), d = et.getDay(), m = et.getHours() * 60 + et.getMinutes();
    return d >= 1 && d <= 5 ? m >= 540 && m < 1260 : d === 6 ? m >= 540 && m < 1020 : false;
  }

  var BAR = '#herosec .hero-card>.w-layout-layout,#gtmform .div-block-36>.w-layout-layout', BARS = function (x) { return BAR.split(',').map(function (b) { return b + (x.charAt(0) === '>' ? x : ' ' + x); }).join(','); };
  var css = document.createElement('style');
  css.textContent =
    /* form steps 2 and 3: no big title (start's own rule) and no step line in the popup's header (operator 30 Oct) */
    '#gtmform .cell-42 .heading-49{display:none}#heropopup .mjfdcpaboxtext-copy-copy{display:none}' +
    '.navbar-no-shadow{position:sticky!important;top:0;z-index:1000;background:#fff}' +
    /* the debt types panel hangs from the field itself (operator 30 Oct): no gap for the next label to show through */
    '#stoggle #dtoggle{top:100%;left:-1px;width:calc(100% + 2px);box-sizing:border-box;z-index:5;border-top-left-radius:0;border-top-right-radius:0}' +
    /* step 3's Back and Submit on one row, like step 2's Back and Continue (operator 30 Oct) */
    '#gtmform .quick-stack-27-copy{grid-template-columns:100px minmax(0,1fr)!important;grid-template-rows:auto!important;justify-content:stretch}' +
    '#gtmform .quick-stack-27-copy>.w-layout-cell{grid-row:1;min-width:0}' +
    '#gtmform .quick-stack-27-copy>.w-layout-cell:first-child{grid-column:1}#gtmform .quick-stack-27-copy>.w-layout-cell:last-child{grid-column:2}' +
    '#submitform{width:100%;box-sizing:border-box}' +
    '.ux-dd-foot{display:flex;justify-content:flex-end;padding:4px 8px 8px}' +
    '.ux-dd-done{border:0;border-radius:4px;padding:6px 14px;font:600 13px/1.2 inherit;font-family:inherit;background:#c92028;color:#fff;cursor:pointer}' +
    '.ux-dd-done:disabled{background:#e2e4e9;color:#6b7280;cursor:not-allowed}' +
    'html[data-hours="off"] .hero-call,html[data-hours="off"] .callustext,html[data-hours="off"] .ux-newclients{display:none!important}' +
    '.sticky-call-button{display:none!important}' +
    '.mobile-call.ux-review .w-embed{display:none}' +
    '[data-ux-chat]{position:fixed;right:16px;bottom:16px;z-index:2147483000;font:14px/1.4 system-ui,-apple-system,sans-serif}' +
    '[data-ux-chat] > button{width:56px;height:56px;border:0;border-radius:50%;background:#2f3fe0;color:#fff;cursor:pointer;display:grid;place-items:center;box-shadow:0 4px 14px rgba(0,0,0,.25)}' +
    '[data-ux-chat] .ux-chat-panel{position:absolute;right:0;bottom:68px;width:260px;background:#fff;color:#16181d;border-radius:12px;padding:14px 16px;box-shadow:0 8px 28px rgba(0,0,0,.22)}' +
    '[data-ux-chat] .ux-chat-panel[hidden]{display:none}' +
    '[data-ux-chat] .ux-chat-panel b{display:block;margin-bottom:4px}' +
    /* the first fold on phones: spacing only (each value was 20–25 px) */
    '@media (max-width:767px){' +
      '.hero-photo-cell,[data-hero-switch]{display:none!important}' +
      '#herosec{padding-top:8px}' +
      '#herosec>.w-container>.w-layout-layout{padding-top:8px}' +
      '#herosec h1{margin-top:4px;margin-bottom:6px}' +
      '#herosec .text-block-24{margin-top:8px}' +
      '#herosec .text-block-25{padding-top:8px}' +
      '#herosec .hero-card{margin-top:10px}' +
      /* the form's bar on all three steps: FREE CASE EVALUATION on one row (operator 30 Oct), same 12 px type, tighter tracking */
      BAR + '{padding:6px 12px;grid-template-columns:max-content minmax(0,1fr);column-gap:10px}' +
      BARS('.text-block-27') + ',' + BARS('.text-block-27-copy') + '{letter-spacing:.5px}' +
      BARS('.text-block-27') + '{white-space:nowrap}' +
      BARS('>.w-layout-cell:last-child') + '{align-items:flex-end}' +
      BARS('.text-block-27-copy') + '{text-align:right}' +
      '#herosec .div-block-37{padding-top:14px;padding-bottom:14px}' +
      '#herosec .div-block-37 h2{margin-bottom:6px}' +
      '#herosec .code-embed-5{padding-top:6px;padding-bottom:10px}' +
      '#herosec .mjslider-wrap{padding-top:4px;padding-bottom:4px}' +
      '#herosec .mjslider-value{margin-top:0;margin-bottom:8px;line-height:36px}' +
    '}' +
    '@media (max-width:374px){' + BAR + '{padding-left:10px;padding-right:10px}' + BARS('.text-block-27') + ',' + BARS('.text-block-27-copy') + '{letter-spacing:0}}';
  document.head.appendChild(css);

  document.documentElement.setAttribute('data-hours', openNow() ? 'on' : 'off');
  /* Work hours on / off: the mobile header button, and the phone calls to action below the form */
  window.CREDO_UX = { isOn: openNow, hours: function (on) { FORCE = !!on; try { localStorage.setItem(HOURS_KEY, on ? 'on' : 'off'); } catch (e) {} document.documentElement.setAttribute('data-hours', on ? 'on' : 'off'); header(); } };

  /* the floating call bar: staging's script creates it on DOMContentLoaded; remove it (and any later copy) so the page
     keeps no space reserved for it */
  function dropBar() { [].forEach.call(document.querySelectorAll('.sticky-call-button'), function (b) { b.remove(); }); }
  new MutationObserver(dropBar).observe(document.documentElement, { childList: true, subtree: true });

  function header() {
    var btn = document.querySelector('.navbar-no-shadow .mobile-call'); if (!btn) return;
    var label = btn.querySelector('.mobile-call-number') || btn.querySelector('.callnumbers');
    if (!btn.getAttribute('data-ux-tel')) btn.setAttribute('data-ux-tel', btn.getAttribute('href') || '');
    var open = openNow();
    btn.classList.toggle('ux-review', !open);
    if (open) { btn.setAttribute('href', btn.getAttribute('data-ux-tel')); btn.onclick = null; if (label) label.textContent = 'Call Now'; btn.setAttribute('aria-label', 'Call now'); return; }
    var form = document.getElementById('herosec');
    if (label) label.textContent = 'Free Review →'; btn.setAttribute('aria-label', 'Free review');
    if (form) { btn.setAttribute('href', '#herosec'); btn.onclick = function (e) { e.preventDefault(); form.scrollIntoView({ behavior: 'smooth' }); }; }
    else { var cta = document.getElementById('btnCTA'), h = cta && cta.getAttribute('href'); btn.setAttribute('href', h && !/^(tel:|javascript:|#)/.test(h) ? h : 'index.html'); btn.onclick = null; }
  }

  /* desktop (operator 30 Oct: "the header button should always be free review, since we already have the phone number"):
     Free Review at every hour, to the form, or to the home page's form on a page without one (about, legal) */
  function desktopCta() {
    var b = document.getElementById('btnCTA'); if (!b) return;
    b.textContent = 'FREE REVIEW →'; b.style.width = '125px'; b.style.opacity = '1';
    var form = document.getElementById('herosec'), home = document.querySelector('.navbar-no-shadow .navbar-brand');
    if (form) { b.setAttribute('href', '#herosec'); b.onclick = function (e) { e.preventDefault(); form.scrollIntoView({ behavior: 'smooth' }); }; }
    else { b.onclick = null; if (home) b.setAttribute('href', home.getAttribute('href').split('#')[0] + '#herosec'); }
  }

  /* the debt types dropdown (operator 30 Oct): a small Done, active from the first ticked box, closes it like a click outside */
  function debtDone() {
    var list = document.getElementById('dtoggle'), dd = document.getElementById('stoggle'); if (!list || !dd || list.querySelector('.ux-dd-done')) return;
    var row = document.createElement('div'); row.className = 'ux-dd-foot'; row.innerHTML = '<button type="button" class="ux-dd-done" disabled>Done</button>';
    list.appendChild(row); var b = row.firstChild;
    var sync = function () { b.disabled = !list.querySelector('input[type=checkbox]:checked'); };
    list.addEventListener('change', sync); sync();
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (window.jQuery) window.jQuery(dd).triggerHandler('w-close'); else document.body.click();
      var t = dd.querySelector('.w-dropdown-toggle'); if (t && t.focus) t.focus(); });
  }

  function chat() {
    if (document.querySelector('[data-ux-chat]')) return;
    var w = document.createElement('div'); w.setAttribute('data-ux-chat', '');
    w.innerHTML = '<div class="ux-chat-panel" hidden><b>Chat</b>The live site’s chat (Tidio) opens here. Prototype only: nothing is sent.</div>' +
      '<button type="button" aria-label="Open chat" aria-expanded="false"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg></button>';
    var b = w.querySelector('button'), p = w.querySelector('.ux-chat-panel');
    b.addEventListener('click', function () { p.hidden = !p.hidden; b.setAttribute('aria-expanded', String(!p.hidden)); });
    document.body.appendChild(w);
  }

  /* phones: the few ledes too long for the whole form to fit above the fold, shortened (same message and claims; the full
     lede stays on wider screens). Keyed by the page's data-hero-id. */
  var SHORT_LEDE = {
    'debt-medical-defense-services': 'Medical bills can contain errors, and collectors cannot always prove what they claim. Our attorneys check the debt and defend you if you are sued.',
    'debt-payday-loan-defense-services': 'Rollovers and bank withdrawals can turn a small loan into a crisis. Our attorneys check whether the loan was legal and defend you.',
    'demand-proof-home': 'Collectors and creditors must prove what they claim: ownership, amount, accuracy. When they can\u2019t, the case can be dismissed.',
    'fight-back-home': 'FDCPA violations carry $1,000 per lawsuit. Garnishments can be reduced. Our attorneys turn what was done to you into a case against them.',
    'know-your-rights-home': 'FDCPA. FCRA. CFPB rules. State law. Our attorneys explain what applies to you, at no cost, so you can decide from a position of knowledge.',
    'make-them-pay-home': 'When a collector or lender breaks the law, you may have a claim. Our attorneys document it and pursue it for you.',
    'reduce-home': 'Settlements. Exemptions. Credit-report removals. Our attorneys pursue every avenue to reduce what\u2019s claimed.',
    'respond-home': 'Default judgment, garnishment, repossession: all start when a deadline passes. Our attorneys file the response and protect what\u2019s yours.'
  };
  function lede() {
    var el = document.querySelector('#herosec .text-block-24'), s = SHORT_LEDE[document.documentElement.getAttribute('data-hero-id')]; if (!el || !s) return;
    if (!el.hasAttribute('data-ux-lede')) el.setAttribute('data-ux-lede', el.textContent);
    var mq = window.matchMedia('(max-width:767px)'), set = function () { el.textContent = mq.matches ? s : el.getAttribute('data-ux-lede'); };
    set(); if (mq.addEventListener) mq.addEventListener('change', set);
  }

  function start() {
    var nc = document.getElementById('bfootercta'), row = nc && nc.closest('.w-layout-layout'); if (row) row.classList.add('ux-newclients');
    var send = document.getElementById('submitform'); if (send) send.textContent = 'Submit →';
    dropBar(); header(); desktopCta(); chat(); lede(); debtDone(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  /* staging's own scripts set the header number on DOMContentLoaded and load; say it again once they have run */
  window.addEventListener('load', function () { dropBar(); header(); desktopCta(); });
})();
