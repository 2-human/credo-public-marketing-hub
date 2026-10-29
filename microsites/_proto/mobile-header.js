/* Proposed top-of-page UX for the prototype pages (operator 29 Oct 2026, after reviewing start.credolegal.com on a phone:
 * "the header is sticky, there is no floating call button, and we keep the chat icon. In the header, we show Call Now
 * during operating hours and Free Review out of operating hours.")
 *  - the header stays at the top while the page scrolls (all widths);
 *  - the floating "Is your debt situation becoming urgent? / Call now" bar is removed (it covered the form's Continue);
 *  - a chat icon bottom right stands in for the live site's Tidio chat (Tidio does not load on the prototype);
 *  - the mobile header button (staging's .mobile-call, the phone number) reads "Call Now" and calls the page's number in
 *    operating hours, and "Free Review" and scrolls to the form outside them. Hours are staging's own rule: Monday to
 *    Friday 9 am to 9 pm ET, Saturday 9 am to 5 pm ET, Sunday closed.
 * Added by build-microsites.mjs to every mirrored page, so the new pages built in the hub from a mirror carry it too.
 * ?ux=staging shows the page exactly as staging has it (the mirror checks load it that way); ?hours=open|closed previews
 * either header state. */
(function () {
  var q = new URLSearchParams(location.search);
  if (q.get('ux') === 'staging') return;
  document.documentElement.setAttribute('data-ux', 'proposed');

  function openNow() {
    var f = q.get('hours'); if (f === 'open') return true; if (f === 'closed') return false;
    var et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })), d = et.getDay(), m = et.getHours() * 60 + et.getMinutes();
    return d >= 1 && d <= 5 ? m >= 540 && m < 1260 : d === 6 ? m >= 540 && m < 1020 : false;
  }

  var css = document.createElement('style');
  css.textContent =
    '.navbar-no-shadow{position:sticky!important;top:0;z-index:1000}' +
    '.sticky-call-button{display:none!important}' +
    '.mobile-call.ux-review .w-embed{display:none}' +
    '[data-ux-chat]{position:fixed;right:16px;bottom:16px;z-index:2147483000;font:14px/1.4 system-ui,-apple-system,sans-serif}' +
    '[data-ux-chat] > button{width:56px;height:56px;border:0;border-radius:50%;background:#2f3fe0;color:#fff;cursor:pointer;display:grid;place-items:center;box-shadow:0 4px 14px rgba(0,0,0,.25)}' +
    '[data-ux-chat] .ux-chat-panel{position:absolute;right:0;bottom:68px;width:260px;background:#fff;color:#16181d;border-radius:12px;padding:14px 16px;box-shadow:0 8px 28px rgba(0,0,0,.22)}' +
    '[data-ux-chat] .ux-chat-panel[hidden]{display:none}' +
    '[data-ux-chat] .ux-chat-panel b{display:block;margin-bottom:4px}';
  document.head.appendChild(css);

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

  function chat() {
    if (document.querySelector('[data-ux-chat]')) return;
    var w = document.createElement('div'); w.setAttribute('data-ux-chat', '');
    w.innerHTML = '<div class="ux-chat-panel" hidden><b>Chat</b>The live site’s chat (Tidio) opens here. Prototype only: nothing is sent.</div>' +
      '<button type="button" aria-label="Open chat" aria-expanded="false"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg></button>';
    var b = w.querySelector('button'), p = w.querySelector('.ux-chat-panel');
    b.addEventListener('click', function () { p.hidden = !p.hidden; b.setAttribute('aria-expanded', String(!p.hidden)); });
    document.body.appendChild(w);
  }

  function start() { dropBar(); header(); chat(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  /* staging's own scripts set the header number on DOMContentLoaded and load; say it again once they have run */
  window.addEventListener('load', function () { dropBar(); header(); });
})();
