/* Marketing Hub — shared shell: header, section menu, period picker, metrics-tier status, formatters,
 * and the few calculations every page shares (per-page metrics, alerts). Pages include:
 *   <link rel="stylesheet" href="hub.css"> <script src="data/registry.js"></script>
 *   <script src="data/metrics.js"></script>  (metrics tier; absent on the mirror until the encrypted gate exists)
 *   <script src="hub.js"></script> and call Hub.init({ page:'funnel', sub:'…' }). */
/* MH-11: inside app.html (public mirror) the data is decrypted in the parent window; borrow it. A page opened on its own
 * without data goes to the gate. */
if (!window.HUB && window.parent !== window) {
  try { ['HUB', 'HUB_METRICS', 'HUB_MICROSITES', 'HUB_ADS', 'HUB_ADS_METRICS', 'BACKLOG', 'HUB_WORK', 'HUB_STATUTES', 'HUB_ORGANIC'].forEach(function (k) { if (window.parent[k] && !window[k]) window[k] = window.parent[k]; }); } catch (e) {}
}
/* MH-11 E: the old single-page sections live inside app.html now. Opened on their own they redirect into it; their links
 * to sections that moved into the app open the app's section. */
var APPROUTE = { 'index.html': '#/more/index.html', 'funnel.html': '#/more/funnel.html', 'tracking.html': '#/more/tracking.html', 'reference.html': '#/more/reference.html',
  'microsites.html': '#/website', 'ads.html': '#/ads', 'organic.html': '#/organic', 'work.html': '#/work' };
(function () {
  var file = location.pathname.split('/').pop() || 'index.html';
  if (window.top === window && APPROUTE[file]) { location.replace('app.html' + APPROUTE[file]); return; }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    var m = (a.getAttribute('href') || '').match(/^([a-z]+\.html)(#.*)?$/); if (!m || !APPROUTE[m[1]]) return;
    e.preventDefault(); window.top.location.hash = APPROUTE[m[1]];
  });
})();
if (!window.HUB) location.replace('app.html');
(function () {
  if (!window.HUB) return;
  var H = window.HUB, M = window.HUB_METRICS || null;
  var SECTIONS = [
    ['index', 'Overview', 'index.html'], ['funnel', 'Funnel', 'funnel.html'], ['tracking', 'Tracking', 'tracking.html'], ['reference', 'Reference', 'reference.html']
  ];
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var dash = '<span class="dim">–</span>';
  var n0 = function (v) { return v == null || !isFinite(v) ? dash : Math.round(v).toLocaleString('en-US'); };
  var n1 = function (v) { if (v == null || !isFinite(v)) return dash; if (!v) return '<span class="dim">0</span>'; var r = Math.round(v * 10) / 10; return Math.abs(r - Math.round(r)) < 1e-9 ? Math.round(r).toLocaleString('en-US') : r.toLocaleString('en-US', { minimumFractionDigits: 1 }); };
  var usd = function (v) { return v == null || !isFinite(v) ? dash : '$' + Math.round(v).toLocaleString('en-US'); };
  var pct = function (a, b) { return !b || a == null ? dash : (100 * a / b).toFixed(1) + '%'; };
  var per = function (cost, n) { return n >= 0.5 ? usd(cost / n) : dash; };

  var periodKey = (function () { try { return localStorage.getItem('mh-period'); } catch (e) { return null; } })();
  if (!M || !M.periods[periodKey]) periodKey = M ? Object.keys(M.periods)[0] : null;
  function setPeriod(k) { try { localStorage.setItem('mh-period', k); } catch (e) {} location.reload(); }

  function init(o) {
    var mount = document.getElementById('hub-header'); if (!mount) return;
    if (/[?&]embed=1\b/.test(location.search)) { mount.style.display = 'none'; return; }   /* shown inside app.html's main panel (MH-10) */
    var cur = SECTIONS.filter(function (s) { return s[0] === o.page; })[0] || SECTIONS[0];
    document.title = cur[1] + ' · Marketing Hub · Crēdo Legal';
    var periods = M ? Object.keys(M.periods).map(function (k) { return '<option value="' + k + '"' + (k === periodKey ? ' selected' : '') + '>' + esc(M.periods[k].label) + '</option>'; }).join('') : '';
    mount.innerHTML =
      '<div class="mh-bar"><div class="mh-row1">' +
      '<a class="mh-brand" href="app.html">Marketing Hub <small>Crēdo Legal</small></a>' +
      '<nav class="mh-nav">' + SECTIONS.map(function (s) { return '<a href="' + s[2] + '"' + (s[0] === cur[0] ? ' aria-current="page"' : '') + '>' + s[1] + '</a>'; }).join('') + '</nav>' +
      '<div class="mh-right">' +
      (M ? '<label>Period <select id="mh-period">' + periods + '</select></label><span class="mh-chip ok">Metrics: local</span>' : '<span class="mh-chip warn">Metrics locked</span>') +
      '<span class="mh-chip">Local only</span></div></div>' +
      '<div class="mh-row2"><b>' + esc(cur[1]) + '</b>' + (o.sub ? ' · ' + esc(o.sub) : '') + ' · registry built ' + esc(H.built) + (M ? ' · metrics built ' + esc(M.built) : '') + '</div></div>';
    var sel = document.getElementById('mh-period'); if (sel) sel.addEventListener('change', function () { setPeriod(sel.value); });
  }

  /* ── per-page metrics for the current period ── */
  var adsBy = {}; H.ads.forEach(function (a) { adsBy[a.platform + ':' + a.id] = a; });
  var pageBy = {}, pageByLive = {}; H.pages.forEach(function (p) { pageBy[p.slug] = p; pageByLive[p.liveSlug] = p; });   /* slug = staging address, liveSlug = address on start (ads, Analytics) */
  function period() { return M ? M.periods[periodKey] : null; }
  var CONV = ['form', 'calls', 'sa_sent', 'sa_signed', 'enrolled', 'paid'];
  /* Returns {spend, visits, formStart, formSubmit, form, calls, sa_sent, sa_signed, enrolled, paid} or null. */
  function pageMetrics(slug) {
    var P = period(); if (!P) return null;
    if (P.level === 'page') {
      var r = P.pages[slug]; if (!r) return null;
      return { spend: r.spend, visits: r.visits, formStart: r.starts, formSubmit: r.submits, sa_sent: r.sent, sa_signed: r.signed, enrolled: r.enrolled, paid: r.paid, form: null, calls: null };
    }
    var F = P.funnel, o = { spend: 0, visits: 0, engaged: 0, formStart: 0, formSubmit: 0 }; CONV.forEach(function (c) { o[c] = 0; });
    var any = false;
    F.ads.forEach(function (a) { if (a.slug !== slug || a.host !== 'start.credolegal.com') return; any = true; o.spend += a.cost; CONV.forEach(function (c) { o[c] += a.conv[c] || 0; }); });
    F.visits.forEach(function (v) { if (v.page !== slug) return; any = true; o.visits += v.sessions; o.engaged += v.engaged; o.formStart += v.formStart; o.formSubmit += v.formSubmit; });
    return any ? o : null;
  }
  function googleStatus(p) {
    var g = p.ads.map(function (k) { return adsBy[k]; }).filter(function (a) { return a && a.platform === 'google'; });
    if (!g.length) return 'none'; return g.some(function (a) { return a.running; }) ? 'running' : 'paused';
  }

  /* ── alerts (Overview) ── */
  function alerts() {
    var out = [], P = period();
    if (P && P.level === 'ad') {
      var F = P.funnel, tagged = {}; F.visits.forEach(function (v) { if (v.tagged) tagged[v.ad] = 1; });
      var mism = F.ads.filter(function (a) {
        if (!a.mix) return false; var own = 0, off = 0;
        F.visits.forEach(function (v) { if (v.ad !== a.id || v.page === '(not set)' || v.page === 'page/thank-you') return; if (v.page === a.slug) own += v.sessions; else off += v.sessions; });
        var sl = a.mix.sitelink || 0; return off - sl >= 30 && off > 1.25 * sl;
      });
      if (mism.length) out.push({ n: mism.length, kind: 'warn', title: 'Ads whose visitors land off the ad’s page beyond what sitelinks explain', detail: mism.map(function (a) { return a.slug; }).join(', '), href: 'funnel.html' });
      var noid = H.ads.filter(function (a) { return a.platform === 'google' && a.passesAdId === false; });
      if (noid.length) out.push({ n: noid.length, kind: 'warn', title: 'Google ads whose links carry no ad id (Analytics can only count them per page)', detail: [].concat.apply([], noid.map(function (a) { return a.campaign + ' › ' + a.adGroup; })).filter(function (x, i, s) { return s.indexOf(x) === i; }).join(', '), href: 'tracking.html#gaps' });
    }
    var outside = H.ads.filter(function (a) { return a.platform === 'google' && a.host !== 'start.credolegal.com'; });
    if (outside.length) out.push({ n: outside.length, kind: 'info', title: 'Google ads pointing outside the start site', detail: outside.map(function (a) { return a.campaign + ' → ' + a.host; }).filter(function (x, i, s) { return s.indexOf(x) === i; }).join(', '), href: 'ads.html' });
    var missing = H.ads.filter(function (a) { return a.host === 'start.credolegal.com' && a.slug && !pageByLive[a.slug]; });
    if (missing.length) out.push({ n: missing.length, kind: 'warn', title: 'Ads pointing at pages that do not exist on the new site', detail: missing.map(function (a) { return a.platform + ': ' + a.slug; }).filter(function (x, i, s) { return s.indexOf(x) === i; }).join(', '), href: 'ads.html' });
    var noad = H.pages.filter(function (p) { return p.kind === 'landing' && !p.ads.length; });
    if (noad.length) out.push({ n: noad.length, kind: 'info', title: 'Landing pages with no ad pointing at them (any platform, current structure)', detail: noad.map(function (p) { return p.slug; }).join(', '), href: 'microsites.html' });
    var nophone = H.ads.filter(function (a) { return a.platform === 'google' && !a.phone; });
    if (nophone.length) out.push({ n: nophone.length, kind: 'warn', title: 'Google ads whose ad group has no number in the phone sheet', detail: nophone.map(function (a) { return a.campaign + ' › ' + a.adGroup; }).filter(function (x, i, s) { return s.indexOf(x) === i; }).join(', '), href: 'ads.html' });
    var ph = H.connections.filter(function (c) { return /placeholder/.test(c.state); });
    if (ph.length) out.push({ n: ph.length, kind: 'info', title: 'Platforms kept as placeholders (operator, 3 Oct): no data until connected', detail: ph.map(function (c) { return c.name; }).join(', '), href: 'tracking.html' });
    if (!M) out.push({ n: '', kind: 'warn', title: 'Metrics tier not loaded', detail: 'Spend, visits and client stages are in the encrypted bundle; unlock it to see them.', href: 'tracking.html' });
    var openGaps = H.gaps.filter(function (g) { return /open/.test(g.status); });
    if (openGaps.length) out.push({ n: openGaps.length, kind: 'info', title: 'Open tracking gaps', detail: openGaps.map(function (g) { return g.id + ' ' + g.title; }).join(' · '), href: 'tracking.html#gaps' });
    return out;
  }

  window.Hub = { init: init, period: period, periodKey: periodKey, pageMetrics: pageMetrics, googleStatus: googleStatus, alerts: alerts, adsBy: adsBy, pageBy: pageBy, pageByLive: pageByLive,
    fmt: { esc: esc, n0: n0, n1: n1, usd: usd, pct: pct, per: per, dash: dash }, CONV: CONV };
})();
