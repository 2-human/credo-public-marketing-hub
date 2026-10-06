/* Marketing Hub, three panels (MH-10, 5 Oct 2026). Left: navigation tree. Main: the item chosen in the navigation.
 * Right: a drawer with more information and metrics for an item clicked in main.
 * Routes (hash):  #/website · #/website/<angle> · #/website/<angle>/<page>
 *                 #/ads · #/ads/<platform> · …/<campaign> · …/<ad group|ad set> · …/<ad>
 *                 #/more/<file>  (the older single-page sections, shown in main without their own header)
 * Data: registry.js (HUB), metrics.js (HUB_METRICS, local), microsites.js, ads-tree.js (HUB_ADS), ads-metrics.js. */
(function () {
  var H = window.HUB, M = window.HUB_METRICS || null, S = window.HUB_MICROSITES, A = window.HUB_ADS, AM = window.HUB_ADS_METRICS || null;
  var B = window.BACKLOG || null, W = window.HUB_WORK || null, RV = window.HUB_REVIEWS || null, PM = window.HUB_PHONEMAP || null, ST = window.HUB_STATUTES || null, O = window.HUB_ORGANIC || null;
  var TAB = null;
  /* review comments (MH-11 D3): the shared review database the old hubs' widget wrote to (credo-712c4, /comments).
   * Each comment is mapped to the entity it was left on; new comments from the hub are written with page
   * "credo-marketing-hub" and an anchor naming the entity. */
  var RTDB = 'https://credo-712c4-default-rtdb.firebaseio.com/comments', COMMENTS = null;
  function loadComments() { return fetch(RTDB + '.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) { COMMENTS = d || {}; }).catch(function () { COMMENTS = {}; }); }
  function commentKey(c) {   /* → 'page:<staging slug>' | 'adset:<Meta ad set key>' | 'hub:<anchor>' | null */
    var pg = c.page || '', an = c.anchor || '', m;
    if (pg === 'credo-marketing-hub') return 'hub:' + an;
    if ((m = pg.match(/^credo-public-harassment-lp-(.+?)-?locked-paired-[a-z-]+\.html$/)) && ST && ST.contentSlug) { var sl = ST.contentSlug[m[1]] || (m[1] === '' ? 'debt-harassment-know-your-rights-fdcpa' : null); return sl ? 'page:' + sl : null; }
    if (pg === 'credo-public-meta-ads-preview' && (m = an.match(/^([A-Za-z_]+?)-(card|msg|cr|hl|desc|vid|bold)/))) return 'adset:AS_DD_' + m[1];
    if (pg === 'credo-public-meta-ads-preview-handoff-meta-competitive-v1' && (m = an.match(/^(A\d_[a-z-]+?)-(static|video|feed)/))) return 'adset:AS_' + m[1];
    return null;
  }
  function commentsFor(key) { return COMMENTS ? Object.keys(COMMENTS).map(function (id) { var c = COMMENTS[id]; c._id = id; return c; }).filter(function (c) { var k = commentKey(c); return k === key || k === 'hub:' + key; }) : []; }
  function commentsTab(key) {
    if (COMMENTS === null) return '<p class="note">Loading comments…</p>';
    var list = commentsFor(key).sort(function (a, b) { return (b.timestamp || b.edited_at || 0) - (a.timestamp || a.edited_at || 0); });
    var h = '<div class="clist">' + (list.length ? list.map(function (c) {
      var st = /resolved|applied|archived/.test(c.status) ? 'ok' : 'warn';
      return '<div class="cmt"><div class="sub">' + esc(c.author || 'Anonymous') + (c.timestamp ? ' · ' + new Date(c.timestamp).toISOString().slice(0, 10) : '') + ' <span class="chip ' + st + '">' + esc(c.status || 'pending') + '</span></div>' +
        '<p>' + esc(c.comment || c.text_preview || '') + '</p>' + (c.replacement ? '<p class="sub">Suggested: ' + esc(c.replacement) + '</p>' : '') + (c.resolution ? '<p class="sub">Resolution: ' + esc(c.resolution) + '</p>' : '') + '</div>'; }).join('') : '<p class="note">No comments yet.</p>') + '</div>';
    return h + '<form class="cform" data-ckey="' + esc(key) + '"><label>Add a comment</label><textarea required rows="3"></textarea><button class="btn" type="submit">Post comment</button><span class="sub"></span></form>';
  }
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('.cform'); if (!f) return; e.preventDefault();
    var who = (function () { try { return localStorage.getItem('credo_reviewer'); } catch (x) { return null; } })() || (window.prompt('Your name:', '') || 'Anonymous').trim() || 'Anonymous';
    try { localStorage.setItem('credo_reviewer', who); } catch (x) {}
    var rec = { page: 'credo-marketing-hub', anchor: f.getAttribute('data-ckey'), author: who, comment: f.querySelector('textarea').value.trim(), status: 'pending', timestamp: Date.now() };
    if (!rec.comment) return; f.querySelector('.sub').textContent = 'Posting…';
    fetch(RTDB + '.json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec) }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) { COMMENTS[d.name] = rec; var p = f.closest('.dpanel'); if (p) p.innerHTML = commentsTab(rec.anchor); })
      .catch(function () { f.querySelector('.sub').textContent = 'Could not post the comment.'; });
  });   /* the main-panel tab of the current route (#/…?tab=key) */
  function tabsBar(base, tabs, cur) {   /* tabs = [[key, label, count]]; the first is the default */
    return '<nav class="mtabs" aria-label="Views">' + tabs.map(function (t, i) { var on = cur ? cur === t[0] : i === 0;
      return '<a href="' + base + (i ? '?tab=' + t[0] : '') + '"' + (on ? ' aria-current="page"' : '') + '>' + esc(t[1]) + (t[2] != null ? ' <span class="cnt">' + t[2] + '</span>' : '') + '</a>'; }).join('') + '</nav>';
  }
  var F = Hub.fmt, esc = F.esc, n0 = F.n0, n1 = F.n1, usd = F.usd, pct = F.pct, per = F.per, dash = F.dash;
  var $ = function (id) { return document.getElementById(id); };
  var enc = encodeURIComponent, dec = decodeURIComponent;
  var STAGING = 'https://staging.credolegal.com/';

  /* ───────────── model: website ───────────── */
  var SHARED = [['index', 'Home', 'home'], ['about', 'About', 'shared'], ['terms-of-use', 'Terms of use', 'legal'], ['privacy-policy', 'Privacy policy', 'legal'],
                ['cookie-policy', 'Cookie policy', 'legal'], ['thank-you', 'Thank you', 'system']];
  var sites = S.sites.map(function (s) {
    var pages = SHARED.map(function (x) {
      return { id: x[0], label: x[1], kind: x[2], file: 'microsites/' + s.angle + '/' + x[0] + '.html',
               staging: STAGING + (x[0] === 'index' ? (s.home != null ? s.home : s.angle) : x[0]), live: null, liveSlug: null, inMenu: null };
    });
    s.types.forEach(function (t) {
      t.pages.forEach(function (p) {
        var reg = Hub.pageBy[p.slug] || null;
        pages.push({ id: 'services/' + p.slug, label: p.slug, kind: 'service', debt: t.label, file: 'microsites/' + s.angle + '/services/' + p.slug + '.html',
          staging: STAGING + p.slug, live: reg && reg.live ? reg.liveUrl : null, liveSlug: p.live, inMenu: t.pick === p.slug, reason: t.reason, by: t.by,
          running: p.running, hadAd: p.hadAd, reg: reg });
      });
    });
    return { angle: s.angle, home: s.home != null ? s.home : s.angle, label: s.label, homeCopy: s.homeCopy, pages: pages, types: s.types };   /* home: staging address of the home (PBI-43: '' for the default site) */
  });
  var siteBy = {}; sites.forEach(function (s) { siteBy[s.angle] = s; });

  /* ───────────── model: ads ───────────── */
  var plats = A.platforms, platBy = {}; plats.forEach(function (p) { platBy[p.key] = p; });
  function findAd(pk, ck, gk, ak) {
    var p = platBy[pk] || null, c = p && p.campaigns.filter(function (x) { return x.key === ck; })[0] || null;
    var g = c && c.groups.filter(function (x) { return x.key === gk; })[0] || null, a = g && g.ads.filter(function (x) { return x.key === ak; })[0] || null;
    return { p: p, c: c, g: g, a: a };
  }
  var adHref = function (p, c, g, a) { return '#/ads/' + [p.key, c && c.key, g && g.key, a && a.key].filter(function (x) { return x != null; }).map(enc).join('/'); };
  var allAds = function (node) {   /* every ad under a platform, campaign or group */
    if (node.ads) return node.ads; if (node.groups) return [].concat.apply([], node.groups.map(allAds)); return [].concat.apply([], node.campaigns.map(allAds));
  };
  function adsForPage(liveSlug) {
    var out = []; if (!liveSlug) return out;
    plats.forEach(function (p) { p.campaigns.forEach(function (c) { c.groups.forEach(function (g) { g.ads.forEach(function (a) {
      if (a.slug === liveSlug && /credolegal\.com$/.test(a.host || '')) out.push({ p: p, c: c, g: g, a: a });
    }); }); }); });
    return out;
  }

  /* ───────────── metrics ───────────── */
  var CONVK = ['form', 'calls', 'sa_sent', 'sa_signed', 'enrolled', 'paid'];
  function gPeriod(ids) {   /* selected period, Google, from metrics.js (ad level only) */
    var P = Hub.period(); if (!P || P.level !== 'ad') return null;
    var set = {}; ids.forEach(function (i) { set[i] = 1; });
    var o = { impr: 0, clicks: 0, cost: 0, sessions: 0, formStart: 0, formSubmit: 0 }, any = false; CONVK.forEach(function (k) { o[k] = 0; });
    P.funnel.ads.forEach(function (a) { if (!set[a.id]) return; any = true; o.impr += a.impr; o.clicks += a.clicks; o.cost += a.cost; CONVK.forEach(function (k) { o[k] += (a.conv && a.conv[k]) || 0; }); });
    P.funnel.visits.forEach(function (v) { if (!set[v.ad]) return; o.sessions += v.sessions; o.formStart += v.formStart; o.formSubmit += v.formSubmit; });
    return any ? o : null;
  }
  function gAll(ids) {   /* all time, Google, monthly */
    if (!AM) return null; var by = {}, o = { impr: 0, clicks: 0, cost: 0, conv: 0, months: [] }, any = false;
    ids.forEach(function (i) { var r = AM.google.ads[i]; if (!r) return; r.monthly.forEach(function (m) {
      any = true; o.impr += m.impr; o.clicks += m.clicks; o.cost += m.cost; o.conv += m.conv;
      var b = by[m.m] || (by[m.m] = { m: m.m, impr: 0, clicks: 0, cost: 0, conv: 0 }); b.impr += m.impr; b.clicks += m.clicks; b.cost += m.cost; b.conv += m.conv; }); });
    o.months = Object.keys(by).sort().map(function (k) { return by[k]; });
    return any ? o : null;
  }
  var mt = function (k, v) { return '<div class="m"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>'; };
  function periodLabel() { var P = Hub.period(); return P ? P.label : 'no metrics loaded'; }
  function gMetricsHtml(ids) {
    var h = '', p = gPeriod(ids), a = gAll(ids);
    h += '<h3>Selected period · ' + esc(periodLabel()) + '</h3>';
    if (p) h += '<div class="mgrid">' + mt('Impressions', n0(p.impr)) + mt('Clicks', n0(p.clicks)) + mt('CTR', pct(p.clicks, p.impr)) + mt('Spend', usd(p.cost)) +
      mt('CPC', per(p.cost, p.clicks)) + mt('Form leads', n1(p.form)) + mt('Calls', n1(p.calls)) + mt('SA sent', n1(p.sa_sent)) + mt('Signed', n1(p.sa_signed)) +
      mt('Enrolled', n1(p.enrolled)) + mt('Paid', n1(p.paid)) + mt('Cost / signed', per(p.cost, p.sa_signed)) +
      mt('Sessions', n0(p.sessions)) + mt('Form starts', n0(p.formStart)) + mt('Form sends', n0(p.formSubmit)) + '</div>';
    else h += '<p class="note">' + (Hub.period() && Hub.period().level !== 'ad' ? 'This period is reported per page, not per ad (choose the 28-day period in the header).' : 'No spend in this period.') + '</p>';
    h += '<h3>All time · Google Ads</h3>';
    if (a) h += '<div class="mgrid">' + mt('Impressions', n0(a.impr)) + mt('Clicks', n0(a.clicks)) + mt('CTR', pct(a.clicks, a.impr)) + mt('Spend', usd(a.cost)) +
      mt('Conversions', n1(a.conv)) + mt('Cost / conv.', per(a.cost, a.conv)) + '</div>' + bars(a.months);
    else h += '<p class="note">No delivery recorded.</p>';
    return h;
  }
  function bars(months) {   /* monthly spend bars with the month under every third */
    if (!months.length) return '';
    var W = 400, Hh = 110, n = months.length, bw = W / n, max = Math.max.apply(null, months.map(function (m) { return m.cost; })) || 1;
    var s = months.map(function (m, i) {
      var h = Math.max(1, (Hh - 22) * m.cost / max);
      return '<rect x="' + (i * bw + 1).toFixed(1) + '" y="' + (Hh - 18 - h).toFixed(1) + '" width="' + Math.max(1, bw - 2).toFixed(1) + '" height="' + h.toFixed(1) + '" fill="#8fa9d6"><title>' +
        esc(m.m + ': $' + Math.round(m.cost).toLocaleString('en-US') + ' · ' + Math.round(m.clicks) + ' clicks · ' + (Math.round(m.conv * 10) / 10) + ' conv.') + '</title></rect>' +
        (i % 3 === 0 ? '<text x="' + (i * bw + 1).toFixed(1) + '" y="' + (Hh - 4) + '" font-size="9" fill="#667080">' + esc(m.m.slice(2)) + '</text>' : '');
    }).join('');
    return '<h3>Spend by month</h3><svg class="bars" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="Spend by month">' + s + '</svg>';
  }
  /* Page metrics, one scope per number (5 Oct, operator: "break metrics down by platform, campaign, ad group/set, ad").
   * Measured on the page (Analytics): sessions, form starts, form sends, per ad (utm_content = ad id).
   * Allocated to the page (estimate): each ad's spend and outcomes × the share of that ad's sessions that landed on this
   * page. Google Ads does not report outcomes per landing page, so this is the honest split; an ad that points here but
   * has no ad id in Analytics counts fully here. */
  var adSess = null, gIndex = null;
  function gAdIndex() {
    if (gIndex) return gIndex; gIndex = {};
    var g = platBy.google; if (g) g.campaigns.forEach(function (c) { c.groups.forEach(function (gr) { gr.ads.forEach(function (a) { gIndex[a.id] = { href: adHref(g, c, gr, a), label: adLabel(g, a) }; }); }); });
    return gIndex;
  }
  function pageBreakdown(slug) {
    var P = Hub.period(); if (!P || !slug) return null;
    if (P.level !== 'ad') { var r = P.pages && P.pages[slug]; return r ? { pageLevel: r } : null; }
    var Fn = P.funnel, adBy = {}, rows = {};
    if (!adSess) { adSess = {}; Fn.visits.forEach(function (v) { adSess[v.ad] = (adSess[v.ad] || 0) + v.sessions; }); }
    Fn.ads.forEach(function (a) { adBy[a.id] = a; });
    Fn.visits.forEach(function (v) { if (v.page !== slug) return; var r = rows[v.ad] || (rows[v.ad] = { id: v.ad, sessions: 0, formStart: 0, formSubmit: 0 });
      r.sessions += v.sessions; r.formStart += v.formStart; r.formSubmit += v.formSubmit; });
    Fn.ads.forEach(function (a) { if (a.slug === slug && a.host === 'start.credolegal.com' && !rows[a.id]) rows[a.id] = { id: a.id, sessions: 0, formStart: 0, formSubmit: 0 }; });
    var out = Object.keys(rows).map(function (k) {
      var r = rows[k], a = adBy[r.id] || null, tot = adSess[r.id] || 0;
      r.ad = a; r.landsHere = !!(a && a.slug === slug); r.share = tot ? r.sessions / tot : (r.landsHere ? 1 : 0); r.noId = !tot && r.landsHere;
      r.adCost = a ? a.cost : 0; r.adClicks = a ? a.clicks : 0; r.cost = r.adCost * r.share;
      CONVK.forEach(function (c) { r[c] = a ? ((a.conv && a.conv[c]) || 0) * r.share : 0; });
      return r;
    });
    var t = { sessions: 0, formStart: 0, formSubmit: 0, cost: 0 }; CONVK.forEach(function (c) { t[c] = 0; });
    out.forEach(function (r) { ['sessions', 'formStart', 'formSubmit', 'cost'].concat(CONVK).forEach(function (k) { t[k] += r[k]; }); });
    return { rows: out, total: t };
  }
  function pageMetricsHtml(liveSlug) {
    var h = '<h3>Metrics · ' + esc(periodLabel()) + '</h3>', b = pageBreakdown(liveSlug), others = adsForPage(liveSlug).filter(function (x) { return x.p.key !== 'google'; });
    if (!b) return h + '<p class="note">No paid traffic recorded for this page in this period' + (liveSlug ? '' : ' (the page is new: no address on the live site yet)') + '.</p>';
    if (b.pageLevel) { var r = b.pageLevel;
      return h + '<div class="mgrid">' + mt('Spend', usd(r.spend)) + mt('Visits', n0(r.visits)) + mt('Form starts', n0(r.starts)) + mt('Form sends', n0(r.submits)) + mt('SA sent', n1(r.sent)) +
        mt('Signed', n1(r.signed)) + mt('Enrolled', n1(r.enrolled)) + mt('Paid', n1(r.paid)) + mt('Cost / signed', per(r.spend, r.signed)) + '</div>' +
        '<p class="note">This period is reported per page only. Choose the 28-day period in the header for the breakdown by platform, campaign, ad group and ad.</p>'; }
    var t = b.total;
    h += '<div class="mgrid">' + mt('Sessions', n0(t.sessions)) + mt('Form starts', n0(t.formStart)) + mt('Form sends', n0(t.formSubmit)) + mt('Send rate', pct(t.formSubmit, t.sessions)) +
      mt('Spend*', usd(t.cost)) + mt('Cost / session*', per(t.cost, t.sessions)) + mt('Form leads*', n1(t.form)) + mt('Calls*', n1(t.calls)) + mt('SA sent*', n1(t.sa_sent)) +
      mt('Signed*', n1(t.sa_signed)) + mt('Enrolled*', n1(t.enrolled)) + mt('Paid*', n1(t.paid)) + '</div>' +
      '<p class="note">Sessions and form events are measured on this page (Analytics). * Allocated: each ad’s spend and outcomes × the share of that ad’s sessions that landed on this page. ' +
      'Google Ads does not report outcomes per landing page, so these are estimates.</p>';
    /* tree: platform › campaign › ad group › ad */
    var G = gAdIndex(), tree = {};
    b.rows.forEach(function (r) {
      var a = r.ad, c = a ? a.campaign : 'Not attributed to an ad', g = a ? a.adGroup : '(no ad id in Analytics)';
      var pc = tree[c] || (tree[c] = {}); (pc[g] || (pc[g] = [])).push(r);
    });
    var sumOf = function (rs) { var o = { sessions: 0, formStart: 0, formSubmit: 0, cost: 0, form: 0, calls: 0, sa_signed: 0 }; rs.forEach(function (r) { for (var k in o) o[k] += r[k]; }); return o; };
    var cells = function (o, share, lands) {
      return '<td>' + (lands == null ? '' : lands ? '<span class="chip ok">yes</span>' : '<span class="chip">sitelink</span>') + '</td><td class="num">' + n0(o.sessions) + '</td><td class="num">' + (share == null ? '' : pct(share, 1)) + '</td>' +
        '<td class="num">' + n0(o.formStart) + '</td><td class="num">' + n0(o.formSubmit) + '</td><td class="num">' + usd(o.cost) + '</td><td class="num">' + n1(o.form) + '</td>' +
        '<td class="num">' + n1(o.calls) + '</td><td class="num">' + n1(o.sa_signed) + '</td>';
    };
    var all = b.rows, rowsH = '<tr class="lvl0"><td><b>Google</b></td>' + cells(sumOf(all)) + '</tr>';
    Object.keys(tree).sort(function (x, y) { return sumOf([].concat.apply([], Object.values(tree[y]))).sessions - sumOf([].concat.apply([], Object.values(tree[x]))).sessions; }).forEach(function (c) {
      var crs = [].concat.apply([], Object.values(tree[c]));
      rowsH += '<tr class="lvl1"><td>' + esc(c) + '</td>' + cells(sumOf(crs)) + '</tr>';
      Object.keys(tree[c]).forEach(function (g) {
        rowsH += '<tr class="lvl2"><td>' + esc(g) + '</td>' + cells(sumOf(tree[c][g])) + '</tr>';
        tree[c][g].sort(function (x, y) { return y.sessions - x.sessions; }).forEach(function (r) {
          var gi = G[r.id], name = gi ? '<a href="' + gi.href + '">' + esc(gi.label) + '</a>' : r.ad ? esc(r.id) : 'Visits without an ad id';
          rowsH += '<tr class="lvl3"><td>' + name + '<div class="sub">' + esc(r.ad ? r.id : 'utm_content missing in the ad link') + (r.ad ? ' · whole ad: ' + usd(r.adCost) + ', ' + n0(r.adClicks) + ' clicks' : '') + (r.noId ? ' · no ad id in Analytics, counted fully here' : '') + '</div></td>' +
            cells(r, r.ad ? r.share : null, r.ad ? r.landsHere : null) + '</tr>';
        });
      });
    });
    others.forEach(function (x) {
      rowsH += '<tr class="lvl0"><td><b>' + esc(x.p.label) + '</b> · ' + esc(x.c.name) + ' › ' + esc(x.g.name) + ' › <a href="' + adHref(x.p, x.c, x.g, x.a) + '">' + esc(adLabel(x.p, x.a)) + '</a></td>' +
        '<td><span class="chip ok">yes</span></td><td class="num" colspan="8"><span class="dim">' + (x.p.key === 'meta' ? 'no data: account not connected' : 'no data: not launched') + '</span></td></tr>';
    });
    return h + '<h3>Breakdown · platform › campaign › ad group › ad</h3><div class="scroll"><table class="tbl bd"><thead><tr><th>Item</th><th>Lands here</th><th class="num">Sessions</th>' +
      '<th class="num">Share of ad’s sessions</th><th class="num">Form starts</th><th class="num">Form sends</th><th class="num">Spend*</th><th class="num">Leads*</th><th class="num">Calls*</th><th class="num">Signed*</th></tr></thead><tbody>' +
      rowsH + '</tbody></table></div>';
  }
  function notConnected(p) {
    return '<p class="note">' + (p.key === 'meta' ? 'No metrics: Credo’s Meta account is not connected (kept as a placeholder, operator 3 Oct). The campaign is in the upload handoff, paused.' :
      'No metrics: the Nextdoor campaigns are not launched (handoff only).') + '</p>';
  }

  /* ───────────── drawer ───────────── */
  var DR = [];   /* click handlers for items in main: data-dr="<index>" */
  function dr(fn) { DR.push(fn); return ' data-dr="' + (DR.length - 1) + '"'; }
  /* openDrawer(title, tabs, wide): tabs = [[label, html], …] (or one html string). Every entity opens on its first tab,
   * except that the tab you last picked is reopened when the next item has a tab of that name (e.g. Metrics). */
  var lastTab = (function () { try { return sessionStorage.getItem('mh-drawer-tab'); } catch (e) { return null; } })();
  function openDrawer(title, tabs, wide) {
    if (typeof tabs === 'string') tabs = [['Basic info', tabs]];
    tabs = tabs.filter(function (t) { return t && t[1]; });
    var pick = Math.max(0, tabs.map(function (t) { return t[0]; }).indexOf(lastTab));
    $('app-drawer').classList.toggle('wide', !!wide); $('drawer-title').textContent = title;
    var bar = tabs.length > 1 ? '<div class="dtabs" role="tablist">' + tabs.map(function (t, i) {
      return '<button role="tab" id="dtab-' + i + '" aria-controls="dpanel-' + i + '" aria-selected="' + (i === pick) + '" data-dtab="' + i + '">' + esc(t[0]) + '</button>'; }).join('') + '</div>' : '';
    $('drawer-body').innerHTML = bar + tabs.map(function (t, i) {
      return '<div class="dpanel" role="tabpanel" id="dpanel-' + i + '" aria-labelledby="dtab-' + i + '"' + (i === pick ? '' : ' hidden') + '>' + t[1] + '</div>'; }).join('');
    $('drawer-body').scrollTop = 0;
    var d = $('app-drawer'); d.classList.add('open'); d.setAttribute('aria-hidden', 'false'); $('drawer-close').focus();
  }
  function pickDrawerTab(i) {
    [].forEach.call(document.querySelectorAll('#drawer-body [data-dtab]'), function (b) { var on = +b.getAttribute('data-dtab') === i; b.setAttribute('aria-selected', String(on)); if (on) { lastTab = b.textContent; try { sessionStorage.setItem('mh-drawer-tab', lastTab); } catch (e) {} } });
    [].forEach.call(document.querySelectorAll('#drawer-body .dpanel'), function (p, k) { p.hidden = k !== i; });
  }
  function closeDrawer() {
    var d = $('app-drawer'); d.classList.remove('open'); d.setAttribute('aria-hidden', 'true');
    [].forEach.call(document.querySelectorAll('.sel'), function (e) { e.classList.remove('sel'); });
  }
  var kv = function (rows) { return '<dl class="kv">' + rows.filter(function (r) { return r[1] != null && r[1] !== ''; }).map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>'; };
  var link = function (u, t) { return u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(t || u) + '</a>' : dash; };
  var go = function (href, t) { return '<a class="btn" href="' + esc(href) + '">' + esc(t) + '</a>'; };

  /* ───────────── navigation tree ───────────── */
  var expanded = {}, lastCur = null;
  function nodes() {
    var web = sites.map(function (s) {
      return { label: s.label, href: '#/website/' + s.angle, count: s.pages.length,
        children: s.pages.map(function (p) { return { label: p.kind === 'service' ? p.label : p.label, href: '#/website/' + s.angle + '/' + enc(p.id), dot: p.kind === 'service' ? (p.inMenu ? 'on' : '') : null }; }) };
    });
    var ads = plats.map(function (p) {
      return { label: p.label, href: adHref(p), count: p.campaigns.length,
        children: p.campaigns.map(function (c) {
          return { label: c.name, href: adHref(p, c), count: c.groups.length, dot: c.servingNow ? 'on' : '',
            children: c.groups.map(function (g) {
              return { label: g.name, href: adHref(p, c, g), count: g.ads.length,
                children: g.ads.map(function (a) { return { label: adLabel(p, a), href: adHref(p, c, g, a), dot: a.status === 'ENABLED' ? 'on' : (/hold/i.test(a.status) ? 'hold' : '') }; }) };
            }) };
        }) };
    });
    var work = B ? [{ label: 'Board', href: '#/work', count: B.pbis.filter(function (p) { return p.visible !== false; }).length,
        children: B.pbis.filter(function (p) { return p.visible !== false; }).map(function (p) { return { label: p.id + ' · ' + p.title, href: '#/work/' + enc(p.id), dot: pbiState(p) === 'done' ? 'on' : pbiState(p) === 'doing' ? 'hold' : '' }; }) },
      { label: 'Decisions', href: '#/work/decisions', count: B.decisions.length }, { label: 'Manual steps', href: '#/work/manual', count: B.manual.length },
      { label: 'Reviews', href: '#/work/reviews', count: RV ? RV.groups.length : 0, children: RV ? RV.groups.map(function (g) { return { label: g.id + ' · ' + g.title, href: '#/work/reviews/' + enc(g.id) }; }) : [] },
      { label: 'Rules', href: '#/work/rules' }, { label: 'Change log', href: '#/work/changelog' }] : [];
    var more = [['index.html', 'Overview'], ['funnel.html', 'Funnel'], ['tracking.html', 'Tracking'], ['reference.html', 'Reference']]
      .map(function (x) { return { label: x[1], href: '#/more/' + x[0] }; });
    return [{ sec: 'Website', label: 'All microsites', href: '#/website', count: sites.length, children: web },
            { sec: 'Ads', label: 'All platforms', href: '#/ads', count: plats.length, children: ads },
            { label: 'Ads → pages → phones', href: '#/ads/phones', count: PM ? PM.rows.length : 0 },
            { sec: 'Organic' }].concat(organicNav(), [{ sec: 'Work' }], work, [{ sec: 'Reference' }, { label: 'Statutes', href: '#/reference/statutes', count: ST ? ST.statutes.length : 0 }], [{ sec: 'More' }], more);
  }
  function adLabel(p, a) { return p.key === 'google' ? (a.headlines[0] || a.name) : p.key === 'meta' ? (a.version + ' · ' + a.name.split('-').slice(0, -1).join('-').replace(/^DD_/, '')) : a.name; }
  function renderTree() {
    var cur = (location.hash || '#/website').split('?')[0], q =   /* a view's tab (?tab=…) keeps its nav entry current */ ($('app-filter').value || '').trim().toLowerCase();
    if (lastCur !== cur) { expanded[cur] = true; lastCur = cur; }   /* a newly opened item shows its children */
    var ns = nodes();
    /* open the ancestors of the current item */
    (function mark(list) { return list.some(function (n) { var hit = n.href === cur || (n.children && mark(n.children)); if (hit && n.children && n.href !== cur) expanded[n.href] = true; return hit; }); })(ns);
    function match(n) { return !q || (n.label || '').toLowerCase().indexOf(q) >= 0 || (n.children || []).some(match); }
    function li(n) {
      if (n.sec) return '<li class="sec">' + esc(n.sec) + '</li>' + (n.href ? li(Object.assign({}, n, { sec: null })) : '');
      if (!match(n)) return '';
      var kids = n.children && n.children.length, open = kids && (expanded[n.href] || !!q);
      return '<li><div class="row' + (n.href === cur ? ' cur' : '') + '">' +
        '<button class="tog' + (kids ? '' : ' leaf') + '" data-tog="' + esc(n.href) + '" aria-expanded="' + (open ? 'true' : 'false') + '" aria-label="' + (open ? 'Collapse ' : 'Expand ') + esc(n.label) + '">▶</button>' +
        '<a href="' + esc(n.href) + '"' + (n.href === cur ? ' aria-current="page"' : '') + ' title="' + esc(n.label) + '">' + (n.dot != null ? '<span class="dot ' + n.dot + '"></span>' : '') + esc(n.label) + '</a>' +
        (n.count != null ? '<span class="cnt">' + n.count + '</span>' : '') + '</div>' +
        (open ? '<ul>' + n.children.map(li).join('') + '</ul>' : '') + '</li>';
    }
    $('app-tree').innerHTML = '<ul class="tree">' + ns.map(li).join('') + '</ul>';
    var c = $('app-tree').querySelector('.row.cur'); if (c && !q) c.scrollIntoView({ block: 'nearest' });
  }

  /* ───────────── main views: website ───────────── */
  function siteSum(s) {
    var o = { spend: 0, visits: 0, sa_signed: 0, any: false };
    s.pages.forEach(function (p) { var m = pageNums(p.liveSlug); if (!m) return; o.any = true; o.spend += m.spend; o.visits += m.visits; o.sa_signed += m.sa_signed; });
    return o;
  }
  function pageNums(slug) {   /* one scope for tables and cards: measured sessions and sends, allocated spend and signed */
    var b = pageBreakdown(slug); if (!b) return null;
    if (b.pageLevel) { var r = b.pageLevel; return { spend: r.spend || 0, visits: r.visits || 0, formSubmit: r.submits || 0, sa_signed: r.signed || 0 }; }
    return { spend: b.total.cost, visits: b.total.sessions, formSubmit: b.total.formSubmit, sa_signed: b.total.sa_signed };
  }
  function viewWebsite() {
    var h = '<h1>Website</h1><p class="lead">The default site (staging’s root domain: the home page and six Defense Services pages) and the seven cluster microsites, mirrored 1:1 from staging.credolegal.com (local only). Each has a home page, about and legal pages, ' +
      'a thank-you page and its cluster’s landing pages under Services. Choose a microsite on the left to see its pages; click a card here for details and metrics.</p><div class="tiles">';
    sites.forEach(function (s) {
      var m = siteSum(s), svc = s.pages.filter(function (p) { return p.kind === 'service'; }).length;
      h += '<button class="tile"' + dr(function (el) { el.classList.add('sel'); drawerSite(s); }) + '><h3>' + esc(s.label) + '</h3><p>' + svc + ' landing pages · home copy: ' + esc(s.homeCopy) + '</p>' +
        '<div class="big">' + (m.any ? usd(m.spend) : dash) + '</div><p>spend* · ' + (m.any ? n0(m.visits) + ' sessions · ' + n1(m.sa_signed) + ' signed*' : 'no paid traffic in the period') + '</p></button>';
    });
    return h + '</div>';
  }
  function viewSite(s) {
    var h = '<h1>' + esc(s.label) + '</h1><p class="lead">Microsite <code>' + esc(s.angle) + '</code> · ' + s.pages.length + ' pages. Click a row for details and metrics; ' +
      'click a page name to open it.</p><div class="toolbar">' + go('#/website/' + s.angle + '/index', 'Open the home page') + link(STAGING + s.home, 'Home on staging ↗') + '</div>' +
      '<div class="scroll"><table class="tbl"><thead><tr><th>Page</th><th>Kind</th><th>Services menu</th><th class="num">Spend*</th><th class="num">Sessions</th><th class="num">Form sends</th><th class="num">Signed*</th></tr></thead><tbody>';
    s.pages.forEach(function (p) {
      var m = pageNums(p.liveSlug);
      h += '<tr class="clk"' + dr(function (el) { el.classList.add('sel'); drawerPage(s, p); }) + '><td><a href="#/website/' + s.angle + '/' + enc(p.id) + '">' + esc(p.label) + '</a>' +
        (p.debt ? '<div class="sub">' + esc(p.debt) + '</div>' : '') + '</td><td>' + esc(p.kind) + '</td><td>' + (p.kind !== 'service' ? '' : p.inMenu ? '<span class="chip ok">in menu</span>' : '<span class="chip">not in menu</span>') + '</td>' +
        '<td class="num">' + (m ? usd(m.spend) : dash) + '</td><td class="num">' + (m ? n0(m.visits) : dash) + '</td><td class="num">' + (m ? n0(m.formSubmit) : dash) + '</td><td class="num">' + (m ? n1(m.sa_signed) : dash) + '</td></tr>';
    });
    return h + '</tbody></table></div><p class="note">Sessions and form sends are measured on each page. * Spend and signed clients are allocated to a page by the share of each ad’s sessions that landed there (estimate).</p>';
  }
  var phoneView = (function () { try { return localStorage.getItem('mh-phone') === '1'; } catch (e) { return false; } })();
  function viewPage(s, p) {
    var base = '#/website/' + s.angle + '/' + enc(p.id), stp = ST && p.kind === 'service' ? (ST.pages[p.label] || []) : [], pads = adsForPage(p.liveSlug);
    var head = '<h1>' + esc(p.label) + '</h1>' + tabsBar(base, [['preview', 'Preview'], ['ads', 'Ads', pads.length], ['statutes', 'Statutes', stp.length]], TAB);
    if (TAB === 'ads') return head + pageAdsHtml(pads);
    if (TAB === 'statutes') return head + pageStatutesHtml(stp);
    var h = head + '<div class="toolbar">' +
      '<button class="btn" id="vw-desk" aria-pressed="' + !phoneView + '">Desktop</button><button class="btn" id="vw-phone" aria-pressed="' + phoneView + '">Phone (390 px)</button>' +
      '<button class="btn"' + dr(function () { drawerPage(s, p); }) + '>Details and metrics</button>' + link(p.file, 'Open in a new tab ↗') + link(p.staging, 'Staging ↗') +
      '<span class="frame-scale" id="frame-scale"></span></div>' +
      '<div class="frame-wrap" id="frame-wrap"><div class="frame-hold" id="frame-hold"><iframe src="' + esc(p.file) + '" title="' + esc(p.label) + '"></iframe></div></div>';
    return h;
  }
  function pageAdsHtml(list) {
    if (!list.length) return '<p class="empty">No ad points at this page.</p>';
    return '<p class="note">Every ad whose link points at this page, on every platform. Click a row for the ad’s details and metrics.</p><div class="scroll"><table class="tbl"><thead><tr><th>Platform</th><th>Campaign › ad group</th><th>Ad</th><th>Status</th>' + totalsHead + '</tr></thead><tbody>' +
      list.map(function (x) { return '<tr class="clk"' + dr(function (el) { el.classList.add('sel'); drawerAd(x.p, x.c, x.g, x.a); }) + '><td>' + esc(x.p.label) + '</td><td>' + esc(x.c.name + ' › ' + x.g.name) + '</td><td><a href="' + adHref(x.p, x.c, x.g, x.a) + '">' + esc(adLabel(x.p, x.a)) + '</a></td><td>' + statusChip(x.a.status) + '</td>' + totalsCells(x.p, [x.a.id]) + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  function pageStatutesHtml(list) {
    if (!list.length) return '<p class="empty">No statute cited on this page’s copy (or the page is not a landing page).</p>';
    return '<p class="note">The statutes this page’s copy cites: the rights rows and the common-problem cards. Click a row for the statute and the other pages that cite it.</p><div class="scroll"><table class="tbl"><thead><tr><th>Citation</th><th>Where</th><th>Says</th></tr></thead><tbody>' +
      list.map(function (c) { return '<tr class="clk"' + dr(function (el) { el.classList.add('sel'); drawerStatute(statuteFor(c.cite)); }) + '><td>' + esc(c.cite) + '</td><td>' + esc(c.kind === 'right' ? 'Your rights' : 'Common problems') + ' · ' + esc(c.label) + '</td><td class="sub">' + esc(c.text) + (c.ex ? '<div>' + esc(c.ex) + '</div>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function statuteFor(cite) { var hit = null; ST.statutes.some(function (st) { return Object.keys(st.pages).some(function (sl) { return st.pages[sl].some(function (x) { if (x.indexOf(cite + ' · ') === 0) { hit = st; return true; } return false; }); }); }); return hit; }
  function pageHref(stagingSlug) { var hit = null; sites.some(function (s) { return s.pages.some(function (p) { if (p.label === stagingSlug && p.kind === 'service') { hit = '#/website/' + s.angle + '/' + enc(p.id); return true; } return false; }); }); return hit; }
  function drawerStatute(st) {
    if (!st) return;
    var rows = Object.keys(st.pages).map(function (sl) { var hr = pageHref(sl);
      return '<tr><td>' + (hr ? '<a href="' + hr + '?tab=statutes">' + esc(sl) + '</a>' : link(STAGING + sl, sl)) + '</td><td class="sub">' + esc(st.pages[sl].join(' · ')) + '</td></tr>'; }).join('');
    openDrawer(st.key, [['Basic info', kv([['Statute', esc(st.key)], ['Citations', String(st.uses)], ['Pages', String(Object.keys(st.pages).length)]])], ['Pages', '<table class="tbl"><thead><tr><th>Page</th><th>Cited as</th></tr></thead><tbody>' + rows + '</tbody></table>']], true);
  }
  function viewStatutes() {
    if (!ST) return '<p class="empty">No statute data.</p>';
    return '<h1>Statutes</h1><p class="lead">Every statute the landing-page copy cites (rights rows and common-problem cards), with the pages that cite it. Click a row for the pages; each page has a Statutes tab too.</p>' +
      '<div class="scroll"><table class="tbl"><thead><tr><th>Statute</th><th class="num">Citations</th><th class="num">Pages</th><th>Cited as</th></tr></thead><tbody>' +
      ST.statutes.map(function (st) { var as = {}; Object.keys(st.pages).forEach(function (sl) { st.pages[sl].forEach(function (x) { as[x.split(' · ')[0]] = 1; }); });
        return '<tr class="clk"' + dr(function (el) { el.classList.add('sel'); drawerStatute(st); }) + '><td>' + esc(st.key) + '</td><td class="num">' + st.uses + '</td><td class="num">' + Object.keys(st.pages).length + '</td><td class="sub">' + esc(Object.keys(as).slice(0, 8).join(' · ')) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function fitFrame() {   /* render at the device width, scale down to the space in main */
    var wrap = $('frame-wrap'), hold = $('frame-hold'); if (!wrap || !hold) return;
    var W = phoneView ? 390 : 1440, avail = wrap.clientWidth - 28, sc = Math.min(1, avail / W);
    var Hh = Math.max(480, window.innerHeight - wrap.getBoundingClientRect().top - 40), f = hold.querySelector('iframe');
    f.style.width = W + 'px'; f.style.height = (Hh / sc) + 'px'; f.style.transform = 'scale(' + sc + ')';
    hold.style.width = Math.round(W * sc) + 'px'; hold.style.height = Hh + 'px';
    $('frame-scale').textContent = (phoneView ? 'Phone, 390 px wide' : 'Desktop, 1440 px wide') + (sc < 1 ? ', shown at ' + Math.round(sc * 100) + '%' : '');
  }
  window.addEventListener('resize', fitFrame);
  function wirePage() {
    var set = function (ph) { phoneView = ph; try { localStorage.setItem('mh-phone', ph ? '1' : '0'); } catch (e) {}
      $('vw-desk').setAttribute('aria-pressed', String(!ph)); $('vw-phone').setAttribute('aria-pressed', String(ph)); fitFrame(); };
    $('vw-desk').onclick = function () { set(false); }; $('vw-phone').onclick = function () { set(true); };
    fitFrame();
  }
  function drawerSite(s) {
    var m = siteSum(s), h = kv([['Microsite', '<code>' + esc(s.angle) + '</code>'], ['Home on staging', link(STAGING + s.home)], ['Home copy', esc(s.homeCopy)], ['Pages', String(s.pages.length)]]);
    h += '<h3>Services menu</h3><table class="tbl"><thead><tr><th>Debt type</th><th>Page in the menu</th></tr></thead><tbody>' + s.types.map(function (t) {
      return '<tr><td>' + esc(t.label) + '</td><td><a href="#/website/' + s.angle + '/' + enc('services/' + t.pick) + '">' + esc(t.pick) + '</a><div class="sub">' + esc(t.reason) + '</div></td></tr>'; }).join('') + '</tbody></table>';
    var mh = '<h3>Metrics · ' + esc(periodLabel()) + ' (landing pages summed)</h3>' + (m.any ? '<div class="mgrid">' + mt('Spend*', usd(m.spend)) + mt('Sessions', n0(m.visits)) + mt('Signed*', n1(m.sa_signed)) + '</div><p class="note">* allocated to the pages by each ad’s share of sessions (estimate).</p>' : '<p class="note">No paid traffic in this period.</p>');
    h += '<div class="toolbar">' + go('#/website/' + s.angle, 'Open the microsite') + '</div>';
    openDrawer(s.label, [['Basic info', h], ['Metrics', mh]]);
  }
  function drawerPage(s, p) {
    var ph = p.reg ? Object.keys(p.reg.phones || {}).map(function (k) { return k + ' ' + p.reg.phones[k]; }).join(' · ') : '';
    var h = kv([['Microsite', esc(s.label)], ['Kind', esc(p.kind)], ['Debt type', esc(p.debt || '')], ['Services menu', p.kind === 'service' ? (p.inMenu ? 'yes · ' : 'no · ') + esc(p.reason || '') : ''],
      ['Staging', link(p.staging)], ['Live (start)', p.live ? link(p.live) : ''], ['Local file', link(p.file)], ['Tracking numbers', esc(ph)],
      ['Angle score', p.reg && p.reg.score != null ? esc(p.reg.score) : '']]);
    var ads = adsForPage(p.liveSlug);
    h += '<h3>Ads pointing here</h3>' + (ads.length ? '<ul class="notes">' + ads.map(function (x) {
      return '<li><a href="' + adHref(x.p, x.c, x.g, x.a) + '">' + esc(x.p.label + ' · ' + x.c.name + ' › ' + x.g.name) + '</a> <span class="sub">' + esc(adLabel(x.p, x.a)) + '</span></li>'; }).join('') + '</ul>' : '<p class="note">None.</p>');
    h += '<div class="toolbar">' + go('#/website/' + s.angle + '/' + enc(p.id), 'Open the page') + '</div>';
    openDrawer(p.label, [['Basic info', h], ['Metrics', pageMetricsHtml(p.liveSlug)], ['Comments', commentsTab('page:' + (p.kind === 'service' ? p.label : s.angle + '/' + p.id))]], true);
  }

  /* ───────────── main views: ads ───────────── */
  function totalsCells(p, ids) {
    if (p.key !== 'google') return '<td class="num">' + dash + '</td><td class="num">' + dash + '</td><td class="num">' + dash + '</td><td class="num">' + dash + '</td>';
    var m = gPeriod(ids), a = gAll(ids);
    return '<td class="num">' + (m ? usd(m.cost) : dash) + '</td><td class="num">' + (m ? n1(m.form) : dash) + '</td><td class="num">' + (m ? n1(m.sa_signed) : dash) + '</td><td class="num">' + (a ? usd(a.cost) : dash) + '</td>';
  }
  var totalsHead = '<th class="num">Spend (period)</th><th class="num">Form leads</th><th class="num">Signed</th><th class="num">Spend (all time)</th>';
  var ids = function (node) { return allAds(node).map(function (a) { return a.id; }); };
  function viewAds() {
    var h = '<h1>Ads</h1><p class="lead">Every campaign on the three platforms: Google (live account, read-only), Meta (the one consolidated campaign, paused in the handoff) and Nextdoor ' +
      '(handoff, not launched). Choose a platform, campaign, ad group or ad on the left. Click a card here for details.</p><div class="tiles">';
    plats.forEach(function (p) {
      var m = p.key === 'google' ? gPeriod(ids(p)) : null, n = allAds(p).length, g = p.campaigns.reduce(function (t, c) { return t + c.groups.length; }, 0);
      h += '<button class="tile"' + dr(function (el) { el.classList.add('sel'); drawerPlatform(p); }) + '><h3>' + esc(p.label) + '</h3><p>' + p.campaigns.length + ' campaigns · ' + g + ' ad ' + (p.key === 'meta' ? 'sets' : 'groups') + ' · ' + n + ' ads</p>' +
        '<div class="big">' + (m ? usd(m.cost) : dash) + '</div><p>' + (m ? 'spend · ' + n1(m.sa_signed) + ' signed · ' + esc(periodLabel()) : esc(p.connection)) + '</p></button>';
    });
    return h + '</div>';
  }
  function drawerPlatform(p) {
    var h = kv([['Connection', esc(p.connection)], ['Source', esc(p.source)], ['Campaigns', String(p.campaigns.length)], ['Ads', String(allAds(p).length)]]);
    openDrawer(p.label, [['Basic info', h + '<div class="toolbar">' + go(adHref(p), 'Open ' + p.label) + '</div>'], ['Metrics', p.key === 'google' ? gMetricsHtml(ids(p)) : notConnected(p)]]);
  }
  function viewPlatform(p) {
    var ho = p.handoff, mb = ho ? (ho.size >= 1e6 ? (ho.size / 1e6).toFixed(1) + ' MB' : Math.round(ho.size / 1e3) + ' KB') : '';
    var h = '<div class="pagehead"><h1>' + esc(p.label) + '</h1>' + (ho ? '<a class="btn dl" href="' + esc(ho.url) + '" download>Download Hand-Off ↓</a>' +
      '<a class="btn" href="' + esc(ho.guide) + '" target="_blank" rel="noopener">Hand-off guide ↗</a><span class="sub">' + esc(ho.file + ' · ' + mb + ' · ' + ho.updated) + '</span>' : '') + '</div>' +
      (ho ? '<p class="note">' + esc(ho.note) + '</p>' : '') + '<p class="lead">' + esc(p.connection) + '. Click a row for details and metrics; click a campaign name to open it.</p>' +
      (p.key === 'google' && STG() ? tabsBar(adHref(p), [['campaigns', 'Campaigns', p.campaigns.length], ['findings', 'Account findings', STG().findings.length]], TAB) : '');
    if (p.key === 'google' && TAB === 'findings') return h + findingsHtml();
    h += 
      '<div class="scroll"><table class="tbl"><thead><tr><th>Campaign</th><th>Type</th><th>Status</th><th class="num">' + (p.key === 'meta' ? 'Ad sets' : 'Ad groups') + '</th><th class="num">Ads</th>' + totalsHead + '</tr></thead><tbody>';
    p.campaigns.forEach(function (c) {
      h += '<tr class="clk"' + dr(function (el) { el.classList.add('sel'); drawerCampaign(p, c); }) + '><td><a href="' + adHref(p, c) + '">' + esc(c.name) + '</a></td><td>' + esc(c.kind) + '</td><td>' +
        (p.key === 'google' ? (c.servingNow ? '<span class="chip ok">serving</span>' : '<span class="chip">last ' + esc(c.lastServed || 'never') + '</span>') : '<span class="chip warn">not launched</span>') + '</td>' +
        '<td class="num">' + c.groups.length + '</td><td class="num">' + allAds(c).length + '</td>' + totalsCells(p, ids(c)) + '</tr>';
    });
    return h + '</tbody></table></div>';
  }
  function infoKv(info) { return kv(Object.keys(info).map(function (k) { var v = info[k]; return [k, /^https?:/.test(String(v)) ? link(v) : esc(v)]; })); }
  function drawerCampaign(p, c) {
    var h = infoKv(c.info) + (c.notes ? '<h3>Notes</h3><ul class="notes">' + c.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' : '');
    openDrawer(c.name, [['Basic info', h + '<div class="toolbar">' + go(adHref(p, c), 'Open the campaign') + '</div>'], ['Metrics', p.key === 'google' ? gMetricsHtml(ids(c)) : notConnected(p)]]);
  }
  function viewCampaign(p, c) {
    var unit = p.key === 'meta' ? 'Ad sets' : 'Ad groups';
    var h = '<h1>' + esc(c.name) + '</h1><p class="lead">' + esc(p.label) + ' campaign · ' + esc(c.kind) + (c.planned ? ' · <span class="chip warn">planned, not live</span>' : '') + '. Click a row for details and metrics; click a name to open it.</p>' + infoKv(c.info) +
      (c.notes ? '<ul class="notes">' + c.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' : '');
    if (p.key === 'google') {
      h += tabsBar(adHref(p, c), [['groups', unit, c.groups.length], ['extensions', 'Extensions', (c.extensions || []).length], ['images', 'Images', (c.images || []).length]], TAB);
      if (TAB === 'extensions') return h + extensionsHtml(c);
      if (TAB === 'images') return h + imagesHtml(c);
    } else h += '<h2>' + unit + '</h2>';
    h += '<div class="scroll"><table class="tbl"><thead><tr><th>' + unit.slice(0, -1) + '</th><th class="num">Ads</th>' + totalsHead + '</tr></thead><tbody>';
    c.groups.forEach(function (g) {
      h += '<tr class="clk"' + dr(function (el) { el.classList.add('sel'); drawerGroup(p, c, g); }) + '><td><a href="' + adHref(p, c, g) + '">' + esc(g.name) + '</a>' +
        (g.info.Concept ? '<div class="sub">' + esc(g.info.Concept) + '</div>' : '') + '</td><td class="num">' + g.ads.length + '</td>' + totalsCells(p, ids(g)) + '</tr>';
    });
    return h + '</tbody></table></div>';
  }
  function extensionsHtml(c) {
    var ex = c.extensions || []; if (!ex.length) return '<p class="empty">No extensions in the Google hand-off for this campaign.</p>';
    var by = {}; ex.forEach(function (x) { (by[x[0]] = by[x[0]] || []).push(x[1]); });
    return '<p class="note">From the Google hand-off (July build). Live sitelinks are on each ad’s Preview tab.</p>' + Object.keys(by).map(function (t) {
      return '<h3>' + esc(t) + ' (' + by[t].length + ')</h3><div class="chips">' + by[t].map(function (v) { return '<span class="xchip">' + esc(v) + '</span>'; }).join('') + '</div>'; }).join('');
  }
  function imagesHtml(c) {
    var im = c.images || []; if (!im.length) return '<p class="empty">No images in the Google hand-off for this campaign.</p>';
    return '<p class="note">From the Google hand-off (July build).</p><div class="thumbs">' + im.map(function (x) {
      return '<button class="thumb"' + dr(function (el) { el.classList.add('sel'); openDrawer('Image · ' + c.name, [['Basic info', media(x[1]) + kv([['Role', esc(x[0])], ['File', link(x[1], x[1].split('/').pop())]])]]); }) + '>' + media(x[1], x[0]) + '<div class="cap">' + esc(x[0]) + '</div></button>'; }).join('') + '</div>';
  }


  function drawerGroup(p, c, g) {
    openDrawer(g.name, [['Basic info', infoKv(g.info) + '<div class="toolbar">' + go(adHref(p, c, g), 'Open the ' + (p.key === 'meta' ? 'ad set' : 'ad group')) + '</div>'],
      ['Metrics', p.key === 'google' ? gMetricsHtml(ids(g)) : notConnected(p)], ['Comments', commentsTab('adset:' + g.key)]]);
  }
  function viewGroup(p, c, g) {
    var h = '<h1>' + esc(g.name) + '</h1><p class="lead">' + (p.key === 'meta' ? 'Ad set' : 'Ad group') + ' in ' + esc(c.name) + '. Click a row for details and metrics; click an ad to see its variants.</p>' + infoKv(g.info);
    if (p.key === 'google') {
      var terms = groupTerms(c, g), kws = groupKeywords(g);
      h += tabsBar(adHref(p, c, g), [['ads', 'Ads', g.ads.length], ['terms', 'Search terms', terms.length], ['keywords', 'Keywords', kws.length]], TAB);
      if (TAB === 'terms') return h + termsTable(c, g, terms);
      if (TAB === 'keywords') return h + keywordsTable(kws, true);
    }
    h += '<div class="scroll"><table class="tbl"><thead><tr><th>Ad</th><th>Status</th><th>Landing page</th>' + (p.key === 'google' ? '<th>Strength</th>' : '') + totalsHead + '</tr></thead><tbody>';
    g.ads.forEach(function (a) {
      h += '<tr class="clk"' + dr(function (el) { el.classList.add('sel'); drawerAd(p, c, g, a); }) + '><td><a href="' + adHref(p, c, g, a) + '">' + esc(adLabel(p, a)) + '</a><div class="sub">' + esc(a.name) + '</div></td>' +
        '<td>' + statusChip(a.status) + '</td><td class="sub">' + esc(a.slug ? a.slug : a.host || '') + '</td>' + (p.key === 'google' ? '<td>' + esc(a.strength || '') + '</td>' : '') + totalsCells(p, [a.id]) + '</tr>';
    });
    return h + '</tbody></table></div>';
  }
  /* ── search terms and keywords (MH-11 D2: the search-term review, per ad group) ── */
  function STG() { return AM && AM.google.st ? AM.google.st : null; }
  var ACTION = { keep: ['keep', 'ok'], keep_test: ['keep · A/B test', 'ok'], covered: ['covered', ''], none: ['no action', ''], skip: ['skip', ''], consider: ['consider', 'warn'],
    review: ['review', 'warn'], route: ['route to a better page', 'warn'], move: ['move to its ad group', 'warn'], add_kw: ['add as keyword', 'warn'], bid_down: ['bid down', 'warn'],
    new_page: ['needs a new page', 'warn'], neg_here: ['negative here', 'red'], negative: ['negative', 'red'] };
  var actChip = function (a) { var x = ACTION[a] || [a, '']; return '<span class="chip ' + x[1] + '">' + esc(x[0]) + '</span>'; };
  function groupTerms(c, g) { var st = STG(); return st ? (st.groups[c.name + '|' + g.name] || []) : []; }
  function groupKeywords(g) {
    if (!AM || !AM.google.kw) return []; var by = {};
    g.ads.forEach(function (a) { (AM.google.kw[a.id] || []).forEach(function (k) { var key = k[0] + '|' + k[1], o = by[key] || (by[key] = { kw: k[0], match: k[1], impr: 0, clicks: 0, cost: 0, conv: 0, ads: [] });
      o.impr += k[2]; o.clicks += k[3]; o.cost += k[4]; o.conv += k[5]; o.ads.push(adLabel(platBy.google, a)); }); });
    return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.impr - a.impr; });
  }
  function keywordsTable(kws, withAds) {
    if (!kws.length) return '<p class="empty">No keyword data for the last 90 days.</p>';
    return '<p class="note">Keywords and the ad they served, last 90 days (keyword_view by ad).</p><div class="scroll"><table class="tbl"><thead><tr><th>Keyword</th><th>Match</th>' + (withAds ? '<th>Ads</th>' : '') +
      '<th class="num">Impr.</th><th class="num">Clicks</th><th class="num">CTR</th><th class="num">Spend</th><th class="num">Conv.</th><th class="num">Cost / conv.</th></tr></thead><tbody>' +
      kws.map(function (k) { return '<tr><td>' + esc(k.kw) + '</td><td>' + esc(k.match.toLowerCase()) + '</td>' + (withAds ? '<td class="sub">' + esc(k.ads.join(' · ')) + '</td>' : '') +
        '<td class="num">' + n0(k.impr) + '</td><td class="num">' + n0(k.clicks) + '</td><td class="num">' + pct(k.clicks, k.impr) + '</td><td class="num">' + usd(k.cost) + '</td><td class="num">' + n1(k.conv) + '</td><td class="num">' + per(k.cost, k.conv) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function termsTable(c, g, terms) {
    var st = STG(); if (!terms.length) return '<p class="empty">No search terms recorded for this ad group.</p>';
    return '<p class="note">Search terms ' + esc(st.period.active) + ' (active) and ' + esc(st.period.history) + ' (paused campaigns), with the action from the 30 Sep review. Click a term for its keywords, analysis and metrics.</p>' +
      '<div class="scroll"><table class="tbl"><thead><tr><th>Search term</th><th>Intent</th><th class="num">Impr.</th><th class="num">Clicks</th><th class="num">CTR</th><th class="num">Spend</th><th class="num">Conv.</th><th>Action</th></tr></thead><tbody>' +
      terms.map(function (t) { var feat = st.featured[c.name + '|' + g.name + '|' + t.term];
        return '<tr class="clk"' + dr(function (el) { el.classList.add('sel'); drawerTerm(c, g, t); }) + '><td>' + esc(t.term) + (feat ? ' <span class="chip ok">analysed</span>' : '') + (t.dup ? ' <span class="chip warn">also elsewhere</span>' : '') + '</td><td class="sub">' + esc(intentLabel(t.intent)) + '</td>' +
          '<td class="num">' + n0(t.impr) + '</td><td class="num">' + n0(t.clicks) + '</td><td class="num">' + pct(t.clicks, t.impr) + '</td><td class="num">' + usd(t.cost) + '</td><td class="num">' + n1(t.conv) + '</td><td>' + actChip(t.action) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function intentLabel(k) { var st = STG(), i = st && st.intents[k]; return i ? i.label : (k || ''); }
  function pageLabel(code) { var st = STG(), pg = st && st.pages[code]; return pg ? pg.label + (pg.url ? ' · ' + pg.url.replace(/^https?:\/\//, '') : '') : code; }
  function drawerTerm(c, g, t) {
    var st = STG(), feat = st.featured[c.name + '|' + g.name + '|' + t.term], it = st.intents[t.intent] || {};
    var info = kv([['Search term', esc(t.term)], ['Campaign › ad group', esc(c.name + ' › ' + g.name)], ['Scope', esc(t.scope === 'active' ? 'active (last 90 days)' : 'paused campaign (all time)')],
      ['Intent', esc(intentLabel(t.intent)) + (it.why ? '<div class="sub">' + esc(it.why) + '</div>' : '')], ['Debt type', esc(t.debtType || '')],
      ['Lands on now', esc((t.current || []).map(function (x) { return pageLabel(x.page) + ' (' + x.share + '%)'; }).join('; '))], ['Best page', esc(pageLabel(t.best))],
      ['Action', actChip(t.action) + (t.actionText ? '<div>' + esc(t.actionText) + '</div>' : '')], ['Runs in another ad group too', t.dup ? 'yes' : 'no']]);
    var an = feat ? '<p>' + esc(feat.analysis) + '</p>' + (feat.ad ? '<h3>Recommended ad (draft, attorney review before use)</h3><div class="copy">' + esc((feat.ad.h || []).join(' | ')) + '\n' + esc(feat.ad.d || '') + '</div>' : '') +
      (feat.lp && feat.lp.note ? '<h3>Landing page</h3><p>' + esc(feat.lp.note) + '</p>' : '') : '';
    var met = '<div class="mgrid">' + mt('Impressions', n0(t.impr)) + mt('Clicks', n0(t.clicks)) + mt('CTR', pct(t.clicks, t.impr)) + mt('Spend', usd(t.cost)) + mt('Conversions', n1(t.conv)) +
      mt('Cost / conv.', per(t.cost, t.conv)) + mt('Top-of-page rate', t.top30 != null ? Math.round(t.top30 * 100) + '%' : dash) + '</div>';
    var kw = keywordsTable((t.keywords || []).map(function (k) { return { kw: k[0], match: k[1], impr: k[2], clicks: k[3], cost: k[4], conv: k[5], ads: [] }; }), false);
    openDrawer(t.term, [['Basic info', info], ['Analysis', an], ['Metrics', met], ['Keywords', kw]], true);
  }
  function findingsHtml() {
    var st = STG(); return '<h2>Account findings (search-term review, 30 Sep)</h2>' + st.findings.map(function (x) { return '<div class="card finding"><h3>' + esc(x.t) + '</h3><p>' + esc(x.b) + '</p></div>'; }).join('');
  }
  function statusChip(s) { return /ENABLED/.test(s) ? '<span class="chip ok">enabled</span>' : /PAUSED/.test(s) ? '<span class="chip warn">' + esc(s.toLowerCase()) + '</span>' : '<span class="chip">' + esc(String(s || '').toLowerCase()) + '</span>'; }
  function drawerAd(p, c, g, a) {
    var h = kv([['Ad', esc(a.name)], ['Type', esc(a.type)], ['Status', statusChip(a.status)], ['Landing page', link(a.url)], ['URL parameters', esc(a.params || '')],
      ['Ad strength', esc(a.strength || '')], ['Approval', esc(a.approval || '')], ['Headline', esc(a.headline || '')], ['Description', esc(a.description || '')], ['Creative version', esc(a.version || '')]]);
    var site = landingSite(a); if (site) h += '<p class="note">This landing page is in the Website section: <a href="' + site + '">open it</a>.</p>';
    var kwTab = p.key === 'google' && AM && AM.google.kw ? keywordsTable((AM.google.kw[a.id] || []).map(function (k) { return { kw: k[0], match: k[1], impr: k[2], clicks: k[3], cost: k[4], conv: k[5], ads: [] }; }), false) : null;
    var cTab = ['Comments', commentsTab('ad:' + p.key + ':' + a.id)];
    openDrawer(adLabel(p, a), [['Basic info', h + '<div class="toolbar">' + go(adHref(p, c, g, a), 'Show the ad variants') + '</div>'], ['Metrics', p.key === 'google' ? gMetricsHtml([a.id]) : notConnected(p)], kwTab ? ['Keywords', kwTab] : null, cTab], !!kwTab);
  }
  function landingSite(a) {   /* the microsite page for an ad's landing page, if the Website section has it */
    if (!a.slug) return null; var hit = null;
    sites.some(function (s) { return s.pages.some(function (p) { if (p.liveSlug === a.slug || (p.kind === 'service' && p.id === 'services/' + a.slug)) { hit = '#/website/' + s.angle + '/' + enc(p.id); return true; } return false; }); });
    return hit;
  }

  /* ad variants */
  function viewAd(p, c, g, a) {
    var h = '<h1>' + esc(adLabel(p, a)) + '</h1><p class="lead">' + esc(p.label) + ' · ' + esc(c.name) + ' › ' + esc(g.name) + '. The variants of this ad; click one for details and metrics.</p>' +
      '<div class="toolbar"><button class="btn"' + dr(function () { drawerAd(p, c, g, a); }) + '>Ad details and metrics</button>' + link(a.url, 'Landing page ↗') + '</div>';
    if (p.key === 'google' && a.type === 'ASSET_GROUP') return h + assetGroupVariants(a);
    if (p.key === 'google') {
      h += tabsBar(adHref(p, c, g, a), [['variants', 'Variants'], ['preview', 'Preview']], TAB);
      if (TAB === 'preview') { AFTER = function () { wirePreview(c, a); }; return h + previewHtml(a); }
      return h + googleVariants(a);
    }
    if (p.key === 'meta') return h + metaVariants(p, a);
    return h + ndVariants(p, a);
  }
  /* Preview (MH-11 D3, the ad builder): pick headlines and descriptions, see the ad as served with its sitelinks and callouts */
  var AFTER = null;
  function previewHtml(a) {
    var sel = function (id, list, pick) { return '<select id="' + id + '">' + list.map(function (t, i) { return '<option value="' + i + '"' + (i === pick ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>'; };
    var top = topCombo(a), H = a.headlines, D = a.descriptions;
    return '<p class="note">Pick headlines and descriptions to see the ad the way Google shows it. It starts on the combination Google showed most in the last 90 days.</p>' +
      '<div class="builder"><label>Headline 1 ' + sel('pv-h1', H, top.h[0]) + '</label><label>Headline 2 ' + sel('pv-h2', H, top.h[1]) + '</label><label>Headline 3 ' + sel('pv-h3', ['(none)'].concat(H), top.h[2] + 1) + '</label>' +
      '<label>Description 1 ' + sel('pv-d1', D, top.d[0]) + '</label><label>Description 2 ' + sel('pv-d2', ['(none)'].concat(D), top.d[1] + 1) + '</label></div>' +
      '<div class="serp" id="pv-serp"></div><p class="note" id="pv-len"></p>';
  }
  function topCombo(a) {
    var o = { h: [0, Math.min(1, a.headlines.length - 1), -1], d: [0, a.descriptions.length > 1 ? 1 : -1] };
    var m = AM && AM.google.ads[a.id]; if (!m || !m.combos.length) return o;
    var byId = {}; m.assets.forEach(function (x) { byId[x.id] = x; });
    var hs = [], ds = []; m.combos[0].assets.forEach(function (x) { var as = byId[x[0]]; if (!as) return;
      var i = (as.field === 'HEADLINE' ? a.headlines : a.descriptions).indexOf(as.text); if (i < 0) return; (as.field === 'HEADLINE' ? hs : ds).push(i); });
    if (hs.length) o.h = [hs[0], hs[1] != null ? hs[1] : o.h[1], hs[2] != null ? hs[2] : -1]; if (ds.length) o.d = [ds[0], ds[1] != null ? ds[1] : -1];
    return o;
  }
  function wirePreview(c, a) {
    var reg = Hub.adsBy['google:' + a.id] || {}, call = (c.extensions || []).filter(function (x) { return x[0] === 'Callout'; }).map(function (x) { return x[1]; }).slice(0, 4);
    var host = (a.host || '').replace(/^www\./, ''), path = (a.slug || '').split('/').slice(0, 2).join('/');
    function draw() {
      var v = function (id) { return +$(id).value; }, hs = [a.headlines[v('pv-h1')], a.headlines[v('pv-h2')]].concat(v('pv-h3') ? [a.headlines[v('pv-h3') - 1]] : []);
      var ds = [a.descriptions[v('pv-d1')]].concat(v('pv-d2') ? [a.descriptions[v('pv-d2') - 1]] : []);
      $('pv-serp').innerHTML = '<div class="sp-top"><span class="sp-badge">Sponsored</span></div><div class="sp-site"><span class="sp-ico">C</span><div><b>Credo Legal</b><div class="sp-url">' + esc(host) + (path ? ' › ' + esc(path.replace(/-/g, ' ')) : '') + '</div></div></div>' +
        '<a class="sp-hl" href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(hs.join(' | ')) + '</a><div class="sp-desc">' + esc(ds.join(' ')) + '</div>' +
        (call.length ? '<div class="sp-call">' + esc(call.join(' · ')) + '</div>' : '') +
        ((reg.sitelinks || []).length ? '<div class="sp-links">' + reg.sitelinks.slice(0, 4).map(function (sl) { return '<a href="https://start.credolegal.com/' + esc(sl) + '" target="_blank" rel="noopener">' + esc(sl.replace(/-/g, ' ')) + '</a>'; }).join('') + '</div>' : '');
      $('pv-len').textContent = 'Headlines ' + hs.map(function (t) { return t.length; }).join(' / ') + ' characters (limit 30 each) · descriptions ' + ds.map(function (t) { return t.length; }).join(' / ') + ' (limit 90 each).' +
        (reg.phone ? ' Call number for this ad group: ' + reg.phone + '.' : '');
    }
    ['pv-h1', 'pv-h2', 'pv-h3', 'pv-d1', 'pv-d2'].forEach(function (id) { $(id).addEventListener('change', draw); }); draw();
  }
  function assetGroupVariants(a) {   /* planned Performance Max asset group */
    var imgs = []; Object.keys(a.images || {}).forEach(function (r) { (a.images[r] || []).forEach(function (u) { imgs.push([r, u]); }); });
    var list = function (title, arr) { return '<h2>' + title + ' (' + arr.length + ')</h2><div class="tiles">' + arr.map(function (t, i) { return '<div class="tile text"><p>' + (i + 1) + ' · ' + t.length + ' chars</p><h3>' + esc(t) + '</h3></div>'; }).join('') + '</div>'; };
    return '<p class="note"><span class="chip warn">planned</span> Performance Max asset group from the Google hand-off; not in the live account. Copy needs the attorney’s read before use.</p>' +
      list('Headlines', a.headlines) + list('Long headlines', a.longHeadlines) + list('Descriptions', a.descriptions) +
      '<h2>Images (' + imgs.length + ')</h2><div class="thumbs">' + imgs.map(function (x) { return '<div class="thumb">' + media(x[1], x[0]) + '<div class="cap">' + esc(x[0]) + '</div></div>'; }).join('') + '</div>';
  }
  function googleVariants(a) {
    var assets = AM && AM.google.ads[a.id] ? AM.google.ads[a.id].assets : [], combos = AM && AM.google.ads[a.id] ? AM.google.ads[a.id].combos : [];
    var byText = {}, byId = {}; assets.forEach(function (x) { byText[x.field + '|' + x.text] = x; byId[x.id] = x; });
    var totalImpr = assets.filter(function (x) { return x.field === 'HEADLINE'; }).reduce(function (t, x) { return t + (x.impr || 0); }, 0);
    var sg = AM && AM.google.suggest ? AM.google.suggest[a.id] : null, flag = {};
    if (sg) sg.items.forEach(function (it) { flag[it.field + '|' + it.remove.text] = it; });
    function card(field, t, i) {
      var m = byText[field + '|' + t] || null, pin = (a.pins.filter(function (x) { return x[0] === t; })[0] || [])[1], it = flag[field + '|' + t];
      return '<button class="tile text' + (it ? ' out' : '') + '"' + dr(function (el) { el.classList.add('sel'); if (it) drawerSuggest(a, it, m, totalImpr); else drawerAsset(a, field, t, m, totalImpr, pin); }) + '><p>' + (field === 'HEADLINE' ? 'Headline ' : 'Description ') + (i + 1) + ' · ' + t.length + ' chars' + (pin ? ' · pinned ' + esc(pin) : '') + '</p>' +
        '<h3>' + esc(t) + '</h3><div class="meta">' + (m && m.impr != null ? n0(m.impr) + ' impr. · ' + n0(m.clicks) + ' clicks · ' + n1(m.conv) + ' conv.' : 'no impressions recorded') + '</div>' +
        (it ? '<div class="meta"><span class="chip red">remove · ' + esc(it.remove.kind === 'risk' ? 'risky claim' : 'weak performer') + '</span></div>' : '') + '</button>';
    }
    var h = suggestHtml(a, sg, byText, totalImpr) + '<h2>Headlines (' + a.headlines.length + ')</h2><div class="tiles">' + a.headlines.map(function (t, i) { return card('HEADLINE', t, i); }).join('') + '</div>' +
      '<h2>Descriptions (' + a.descriptions.length + ')</h2><div class="tiles">' + a.descriptions.map(function (t, i) { return card('DESCRIPTION', t, i); }).join('') + '</div>';
    h += '<h2>Top combinations shown · last 90 days</h2>' + (combos.length ? '<div class="tiles">' + combos.map(function (cb, i) {
      var parts = cb.assets.map(function (x) { var as = byId[x[0]]; return as ? [x[1], as.text] : null; }).filter(Boolean);
      return '<button class="tile text"' + dr(function (el) { el.classList.add('sel'); drawerCombo(a, cb, parts, combos); }) + '><p>Combination ' + (i + 1) + ' · ' + n0(cb.impr) + ' impressions</p><h3>' +
        esc(parts.filter(function (x) { return /HEADLINE/.test(x[0]); }).map(function (x) { return x[1]; }).join(' | ')) + '</h3><div class="meta">' +
        esc(parts.filter(function (x) { return /DESCRIPTION/.test(x[0]); }).map(function (x) { return x[1]; }).join(' ')) + '</div></button>';
    }).join('') + '</div>' : '<p class="empty">No combination reached 10 impressions in the last 90 days.</p>');
    return h;
  }
  /* MH-12: suggested copy changes (tools/marketing-hub/suggest-copy.mjs). Drafts only; nothing is changed in Google Ads. */
  function suggestHtml(a, sg, byText, totalImpr) {
    if (!sg) return '';
    var nH = sg.items.filter(function (x) { return x.field === 'HEADLINE'; }).length, nD = sg.items.length - nH;
    var cnt = function (n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); };
    var h = '<h2>Suggested changes</h2>';
    if (!sg.items.length) return h + '<p class="note">Nothing to replace: no risky claims, and no line clearly below this ad’s median.' + (sg.notes.length ? ' ' + esc(sg.notes.join(' ')) : '') + '</p>';
    h += '<p class="lead">Replace ' + cnt(nH, 'headline') + ' and ' + cnt(nD, 'description') + '. <b>Drafts for attorney review; nothing has been changed in Google Ads.</b></p><ul class="note sugg-how">' +
      '<li>What goes: every risky claim, then the weakest lines (fewest conversions per 1,000 impressions, all time, clearly below this ad’s median) until 3 headlines and 1 description are replaced.</li>' +
      '<li>What comes in: the copy recommended for the searches this ad group gets (' + esc(sg.intents.slice(0, 3).map(function (x) { return x.label; }).join(', ')) + ').</li>' +
      '<li>Editing an ad makes Google treat it as a new ad with fresh statistics. You can instead add the changed version as a second ad in the group, and pause this one once the new ad has data.</li>' +
      sg.notes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    h += '<div class="scroll"><table class="tbl sugg"><thead><tr><th></th><th>Remove</th><th>Why</th><th>Add</th><th class="num">Chars</th></tr></thead><tbody>' + sg.items.map(function (it) {
      var m = byText[it.field + '|' + it.remove.text] || null;
      return '<tr class="clk"' + dr(function (el) { el.classList.add('sel'); drawerSuggest(a, it, m, totalImpr); }) + '><td class="sub">' + (it.field === 'HEADLINE' ? 'Headline' : 'Description') + (it.remove.pin ? '<br>pinned ' + esc(it.remove.pin) : '') + '</td>' +
        '<td class="rm">' + esc(it.remove.text) + '</td><td class="sub"><span class="chip ' + (it.remove.kind === 'risk' ? 'red' : 'warn') + '">' + (it.remove.kind === 'risk' ? 'risky claim' : 'weak performer') + '</span><div>' + esc(it.remove.short) + '</div></td>' +
        '<td class="ad">' + (it.add ? esc(it.add.text) + '<div class="sub">' + esc(it.add.intentLabel) + '</div>' : '<span class="dim">no replacement yet</span>') + '</td><td class="num">' + (it.add ? it.add.chars + ' / ' + (it.field === 'HEADLINE' ? 30 : 90) : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
    return h;
  }
  function drawerSuggest(a, it, m, totalImpr) {
    var lim = it.field === 'HEADLINE' ? 30 : 90;
    var h = '<h3>Remove</h3><div class="copy">' + esc(it.remove.text) + '</div>' + kv([['Field', it.field.toLowerCase()], ['Reason', (it.remove.kind === 'risk' ? 'risky claim' : 'weak performer') + '. ' + esc(it.remove.why)], ['Pinned', esc(it.remove.pin || 'no')]]) +
      '<h3>Add</h3>' + (it.add ? '<div class="copy">' + esc(it.add.text) + '</div>' + kv([['Length', it.add.chars + ' of ' + lim + ' characters'], ['From', 'the copy recommended for “' + esc(it.add.intentLabel) + '” searches (search-term review, 30 Sep)'],
        ['Pin', esc(it.add.pin ? 'takes over ' + it.add.pin : 'none')], ['Status', 'draft for attorney review; not in Google Ads']]) : '<p class="note">No replacement left in the recommended copy for this ad group. Remove only if the ad keeps at least 3 headlines and 2 descriptions.</p>');
    var mh = '<h3>The line to remove · all time · asset view</h3>' + (m && m.impr != null ? '<div class="mgrid">' + mt('Impressions', n0(m.impr)) + mt('Clicks', n0(m.clicks)) + mt('CTR', pct(m.clicks, m.impr)) +
      mt('Spend', usd(m.cost)) + mt('Conversions', n1(m.conv)) + mt('Conv. / 1,000 impr.', m.impr ? (m.conv / m.impr * 1000).toFixed(1) : '–') + '</div>' +
      (it.remove.median != null ? '<p class="note">Median for this ad’s ' + (it.field === 'HEADLINE' ? 'headlines' : 'descriptions') + ': ' + it.remove.median.toFixed(1) + ' conversions per 1,000 impressions.</p>' : '') : '<p class="note">No impressions recorded for this line.</p>') +
      '<p class="note">The new line has no data yet.</p>';
    openDrawer('Suggested change', [['Basic info', h], ['Metrics', mh]]);
  }
  function drawerAsset(a, field, t, m, totalImpr, pin) {
    var h = '<div class="copy">' + esc(t) + '</div>' + kv([['Field', field.toLowerCase()], ['Length', t.length + ' characters'], ['Pinned', esc(pin || 'no')], ['Asset id', esc(m ? m.id : '')]]);
    var mh = '<h3>All time · asset view</h3>' + (m && m.impr != null ? '<div class="mgrid">' + mt('Impressions', n0(m.impr)) + mt('Clicks', n0(m.clicks)) + mt('CTR', pct(m.clicks, m.impr)) +
      mt('Spend', usd(m.cost)) + mt('Conversions', n1(m.conv)) + mt('Cost / conv.', per(m.cost, m.conv)) + '</div>' +
      (field === 'HEADLINE' && totalImpr ? '<p class="note">Share of this ad’s headline impressions: ' + pct(m.impr, totalImpr) + '. Google counts an impression for every headline shown, so shares overlap across positions.</p>' : '')
      : '<p class="note">No impressions recorded for this asset.</p>');
    openDrawer(field === 'HEADLINE' ? 'Headline' : 'Description', [['Basic info', h], ['Metrics', mh]]);
  }
  function drawerCombo(a, cb, parts, combos) {
    var tot = combos.reduce(function (t, x) { return t + x.impr; }, 0);
    var h = kv(parts.map(function (x) { return [x[0].replace('_', ' ').toLowerCase(), esc(x[1])]; }));
    var mh = '<h3>Last 90 days</h3><div class="mgrid">' + mt('Impressions', n0(cb.impr)) + mt('Share of top 5', pct(cb.impr, tot)) + '</div>' +
      '<p class="note">Google reports only impressions for combinations, and only the top five per ad.</p>';
    openDrawer('Combination', [['Basic info', h], ['Metrics', mh]]);
  }
  /* the ad message as it runs: body, then the disclaimer (part of the copy, never cut; operator 5 Oct) */
  function msgHtml(t) {
    var i = t.indexOf('\n\nAttorney Advertising'); if (i < 0) return '<pre>' + esc(t) + '</pre>';
    return '<pre>' + esc(t.slice(0, i)) + '</pre><p class="disc">' + esc(t.slice(i + 2)) + '</p>';
  }
  var ROLE = { feeds: 'Feeds', stories_reels: 'Stories and Reels', right_column_search_marketplace: 'Right column, Search, Marketplace' };
  var media = function (u, alt) { return /\.mp4($|\?)/.test(u) ? '<video src="' + esc(u) + '" muted playsinline preload="metadata"></video>' : '<img src="' + esc(u) + '" alt="' + esc(alt || '') + '" loading="lazy">'; };
  function metaVariants(p, a) {
    var h = '<h2>Copy</h2><div class="tiles"><button class="tile text"' + dr(function (el) { el.classList.add('sel'); drawerMetaCopy(p, a); }) + '><p>Primary text · headline · description</p><h3>' + esc(a.headline) + '</h3>' +
      msgHtml(a.primary) + '<div class="meta">' + esc(a.description) + ' · CTA ' + esc(a.cta) + '</div></button></div>';
    var files = a.files || {}, roles = a.placements || {};
    h += '<h2>Creatives by ratio</h2><div class="thumbs">' + Object.keys(files).map(function (r) {
      var u = files[r], used = Object.keys(roles).filter(function (k) { return roles[k] === u; }).map(function (k) { return ROLE[k]; });
      return '<button class="thumb"' + dr(function (el) { el.classList.add('sel'); drawerFile(p, a, r, u, used); }) + '>' + media(u, a.name + ' ' + r) + '<div class="cap">' + esc(r.replace('_', '.').replace('x', ':')) +
        '<small>' + esc(used.length ? used.join(' · ') : 'not uploaded (' + (r === '9x16' ? 'held' : 'not used') + ')') + '</small></div></button>';
    }).join('') + '</div>';
    return h;
  }
  function drawerMetaCopy(p, a) {
    var h = '<h3>Primary text</h3><div class="copy">' + esc(a.primary) + '</div>' + kv([['Headline', esc(a.headline)], ['Description', esc(a.description)], ['Call to action', esc(a.cta)],
      ['Website URL', link(a.url)], ['URL parameters', esc(a.params)], ['Length', a.primary.length + ' characters']]);
    openDrawer('Copy · ' + a.name, [['Basic info', h], ['Metrics', notConnected(p)]]);
  }
  function drawerFile(p, a, r, u, used) {
    var h = media(u, a.name) + kv([['Ratio', esc(r.replace('_', '.').replace('x', ':'))], ['Placements', esc(used.length ? used.join(' · ') : 'none (not uploaded)')], ['File', link(u, u.split('/').pop())]]);
    openDrawer('Creative · ' + a.name, [['Basic info', h], ['Metrics', notConnected(p)]]);
  }
  function ndVariants(p, a) {
    var h = '<h2>Copy variants (' + a.bodies.length + ')</h2><div class="tiles">' + a.bodies.map(function (b) {
      return '<button class="tile text"' + dr(function (el) { el.classList.add('sel'); openDrawer(b[0] + ' · ' + a.name, [['Basic info', kv([['Headline', esc(a.headline)], ['Call to action', esc(a.cta)], ['Landing page', link(a.url)]]) +
        '<h3>Body</h3><div class="copy">' + esc(b[1]) + '</div>'], ['Metrics', notConnected(p)]]); }) + '><p>' + esc(b[0]) + '</p><h3>' + esc(a.headline) + '</h3>' + msgHtml(b[1]) + '</button>';
    }).join('') + '</div>';
    h += '<h2>Creatives (' + a.creatives.length + ')</h2><div class="thumbs">' + a.creatives.map(function (x) {
      return '<button class="thumb"' + dr(function (el) { el.classList.add('sel'); openDrawer('Creative · ' + a.name, [['Basic info', media(x.url) + kv([['Direction', esc(x.direction)], ['Ratio', esc(x.ratio)], ['utm_content', esc(x.utm_content)], ['File', link(x.url, x.url.split('/').pop())]])], ['Metrics', notConnected(p)]]); }) +
        '>' + media(x.url, x.direction) + '<div class="cap">' + esc(x.direction) + '<small>' + esc(x.ratio) + '</small></div></button>';
    }).join('') + '</div>';
    return h;
  }

  /* ───────────── ads → pages → phones (MH-18) ───────────── */
  var PLAT = { google: 'Google', meta: 'Meta', nextdoor: 'Nextdoor' };
  function hubPage(slug) { return slug === '' ? '#/website/default/index' : slug == null ? null : pageHref(slug); }
  function slugTxt(s) { return s === '' ? '/' : s == null ? '' : '/' + s; }
  var MCHIP = { same: '<span class="chip ok">same</span>', differs: '<span class="chip red">differs</span>', 'no page number': '<span class="chip warn">no page number</span>', 'no call number': '<span class="chip warn">no call number</span>', 'no landing page': '<span class="chip">no landing page</span>', 'n/a': '<span class="chip">page number only</span>' };
  function viewPhoneMap() {
    var tabs = [['all', 'All', PM.rows.length]].concat(['google', 'meta', 'nextdoor'].map(function (k) { return [k, PLAT[k], PM.rows.filter(function (r) { return r.platform === k; }).length]; }),
      [['differs', 'Numbers differ', PM.rows.filter(function (r) { return r.match === 'differs'; }).length], ['nocall', 'No call number', PM.rows.filter(function (r) { return r.match === 'no call number'; }).length], ['running', 'Running now', PM.rows.filter(function (r) { return r.running; }).length]]);
    var cur = tabs.map(function (t) { return t[0]; }).indexOf(TAB) >= 0 ? TAB : 'all';
    var rows = PM.rows.filter(function (r) { return cur === 'all' || r.platform === cur || (cur === 'differs' && r.match === 'differs') || (cur === 'nocall' && r.match === 'no call number') || (cur === 'running' && r.running); });
    var n = function (f) { return PM.rows.filter(f).length; };
    var h = '<h1>Ads → pages → phones</h1><p class="lead">Every ad group (Google) and ad set (Meta, Nextdoor), the page its ads open and the phone numbers involved. Click a row for details.</p>' +
      '<details class="state"><summary>How the numbers work</summary><p>A Google ad shows its own call number (a call asset on the ad group or the campaign). A click on any ad opens its landing page, ' +
      'which shows the number of its row in the site’s phone table for the visitor’s source (utm_source, or the ad click id). That page keeps the number for 90 days, so every later page of the visit shows the same one (PBI-42). ' +
      'Meta and Nextdoor ads have no number of their own. Numbers on the page: ' + esc(PM.stagingTableFrom) + '; the ads land on start.credolegal.com until the domain switch.</p></details>' +
      '<div class="tiles kpis">' + [['Rows (ad group × page)', PM.rows.length], ['Running now', n(function (r) { return r.running; })], ['Call number ≠ page number', n(function (r) { return r.match === 'differs'; })],
        ['Google, no call number', n(function (r) { return r.match === 'no call number'; })], ['Page not on staging', n(function (r) { return r.staging === 'not on staging'; })]]
        .map(function (t) { return '<div class="tile static"><p>' + esc(t[0]) + '</p><div class="big">' + t[1] + '</div></div>'; }).join('') + '</div>' +
      '<nav class="mtabs" aria-label="Filter">' + tabs.map(function (t) { return '<a href="#/ads/phones' + (t[0] === 'all' ? '' : '?tab=' + t[0]) + '"' + (t[0] === cur ? ' aria-current="page"' : '') + '>' + esc(t[1]) + ' <span class="cnt">' + t[2] + '</span></a>'; }).join('') + '</nav>' +
      '<div class="scroll"><table class="tbl"><thead><tr><th>Platform</th><th>Campaign › ad group</th><th class="num">Ads</th><th>Landing page (live → staging)</th><th>Ad’s call number</th><th>Number on the page</th><th>Match</th><th>Key sent</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr class="clk"' + dr(function (el) { el.classList.add('sel'); drawerPhoneRow(r); }) + '><td>' + esc(PLAT[r.platform] || r.platform) + '</td>' +
        '<td>' + esc(r.campaign) + ' › <b>' + esc(r.group) + '</b>' + (r.running ? ' <span class="chip ok">running</span>' : '') + '</td><td class="num">' + r.ads.length + '</td>' +
        '<td>' + (r.url ? '<code>' + esc(slugTxt(r.liveSlug)) + '</code>' + (r.staging === 'renamed' ? ' → <code>' + esc(slugTxt(r.stagingSlug)) + '</code>' : r.staging === 'not on staging' ? ' <span class="chip red">not on staging</span>' : '') : dash) + '</td>' +
        '<td>' + (r.callPhone ? esc(r.callPhone) + '<div class="sub">' + esc(r.callLevel) + '</div>' : dash) + '</td>' +
        '<td>' + (r.sitePhone ? esc(r.sitePhone) + '<div class="sub">source ' + esc(r.source) + '</div>' : dash) + '</td><td>' + (MCHIP[r.match] || esc(r.match)) + '</td>' +
        '<td>' + (/^yes/.test(r.sendsKey) ? '<span class="chip ok">yes</span>' : '<span class="chip warn">no</span>') + '</td></tr>';
    });
    return h + '</tbody></table></div><p class="note">Match compares the Google ad’s call number with the number its landing page shows Google visitors. Meta and Nextdoor ads have no call number of their own: the page’s number is the only one. ' +
      'Ads land on start.credolegal.com until the domain switch; staging shows the numbers of the site being built.</p>';
  }
  function drawerPhoneRow(r) {
    var hp = hubPage(r.stagingSlug), ad = function (a) { var f = findAd(r.pk, r.ck, r.gk, a.key); var sub = f.a && (f.a.headlines || [])[0] ? '<div class="sub">' + esc(f.a.headlines[0]) + '</div>' : f.a && f.a.headline ? '<div class="sub">' + esc(f.a.headline) + '</div>' : '';
      return (f.a ? '<a href="' + adHref(f.p, f.c, f.g, f.a) + '">' + esc(a.name) + '</a>' : esc(a.name)) + sub; };
    var basic = kv([['Platform', esc(PLAT[r.platform] || r.platform)], ['Campaign', esc(r.campaign) + (r.campaignStatus ? '<div class="sub">' + esc(r.campaignStatus) + '</div>' : '')],
      [r.platform === 'google' ? 'Ad group' : 'Ad set', esc(r.group) + (r.groupId ? '<div class="sub">id ' + esc(r.groupId) + '</div>' : '') + (r.groupStatus ? '<div class="sub">' + esc(r.groupStatus) + '</div>' : '')],
      ['Running now', r.running ? '<span class="chip ok">yes</span>' : 'no'], ['Ads', String(r.ads.length)], ['Landing page (live)', r.url ? link(r.url) : dash],
      ['On staging', r.stagingSlug != null ? link('https://staging.credolegal.com' + slugTxt(r.stagingSlug)) + '<div class="sub">' + esc(r.staging) + '</div>' : esc(r.staging)],
      ['Ad’s call number', r.callPhone ? esc(r.callPhone) + '<div class="sub">' + esc(r.callLevel) + ' call asset</div>' : dash], ['Number on the page', r.sitePhone ? esc(r.sitePhone) + '<div class="sub">utm_source ' + esc(r.source) + '</div>' : dash],
      ['Match', MCHIP[r.match] || esc(r.match)]]);
    var srcRows = r.sitePhones ? '<table class="tbl"><thead><tr><th>Visitor’s source</th><th>Number shown</th></tr></thead><tbody>' + Object.keys(r.sitePhones).map(function (k) {
      return '<tr' + (k === r.source || (k === 'default' && r.source === '(none sent)') ? ' class="sel"' : '') + '><td>' + esc(k) + '</td><td>' + esc(r.sitePhones[k]) + '</td></tr>'; }).join('') + '</tbody></table>' : '';
    var phone = '<p>' + (r.platform === 'google' ? 'The ad shows its own call number in Google (call asset at ' + esc(r.callLevel || 'no') + ' level). A click opens the landing page, which shows the number of its phone-table row for the visitor’s source.' :
        'Meta and Nextdoor ads carry no phone number; the landing page shows the number of its phone-table row for the visitor’s source.') + ' The page the ad opened saves that number for 90 days and every later page of the visit shows it (PBI-42).</p>' +
      kv([['Phone-table row', esc(r.phoneRow)], ['Source the ads send', esc(r.source)], ['Ad-group key', r.key ? '<code>' + esc(r.key) + '</code>' : dash], ['Ads send the key', esc(r.sendsKey)],
        ['Planned number for the key', r.planned ? esc(r.planned) + '<div class="sub">per ad group lookup (proposal, not live)</div>' : dash], ['Bing number (call-tracking sheet)', esc(r.bingSheet)], ['Notes', esc(r.notes)]]) + srcRows;
    var adsTab = '<table class="tbl"><thead><tr><th>Ad</th><th>Type</th><th>Status</th></tr></thead><tbody>' + r.ads.map(function (a) { return '<tr><td>' + ad(a) + '</td><td>' + esc(a.type || '') + '</td><td>' + esc(a.status || '') + '</td></tr>'; }).join('') + '</tbody></table>';
    var page = kv([['Live (where the ads land today)', r.url ? link(r.url) : dash], ['Staging (the site being built)', r.stagingSlug != null ? link('https://staging.credolegal.com' + slugTxt(r.stagingSlug)) : esc(r.staging)],
      ['In the hub', hp ? '<a href="' + hp + '">Open the page in Website</a>' : '<span class="note">not part of a microsite</span>']]);
    openDrawer(r.campaign + ' › ' + r.group, [['Basic info', basic], ['Phone', phone], ['Ads', adsTab], ['Page', page]]);
  }

  /* ───────────── work: the staging plan board (MH-11 D1) ───────────── */
  function pbiState(p) {
    var st = p.tasks.map(function (t) { return t[1]; });
    return st.indexOf('doing') >= 0 ? 'doing' : st.length && st.every(function (x) { return x === 'done'; }) ? 'done' : 'todo';
  }
  /* MH-17: review files and the change log open inside the hub (they used to open on the public staging-plan mirror) */
  function docHref(path) {
    if (path === 'review/CHANGELOG.md') return '#/work/changelog';
    var hit = null; if (RV) RV.groups.some(function (g) { var k = g.files.map(function (f) { return f[1]; }).indexOf(path); if (k >= 0) hit = '#/work/reviews/' + enc(g.id) + '?tab=f' + k; return k >= 0; });
    return hit || (RV && RV.docs[path] != null ? '#/work/doc/' + enc(path) : null);
  }
  function resolveDoc(u, base) {   /* a relative link in a review file or the change log (both live in review/) */
    var parts = ((base || '') + u.replace(/^\.\//, '')).split('/'), out = [];
    parts.forEach(function (x) { if (x === '..') out.pop(); else if (x && x !== '.') out.push(x); });
    return out.join('/');
  }
  function md(text, base) {   /* small markdown: headings, lists, tables, code blocks, paragraphs, bold, code, links */
    var inl = function (t) { return esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t2, u) {
        u = u.replace(/&amp;/g, '&');
        if (/^(https?:|mailto:|#)/.test(u)) return '<a href="' + esc(u) + '"' + (/^#/.test(u) ? '' : ' target="_blank" rel="noopener"') + '>' + t2 + '</a>';
        var h = docHref(resolveDoc(u.split('#')[0], base));   /* files that are not review texts (screenshots, JSON) stay in the private repo */
        return h ? '<a href="' + h + '">' + t2 + '</a>' : '<span class="fileref" title="' + esc(resolveDoc(u, base)) + ' (private repo)">' + t2 + '</span>';
      }); };
    var out = [], lines = text.split('\n'), i = 0, START = /^(#{1,4} |\||\s*[-*] |\s*\d+[.)] |```)/;
    while (i < lines.length) {
      var l = lines[i];
      if (/^```/.test(l)) { var code = []; i++; while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; } i++;
        out.push('<pre class="code"><code>' + esc(code.join('\n')) + '</code></pre>'); continue; }
      if (/^#{1,4} /.test(l)) { var n = l.match(/^#+/)[0].length; out.push('<h' + (n + 1) + '>' + inl(l.replace(/^#+ /, '')) + '</h' + (n + 1) + '>'); i++; continue; }
      if (/^\|/.test(l)) { var rows = []; while (i < lines.length && /^\|/.test(lines[i])) { if (!/^\|[\s:|-]+\|$/.test(lines[i])) rows.push(lines[i].replace(/^\||\|$/g, '').split('|')); i++; }
        out.push('<div class="scroll"><table class="tbl">' + rows.map(function (r, k) { return '<tr>' + r.map(function (c) { return (k ? '<td>' : '<th>') + inl(c.trim()) + (k ? '</td>' : '</th>'); }).join('') + '</tr>'; }).join('') + '</table></div>'); continue; }
      if (/^\s*([-*]|\d+[.)]) /.test(l)) { var ol = /^\s*\d/.test(l), items = [];
        while (i < lines.length && (/^\s*([-*]|\d+[.)]) /.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) { if (/^\s*([-*]|\d+[.)]) /.test(lines[i])) items.push(lines[i].replace(/^\s*([-*]|\d+[.)]) /, '')); else items[items.length - 1] += ' ' + lines[i].trim(); i++; }
        out.push((ol ? '<ol>' : '<ul>') + items.map(function (x) { return '<li>' + inl(x) + '</li>'; }).join('') + (ol ? '</ol>' : '</ul>')); continue; }
      if (!l.trim()) { i++; continue; }
      var para = []; while (i < lines.length && lines[i].trim() && !START.test(lines[i])) { para.push(lines[i]); i++; }
      out.push('<p>' + inl(para.join(' ')) + '</p>');
    }
    return out.join('\n');
  }
  function logFor(id) {   /* the change-log entry of a backlog item ("## PBI-39 · …") */
    if (!W) return ''; var parts = W.changelog.split(/\n(?=## )/);
    var hit = parts.filter(function (x) { return x.indexOf('## ' + id + ' ') === 0 || x.indexOf('## ' + id + '\n') === 0; });
    return hit.length ? md(hit.join('\n'), 'review/') : '';
  }
  var VCHIP = function (v) { return !v ? '' : /do not/i.test(v) ? '<span class="chip red">' + esc(v) + '</span>' : /fix/i.test(v) ? '<span class="chip warn">' + esc(v) + '</span>' : '<span class="chip ok">' + esc(v) + '</span>'; };
  function reviewHtml(p) {
    var r = p.review || {}, items = r.items || [];
    if (!items.length && !(r.links || []).length) return '<p class="note">No review recorded.</p>';
    return '<table class="tbl"><thead><tr><th>Kind</th><th>Reviewer</th><th>Verdict</th><th>Note</th></tr></thead><tbody>' + items.map(function (x) {
      return '<tr><td>' + esc(x.kind) + '</td><td>' + esc(x.by) + '</td><td>' + (x.na ? '<span class="chip">not applicable</span>' : VCHIP(x.verdict) + (x.file && docHref(x.file) ? ' <a href="' + docHref(x.file) + '">read</a>' : '')) + (x.settled ? ' <span class="chip ok">settled</span>' : '') + '</td><td>' + esc(x.note || '') + '</td></tr>';
    }).join('') + '</tbody></table>' + ((r.links || []).length ? '<p>' + r.links.map(function (l) { var h = docHref(l[1]); return h ? '<a href="' + h + '">' + esc(l[0]) + '</a>' : esc(l[0]); }).join(' · ') + '</p>' : '');
  }
  function tasksHtml(p) {
    return ['todo', 'doing', 'done'].map(function (k) {
      var ts = p.tasks.filter(function (t) { return t[1] === k; });
      return '<h3>' + { todo: 'To do', doing: 'Doing', done: 'Done' }[k] + ' (' + ts.length + ')</h3>' + (ts.length ? '<ul class="notes">' + ts.map(function (t) { return '<li>' + esc(t[0]) + '</li>'; }).join('') + '</ul>' : '<p class="note">–</p>');
    }).join('');
  }
  function pbiInfo(p) {
    return kv([['Item', esc(p.id)], ['State', esc(pbiState(p))], ['By', esc(p.by || '')], ['Blocked by', esc(p.blocked || '')], ['Refs', esc((p.refs || []).join(', '))]]) +
      (p.note ? '<h3>Note</h3><p>' + esc(p.note) + '</p>' : '') + (p.why ? '<h3>Why</h3><p>' + esc(p.why) + '</p>' : '') + (p.done ? '<h3>Done when</h3><p>' + esc(p.done) + '</p>' : '');
  }
  function drawerPbi(p) {
    openDrawer(p.id + ' · ' + p.title, [['Basic info', pbiInfo(p) + '<div class="toolbar">' + go('#/work/' + enc(p.id), 'Open the item') + '</div>'], ['Tasks', tasksHtml(p)], ['Review', reviewHtml(p)], ['Change log', logFor(p.id) || '<p class="note">No change-log entry.</p>']]);
  }
  var BY = { claude: 'Claude', likely: 'Likely Claude', decision: 'Needs decision', manual: 'Manual' };
  function viewBoard() {
    var vis = B.pbis.filter(function (p) { return p.visible !== false; });
    /* MH-17: the overview of the legacy board page: status cards, the WIP-1 warning, "who does it" and why one row at a time */
    var active = B.pbis.filter(function (p) { return pbiState(p) === 'doing'; }), done = B.pbis.filter(function (p) { return pbiState(p) === 'done'; }), blocked = B.pbis.filter(function (p) { return p.blocked; });
    var card = function (k, v) { return '<div class="tile static"><p>' + esc(k) + '</p><div class="big">' + v + '</div></div>'; };
    var h = '<h1>Board</h1><p class="lead">' + esc(B.site ? B.site.name + ' · ' + B.site.domain : '') + ' · updated ' + esc(B.updated) + '. One row per backlog item; click a row for its details, tasks, review and change-log entry.</p>' +
      '<div class="tiles kpis">' + card('In progress (WIP 1)', active.length ? esc(active.map(function (p) { return p.id; }).join(', ')) : 'none') + card('Items done', done.length + ' / ' + B.pbis.length) + card('Waiting on a decision', String(blocked.length)) + '</div>' +
      (active.length > 1 ? '<div class="warnbox">WIP limit broken: ' + active.length + ' rows have tasks in Doing (' + esc(active.map(function (p) { return p.id; }).join(', ')) + ').</div>' : '') +
      (B.state ? '<details class="state"><summary>Current state</summary><p>' + esc(B.state) + '</p></details>' : '') +
      '<div class="scroll"><table class="tbl"><thead><tr><th>Item</th><th>State</th><th>By</th><th class="num">To do</th><th class="num">Doing</th><th class="num">Done</th><th>Review</th><th>Blocked by</th></tr></thead><tbody>';
    vis.forEach(function (p) {
      var c = function (k) { return p.tasks.filter(function (t) { return t[1] === k; }).length; }, st = pbiState(p);
      var rv = ((p.review || {}).items || []).map(function (x) { return x.na ? '' : VCHIP(x.verdict); }).join(' ');
      h += '<tr class="clk"' + dr(function (el) { el.classList.add('sel'); drawerPbi(p); }) + '><td><a href="#/work/' + enc(p.id) + '">' + esc(p.id) + '</a> ' + esc(p.title) + '</td><td>' +
        (st === 'done' ? '<span class="chip ok">done</span>' : st === 'doing' ? '<span class="chip warn">doing</span>' : '<span class="chip">to do</span>') + '</td><td>' + esc(BY[p.by] || p.by || '') + '</td><td class="num">' + c('todo') + '</td><td class="num">' + c('doing') + '</td><td class="num">' + c('done') + '</td><td>' + rv + '</td><td>' + esc(p.blocked || '') + '</td></tr>';
    });
    var hid = B.pbis.length - vis.length;
    return h + '</tbody></table></div>' + (hid ? '<p class="note">' + hid + ' closed items are hidden on the board.</p>' : '') +
      '<h2>Why one row at a time</h2><div class="mdoc"><p>The board follows a Scrum WIP limit of one: only one row may have tasks in <b>Doing</b>. The whole team works on that ' +
      'one item together (sometimes called swarming), and it is finished (published to staging and verified) before the next row starts.</p><p>Rows waiting on a decision keep ' +
      'their place in the priority order. When the decision arrives they are pulled in next; until then the next unblocked row is taken.</p></div>';
  }
  function viewPbi(p) {
    return '<h1>' + esc(p.id + ' · ' + p.title) + '</h1><div class="toolbar"><button class="btn"' + dr(function () { drawerPbi(p); }) + '>Details, tasks, review</button></div>' + pbiInfo(p) +
      '<div class="cols3">' + tasksHtml(p).replace(/<h3>/g, '<div><h3>').replace(/(<\/ul>|<p class="note">–<\/p>)/g, '$1</div>') + '</div><h2>Review</h2>' + reviewHtml(p) + '<h2>Change log</h2>' + (logFor(p.id) || '<p class="note">No change-log entry.</p>');
  }
  function viewDecisions() {
    var h = '<h1>Decisions</h1><p class="lead">Decisions the work waits on or followed. Click a row for the full text.</p><div class="scroll"><table class="tbl"><thead><tr><th>Decision</th><th>Gap</th><th>Topic</th><th>Item</th></tr></thead><tbody>';
    B.decisions.forEach(function (d) {
      var open = !/^decided|^done/i.test(d[3]);
      h += '<tr class="clk"' + dr(function (el) { el.classList.add('sel'); openDrawer(d[0] + ' · ' + d[2], kv([['Decision', esc(d[0])], ['Gap', esc(d[1])], ['Item', d[4] ? '<a href="#/work/' + enc(d[4]) + '">' + esc(d[4]) + '</a>' : '']]) + '<p>' + esc(d[3]) + '</p>'); }) +
        '><td>' + esc(d[0]) + ' ' + (open ? '<span class="chip warn">open</span>' : '<span class="chip ok">decided</span>') + '</td><td>' + esc(d[1]) + '</td><td>' + esc(d[2]) + '<div class="sub">' + esc(d[3].slice(0, 140)) + (d[3].length > 140 ? '…' : '') + '</div></td><td>' + (d[4] ? '<a href="#/work/' + enc(d[4]) + '">' + esc(d[4]) + '</a>' : '') + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }
  function viewManual() {
    return '<h1>Manual steps</h1><p class="lead">Steps only the operator can take (accounts, Designer-only settings).</p><div class="scroll"><table class="tbl"><thead><tr><th>Step</th><th>What</th><th>Status</th></tr></thead><tbody>' +
      B.manual.map(function (m) { return '<tr><td>' + esc(m[0]) + '</td><td>' + esc(m[1]) + '</td><td>' + (/^done/i.test(m[2]) ? '<span class="chip ok">' + esc(m[2]) + '</span>' : esc(m[2])) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  /* ───────────── work: reviews (MH-17; was the legacy review page on the public mirror) ───────────── */
  function docBody(path) {   /* a review file: its reviewer line (model, date, time) above the text */
    var t = RV.docs[path] || '', head = (t.match(/^<!--\s*(reviewer:[^>]*?)\s*-->/) || [])[1];
    return (head ? '<p class="note mono">' + esc(head.replace(/\s*usage .*$/, '')) + '</p>' : '') + '<div class="mdoc">' + md(t.replace(/^<!--[\s\S]*?-->\s*/, ''), 'review/') + '</div>';
  }
  function verdictsOf(g) { var p = g.pbi && B && B.pbis.filter(function (x) { return x.id === g.id; })[0]; return p ? ((p.review || {}).items || []).map(function (x) { return x.na ? '' : VCHIP(x.verdict); }).join(' ') : ''; }
  function viewReviews() {
    var h = '<h1>Reviews</h1><p class="lead">Independent GPT and Gemini reviews of each change: the packet sent, each reviewer’s reply and the resolution. ' +
      'Newest first; reviews of work that is not a backlog item are listed first. Click a review to read it.</p><div class="scroll"><table class="tbl"><thead><tr><th>Review</th><th>Files</th><th>Verdicts</th></tr></thead><tbody>';
    RV.groups.forEach(function (g) {
      h += '<tr><td><a href="#/work/reviews/' + enc(g.id) + '">' + esc(g.id) + '</a> ' + esc(g.title) + (g.pbi ? '' : ' <span class="chip">not a backlog item</span>') + '</td><td class="num">' + g.files.length + '</td><td>' + verdictsOf(g) + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }
  function viewReview(g) {
    var keys = g.files.map(function (f, k) { return 'f' + k; }), cur = keys.indexOf(TAB) >= 0 ? keys.indexOf(TAB) : g.files.length - 1;   /* default: the resolution, as before */
    var f = g.files[cur], base = '#/work/reviews/' + enc(g.id);
    return '<h1>' + esc(g.id + ' · ' + g.title) + '</h1>' + (g.pbi ? '<div class="toolbar">' + go('#/work/' + enc(g.id), 'Open the backlog item') + '</div>' : '') +
      '<nav class="mtabs rtabs" aria-label="Review files">' + g.files.map(function (x, k) { return '<a href="' + base + '?tab=f' + k + '"' + (k === cur ? ' aria-current="page"' : '') + '>' + esc(x[0]) + '</a>'; }).join('') + '</nav>' +
      (f[1] === 'review/CHANGELOG.md' ? (W ? '<div class="mdoc">' + md(W.changelog.replace(/^# .*\n/, ''), 'review/') + '</div>' : '') : RV.docs[f[1]] != null ? docBody(f[1]) : '<p class="note">File not found: ' + esc(f[1]) + '</p>');
  }
  function viewDoc(path) { return '<h1>' + esc(path.replace(/^review\//, '')) + '</h1>' + docBody(path); }

  /* ───────────── organic (MH-11 D4; v2 6 Oct 2026): the four-platform calendar, approvals, Buffer, Nextdoor page and engagement ─────────────
   * The calendar works like the legacy Nextdoor feed calendar (week grid that opens on today, a card per post with
   * image, slot time, topic, badges and metrics; click → the post as it appears on the platform, copy the text), in the
   * hub's layout: the post opens in the drawer. Campaign posts start as drafts. Approve / Request changes writes to the
   * shared review database (page "organic-approval", anchor "org-<post id>"); tools/marketing-hub/organic-sync.mjs reads
   * those records, schedules approved posts (Nextdoor: into calendar-posts.js for the daily task; FB, IG, LinkedIn: the
   * Buffer queue). */
  var CH = { nextdoor: 'Nextdoor', facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn' }, CHS = ['nextdoor', 'facebook', 'instagram', 'linkedin'];
  var OC = O && O.campaign, DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var todayIso = (function () { var n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); })();
  var chFilter = (function () { try { return JSON.parse(localStorage.getItem('mh-org-ch')) || CHS.slice(); } catch (e) { return CHS.slice(); } })();
  var dU = function (s) { var p = s.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }, isoU = function (d) { return d.toISOString().slice(0, 10); };
  var addDays = function (s, n) { var d = dU(s); d.setUTCDate(d.getUTCDate() + n); return isoU(d); };
  var monday = function (s) { var d = dU(s); return addDays(s, -((d.getUTCDay() + 6) % 7)); };
  var fmtDay = function (s) { var d = dU(s); return DOW[(d.getUTCDay() + 6) % 7] + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; };
  var fmtTime = function (t) { if (!t) return ''; var h = +t.slice(0, 2); return ((h % 12) || 12) + ':' + t.slice(3, 5) + ' ' + (h < 12 ? 'AM' : 'PM'); };
  var chChip = function (c) { return '<span class="ch ch-' + c + '">' + esc(CH[c] || c) + '</span>'; };
  var imgUrl = function (p) { return p.img || ''; };

  /* approvals: the latest record per post in the shared database; built status wins once a post is scheduled or published */
  function apprOf(p) {
    if (!COMMENTS) return null; var best = null;
    Object.keys(COMMENTS).forEach(function (k) { var c = COMMENTS[k]; if (c.page === 'organic-approval' && c.anchor === 'org-' + p.id && (!best || (c.timestamp || 0) > (best.timestamp || 0))) best = c; });
    return best;
  }
  function stOf(p) {
    if (p.status === 'published' || p.status === 'scheduled') return p.status;
    if (p.status === 'approved' || p.status === 'changes') { var a0 = apprOf(p); if (!a0 || a0.status === p.status) return p.status; }
    var a = apprOf(p); if (a && a.status !== 'draft') return a.status === 'approved' ? 'approved' : 'changes';
    return p.status || 'draft';
  }
  var ST_LABEL = { published: 'published', scheduled: 'scheduled', approved: 'approved · to sync', changes: 'changes requested', draft: 'draft' };
  var ST_CLS = { published: 'ok', scheduled: 'ok', approved: 'ok', changes: 'red', draft: 'warn' };
  var stChip = function (p) { var s = stOf(p); return '<span class="chip ' + ST_CLS[s] + '">' + esc(ST_LABEL[s]) + '</span>'; };
  var typeChip = function (p) { return p.type === 'ad' ? '<span class="chip">landing page</span>' : '<span class="chip">education</span>'; };
  function postApprove(p, status, note) {
    var who = (function () { try { return localStorage.getItem('credo_reviewer'); } catch (x) { return null; } })() || (window.prompt('Your name:', '') || '').trim();
    if (!who) return Promise.reject('no name'); try { localStorage.setItem('credo_reviewer', who); } catch (x) {}
    var rec = { page: 'organic-approval', anchor: 'org-' + p.id, author: who, status: status, comment: note || '', channel: p.channel, date: p.date, timestamp: Date.now() };
    return fetch(RTDB + '.json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec) }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) { COMMENTS = COMMENTS || {}; COMMENTS[d.name] = rec; return rec; });
  }

  function organicNav() {
    if (!O) return [];
    var n = function (c) { return O.posts.filter(function (p) { return p.channel === c; }).length; };
    var drafts = O.posts.filter(function (p) { return stOf(p) === 'draft'; }).length;
    return [{ label: 'Calendar', href: '#/organic', count: O.posts.length }, { label: 'Campaign', href: '#/organic/campaign', count: drafts ? drafts + ' to approve' : null }]
      .concat(CHS.map(function (c) { return { label: CH[c], href: '#/organic/' + c, count: n(c) }; }))
      .concat([{ label: 'Articles', href: '#/organic/articles', count: O.articles.length, children: O.articles.map(function (a) { return { label: a.title, href: '#/organic/articles/' + enc(a.slug) }; }) }]);
  }

  /* the post as it appears on the platform */
  function linkify(s) { return esc(s).replace(/((?:https?:\/\/)?(?:credolegal\.s\.gy|staging\.credolegal\.com)[\w\/?=&.-]*)/g, function (m) { return '<a href="' + (m.indexOf('http') ? 'https://' + m : m) + '" target="_blank" rel="noopener">' + m + '</a>'; })
    .replace(/(#[A-Za-z]\w+)/g, '<span class="pv-tag">$1</span>'); }
  function ocPreview(p) {
    var body = linkify(p.text || ''), disc = p.disclaimer ? '<div class="pv-disc">' + esc(p.disclaimer) + '</div>' : '', im = imgUrl(p) ? '<img class="pv-img" src="' + esc(imgUrl(p)) + '" alt="">' : '';
    var when = fmtDay(p.date) + (p.time ? ' · ' + fmtTime(p.time) + ' ET' : '');
    if (p.channel === 'nextdoor') return '<div class="pv pv-nd"><div class="pv-hd"><span class="pv-av nd"><img src="assets/organic/credo-mark.png" alt=""></span><span><b>Credo Legal Services Professional Corporation</b><small>Business post · ' + esc(when) + '</small></span></div>' +
      '<div class="pv-tx">' + body + disc + '</div>' + im + '<div class="pv-ft"><span>Thank</span><span>Reply</span><span>Share</span></div></div>';
    if (p.channel === 'facebook') return '<div class="pv pv-fb"><div class="pv-hd"><span class="pv-av">C</span><span><b>Crēdo Legal</b><small>' + esc(when) + ' · Public</small></span></div>' +
      '<div class="pv-tx">' + body + disc + '</div>' + im + (p.link ? '<div class="pv-card"><small>CREDOLEGAL.S.GY</small><b>Free case review · Crēdo Legal</b></div>' : '') + '<div class="pv-ft"><span>Like</span><span>Comment</span><span>Share</span></div></div>';
    if (p.channel === 'instagram') return '<div class="pv pv-ig"><div class="pv-hd"><span class="pv-av ig">C</span><span><b>credolegal</b></span></div>' + im +
      '<div class="pv-icons">♡ &nbsp;💬&nbsp; ➤</div><div class="pv-tx"><b>credolegal</b> ' + body + disc + '</div><div class="pv-when">' + esc(when) + '</div></div>';
    return '<div class="pv pv-li"><div class="pv-hd"><span class="pv-av li">C</span><span><b>Crēdo Legal</b><small>1,100 followers · ' + esc(when) + '</small></span></div>' +
      '<div class="pv-tx">' + body + disc + '</div>' + im + '<div class="pv-ft"><span>Like</span><span>Comment</span><span>Repost</span><span>Send</span></div></div>';
  }
  function actionsHtml(p) {
    var s = stOf(p), canAppr = p.campaign === 'v2' && (s === 'draft' || s === 'changes' || s === 'approved');
    return '<div class="toolbar pv-acts"><button class="btn" data-copy="' + esc(p.id) + '">Copy post text</button>' +
      (canAppr && s !== 'approved' ? '<button class="btn dl" data-appr="' + esc(p.id) + '">Approve</button>' : '') +
      (canAppr ? '<button class="btn" data-chg="' + esc(p.id) + '">Request changes</button>' : '') +
      (p.url ? link(p.url, 'Open post ↗') : '') + (p.insights ? link(p.insights, 'Insights ↗') : '') + '<span class="sub" data-msg></span></div>' +
      '<form class="cform chg-form" data-chgf="' + esc(p.id) + '" hidden><label>What should change?</label><textarea rows="3" required></textarea><button class="btn" type="submit">Send</button></form>';
  }
  function drawerPost(p) {
    var a = apprOf(p), s = p.short && p.short[p.channel];
    var info = kv([['Channel', chChip(p.channel)], ['Campaign', p.campaign === 'v2' ? esc('Week ' + p.week + ' · ' + p.theme) : 'Nextdoor, first campaign (Aug–Sep)'],
      ['Date', esc(fmtDay(p.date) + ' ' + p.date.slice(0, 4)) + (p.time ? ' · ' + esc(fmtTime(p.time)) + ' ET' : '') + (p.postedAt ? ' · posted ' + esc(p.postedAt.slice(0, 16).replace('T', ' ')) + ' UTC' : '')],
      ['Status', stChip(p) + (a ? ' <span class="sub">' + esc(a.author + ' · ' + new Date(a.timestamp).toISOString().slice(0, 10)) + (a.comment ? ': ' + esc(a.comment) : '') + '</span>' : '')],
      ['Kind', esc(p.kind || '')], ['Topic', esc(p.title || '')], ['Headline on image', esc([p.head, p.sub].filter(Boolean).join(' · '))],
      ['Landing page', p.lp ? link(p.lp) : ''], ['Short link', s ? link(s.url) + (s.planned ? ' <span class="chip warn">created on approval</span>' : s.asOf ? ' · <b>' + n0(s.clicks) + '</b> clicks as of ' + esc(s.asOf) : '') : p.channel === 'instagram' && p.type === 'ad' ? 'Link in bio: credolegal.s.gy/ig-bio' : ''],
      ['Destination', s && s.dest ? '<span class="sub">' + esc(s.dest) + '</span>' : ''], ['Image', esc(p.imgNote || '') + (imgUrl(p) ? ' · ' + link(imgUrl(p), 'file ↗') : '')],
      ['Length', p.full ? esc(p.full.length + (p.limit ? ' / ' + p.limit : '') + ' characters' + (p.disclaimer ? ' incl. disclaimer' : '')) : ''], ['Disclaimer', esc(p.why || '')]]);
    var m = p.metrics, met = m ? '<div class="mgrid">' + mt('Views', n0(m.views)) + mt('Reactions', n0(m.reactions)) + mt('Comments', n0(m.comments)) + (s && s.asOf ? mt('Link clicks', n0(s.clicks)) : '') + '</div><p class="note">As of ' + esc(m.asOf || '') + ' (Nextdoor insights).</p>'
      : '<p class="note">' + (p.channel === 'nextdoor' ? 'Metrics arrive after the daily task publishes the post (views from the insights page, reactions and comments from the post).' : 'Metrics arrive once the post is published through Buffer (Buffer post analytics); link clicks come from short.io.') + '</p>';
    var buf = p.buffer ? kv([['Service', esc(CH[p.channel])], ['Scheduled for', esc(p.buffer.scheduledAt)], ['Image URL', p.buffer.media ? link(p.buffer.media.photo, 'public file ↗') : ''], ['Link', p.buffer.link ? link(p.buffer.link) : 'none (Instagram: link in bio)'],
      ['Queued', p.buffer.queued ? esc(p.buffer.queued.id + ' · ' + p.buffer.queued.at) : '<span class="chip">not queued</span> queued by Claude through the Buffer connector after approval, once Credo’s Buffer account is connected']]) +
      '<h3>Payload</h3><pre class="code">' + esc(JSON.stringify(p.buffer, null, 1)) + '</pre>'
      : '<p class="note">Nextdoor is not a Buffer channel. Approved Nextdoor posts are copied into the Nextdoor feed calendar and published by the daily Chrome task at their slot.</p>';
    openDrawer((p.title || p.id) + ' · ' + (CH[p.channel] || ''), [['Preview', actionsHtml(p) + ocPreview(p)], ['Basic info', info], ['Metrics', met], ['Buffer', buf], ['Comments', commentsTab('org-' + p.id)]], true);
  }
  /* drawer actions: copy, approve, request changes */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy],[data-appr],[data-chg]'); if (!b || !O) return;
    var id = b.getAttribute('data-copy') || b.getAttribute('data-appr') || b.getAttribute('data-chg'), p = O.posts.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var msg = b.parentNode.querySelector('[data-msg]');
    if (b.hasAttribute('data-copy')) { navigator.clipboard.writeText(p.full || p.text || '').then(function () { msg.textContent = 'Copied.'; }); return; }
    if (b.hasAttribute('data-chg')) { var f = document.querySelector('[data-chgf="' + id + '"]'); f.hidden = !f.hidden; if (!f.hidden) f.querySelector('textarea').focus(); return; }
    msg.textContent = 'Saving…'; postApprove(p, 'approved').then(function () { drawerPost(p); refreshOrganic(); }).catch(function () { msg.textContent = 'Not saved.'; });
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-chgf]'); if (!f || !O) return; e.preventDefault(); e.stopPropagation();
    var p = O.posts.filter(function (x) { return x.id === f.getAttribute('data-chgf'); })[0], note = f.querySelector('textarea').value.trim(); if (!p || !note) return;
    postApprove(p, 'changes', note).then(function () { drawerPost(p); refreshOrganic(); });
  }, true);
  function refreshOrganic() { if (location.hash.indexOf('#/organic') !== 0) return; var y = $('app-main').scrollTop; DR = []; $('app-main').innerHTML = organicHtml(); $('app-main').scrollTop = y; renderTree(); }

  /* calendar */
  function visible(p) { return chFilter.indexOf(p.channel) >= 0; }
  function ocCard(p, compact) {
    var m = p.metrics, ratio = p.channel === 'facebook' || p.channel === 'instagram' ? '4/5' : (/1x1|bold/.test(p.img) || p.campaign === 'v2' ? '1/1' : '16/9');
    return '<button class="oc st-' + stOf(p) + '"' + dr(function (el) { el.classList.add('sel'); drawerPost(p); }) + '>' +
      (imgUrl(p) ? '<span class="oc-img" style="aspect-ratio:' + ratio + '"><img src="' + esc(imgUrl(p)) + '" alt="" loading="lazy"></span>' : '<span class="oc-img none">no image</span>') +
      '<span class="oc-when">' + chChip(p.channel) + ' ' + esc(p.time ? fmtTime(p.time) : p.status === 'published' ? 'posted' : '') + '</span>' +
      '<span class="oc-t">' + esc(p.title || '') + '</span>' + (compact ? '' : '<span class="oc-pv">' + esc((p.text || '').slice(0, 140)) + '</span>') +
      '<span class="oc-b">' + stChip(p) + typeChip(p) + '</span>' +
      (m ? '<span class="oc-m"><b>' + n0(m.views) + '</b> views · ' + n0(m.reactions) + ' reactions · ' + n0(m.comments) + ' comments</span>' : '') + '</button>';
  }
  function filterBar() {
    return '<span class="seg oc-seg">' + CHS.map(function (c) { return '<button data-och="' + c + '" aria-pressed="' + (chFilter.indexOf(c) >= 0) + '">' + esc(CH[c]) + '</button>'; }).join('') + '</span>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-och]'); if (b) { var c = b.getAttribute('data-och'), i = chFilter.indexOf(c);
      if (i >= 0 && chFilter.length > 1) chFilter.splice(i, 1); else if (i < 0) chFilter.push(c);
      try { localStorage.setItem('mh-org-ch', JSON.stringify(chFilter)); } catch (x) {} DR = []; $('app-main').innerHTML = organicHtml(); return; }
    var w = e.target.closest('[data-apprweek]'); if (w) { var ps = O.posts.filter(function (p) { return p.campaign === 'v2' && visible(p) && stOf(p) === 'draft' && p.date >= w.getAttribute('data-apprweek') && p.date <= addDays(w.getAttribute('data-apprweek'), 6); });
      if (!ps.length || !window.confirm('Approve ' + ps.length + ' draft post' + (ps.length > 1 ? 's' : '') + ' (' + chFilter.map(function (c) { return CH[c]; }).join(', ') + ') for this week?')) return;
      w.disabled = true; w.textContent = 'Saving…'; ps.reduce(function (pr, p) { return pr.then(function () { return postApprove(p, 'approved'); }); }, Promise.resolve()).then(refreshOrganic, refreshOrganic); }
  });
  function weekHead(mon) {
    var wk = OC && OC.weeks.filter(function (w) { return w.from === mon; })[0];
    return wk ? '<div class="oc-week"><b>Week ' + wk.n + ' · ' + esc(wk.theme) + '</b> <span class="chip">' + esc(wk.cluster) + '</span><p>' + esc(wk.why) + '</p></div>' : '';
  }
  function viewCalendar() {
    var mode = TAB && TAB[0] === 'm' ? 'month' : 'week';
    var first = O.posts[0].date, last = O.posts[O.posts.length - 1].date;
    var counts = {}; O.posts.filter(function (p) { return p.campaign === 'v2'; }).forEach(function (p) { var s = stOf(p); counts[s] = (counts[s] || 0) + 1; });
    var h = '<div class="pagehead"><h1>Calendar</h1><span class="sub">' + ['draft', 'changes', 'approved', 'scheduled', 'published'].filter(function (s) { return counts[s]; }).map(function (s) { return counts[s] + ' ' + ST_LABEL[s]; }).join(' · ') + '</span></div>' +
      '<p class="lead">Every organic post on Nextdoor, Facebook, Instagram and LinkedIn. The campaign (12 Oct – 8 Nov) follows the Nextdoor logic: education posts alternate with landing-page posts, one theme a week. Posts start as drafts; open one to see it as it will appear, copy it, approve it or ask for changes. Approved posts are scheduled by the sync (Nextdoor: the daily task; the others: Buffer).</p>';
    if (mode === 'month') {
      var months = O.posts.map(function (p) { return p.date.slice(0, 7); }).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort();
      var cur = TAB.slice(1), i = months.indexOf(cur); if (i < 0) { cur = months.indexOf(todayIso.slice(0, 7)) >= 0 ? todayIso.slice(0, 7) : months[months.length - 1]; i = months.indexOf(cur); }
      var y = +cur.slice(0, 4), mo = +cur.slice(5, 7) - 1, fd = new Date(Date.UTC(y, mo, 1)), nd = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate(), lead = (fd.getUTCDay() + 6) % 7;
      h += '<div class="toolbar"><span class="seg"><a class="btn" href="#/organic?tab=w' + monday(todayIso) + '">Week</a><a class="btn" aria-pressed="true" href="#/organic?tab=m' + cur + '">Month</a></span>' +
        (i > 0 ? '<a class="btn" href="#/organic?tab=m' + months[i - 1] + '">←</a>' : '') + '<b class="cal-m">' + esc(fd.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })) + '</b>' + (i < months.length - 1 ? '<a class="btn" href="#/organic?tab=m' + months[i + 1] + '">→</a>' : '') + filterBar() + '</div>' +
        '<div class="cal">' + DOW.map(function (d) { return '<div class="cal-hd">' + d + '</div>'; }).join('');
      for (var k = 0; k < lead; k++) h += '<div class="cal-d empty"></div>';
      for (var d = 1; d <= nd; d++) {
        var ds = cur + '-' + (d < 10 ? '0' : '') + d, ps = O.posts.filter(function (p) { return p.date === ds && visible(p); });
        h += '<div class="cal-d' + (ds === todayIso ? ' today' : '') + '"><div class="cal-n">' + d + '</div>' + ps.map(function (p) {
          return '<button class="cal-p ch-' + p.channel + ' st-' + stOf(p) + '"' + dr(function (el) { el.classList.add('sel'); drawerPost(p); }) + ' title="' + esc(CH[p.channel] + ' · ' + (p.title || '') + ' · ' + ST_LABEL[stOf(p)]) + '">' + esc(p.title || p.id) + '</button>'; }).join('') + '</div>';
      }
      return h + '</div>';
    }
    var mon = TAB && /^w\d{4}-\d{2}-\d{2}$/.test(TAB) ? TAB.slice(1) : monday(todayIso >= first && todayIso <= last ? todayIso : (todayIso < first ? first : last));
    var prev = addDays(mon, -7), next = addDays(mon, 7), days = [0, 1, 2, 3, 4, 5, 6].map(function (n) { return addDays(mon, n); });
    var wkPosts = O.posts.filter(function (p) { return p.date >= mon && p.date <= days[6] && visible(p); }), drafts = wkPosts.filter(function (p) { return p.campaign === 'v2' && stOf(p) === 'draft'; }).length;
    h += '<div class="toolbar"><span class="seg"><a class="btn" aria-pressed="true" href="#/organic?tab=w' + mon + '">Week</a><a class="btn" href="#/organic?tab=m' + mon.slice(0, 7) + '">Month</a></span>' +
      (prev >= monday(first) ? '<a class="btn" href="#/organic?tab=w' + prev + '">← ' + esc(fmtDay(prev)) + '</a>' : '') + '<b class="cal-m">' + esc(fmtDay(mon) + ' – ' + fmtDay(days[6])) + '</b>' +
      (next <= last ? '<a class="btn" href="#/organic?tab=w' + next + '">' + esc(fmtDay(next)) + ' →</a>' : '') + '<a class="btn" href="#/organic?tab=w' + monday(todayIso) + '">Today</a>' + filterBar() +
      (drafts ? '<button class="btn dl" data-apprweek="' + mon + '">Approve ' + drafts + ' draft' + (drafts > 1 ? 's' : '') + ' this week</button>' : '') + '</div>' + weekHead(mon) +
      '<div class="oc-grid">' + days.map(function (ds) {
        var ps = wkPosts.filter(function (p) { return p.date === ds; }).sort(function (a, b) { return CHS.indexOf(a.channel) - CHS.indexOf(b.channel); });
        return '<div class="oc-day' + (ds === todayIso ? ' today' : '') + (ps.length ? '' : ' empty') + '"><div class="oc-dh"><b>' + esc(fmtDay(ds)) + '</b>' + (ds === todayIso ? '<span class="chip red">today</span>' : '') + '</div>' +
          ps.map(function (p) { return ocCard(p, ps.length > 2); }).join('') + '</div>'; }).join('') + '</div>' +
      (wkPosts.length ? '' : '<p class="empty">No posts this week for the selected platforms.</p>');
    return h;
  }

  /* campaign: logic, weeks, mix, workflow, visuals */
  function viewOrgCampaign() {
    var cp = O.posts.filter(function (p) { return p.campaign === 'v2'; }), cnt = function (f) { return cp.filter(f).length; };
    var h = '<h1>Campaign · ' + esc(OC.name) + '</h1><p class="lead">' + esc(fmtDay(OC.start) + ' – ' + fmtDay(OC.end) + ' 2026') + '. The Nextdoor campaign’s logic on four platforms: education posts (a right, a warning, how something works; no offer, no landing page, no disclaimer) alternate with landing-page posts (one right, a free case review and a tracked link; attorney advertising, so the disclaimer is added). One theme a week; each platform tells it in its own voice. Landing pages are on staging.credolegal.com.</p>' +
      '<div class="tiles kpis">' + [['Posts', cp.length], ['Drafts to approve', cnt(function (p) { return stOf(p) === 'draft'; })], ['Changes requested', cnt(function (p) { return stOf(p) === 'changes'; })], ['Approved, to sync', cnt(function (p) { return stOf(p) === 'approved'; })],
        ['Scheduled', cnt(function (p) { return stOf(p) === 'scheduled'; })], ['Published', cnt(function (p) { return stOf(p) === 'published'; })]].map(function (x) { return '<div class="tile static"><p>' + x[0] + '</p><div class="big">' + x[1] + '</div></div>'; }).join('') + '</div>' +
      '<h2>Weeks</h2><div class="scroll"><table class="tbl"><thead><tr><th>Week</th><th>Theme</th><th>Why</th>' + CHS.map(function (c) { return '<th class="num">' + CH[c] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      OC.weeks.map(function (w) { return '<tr class="clk" onclick="location.hash=\'#/organic?tab=w' + w.from + '\'"><td>' + w.n + ' · ' + esc(fmtDay(w.from)) + '</td><td><b>' + esc(w.theme) + '</b><div class="sub">' + esc(w.cluster) + '</div></td><td class="sub">' + esc(w.why) + '</td>' +
        CHS.map(function (c) { var ps = cp.filter(function (p) { return p.week === w.n && p.channel === c; }); return '<td class="num">' + ps.length + '<div class="sub">' + ps.filter(function (p) { return p.type === 'edu'; }).length + ' edu · ' + ps.filter(function (p) { return p.type === 'ad'; }).length + ' LP</div></td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' +
      '<h2>Platforms</h2><div class="tiles">' + CHS.map(function (c) { var v = OC.voice[c]; return '<a class="tile" style="text-decoration:none" href="#/organic/' + c + '?tab=voice"><h3>' + chChip(c) + ' ' + esc(v.role) + '</h3><p>' + esc(v.cadence) + '</p><p>' + esc(v.length + ' · ' + v.mix) + '</p></a>'; }).join('') + '</div>' +
      '<h2>Workflow</h2><ol class="notes"><li><b>Draft.</b> Posts, images and disclaimers come from <code>content/campaigns/organic/campaign-2026-10.js</code> (images baked by <code>scripts/organic/bake.py</code> from the Higgsfield bases).</li>' +
      '<li><b>Approve</b> each post in its drawer, or a whole week from the Calendar. “Request changes” records a note; the post is revised and returns as a draft. Every landing-page post needs the responsible attorney’s pre-approval (NY 7.1(k)).</li>' +
      '<li><b>Sync</b> (<code>node tools/marketing-hub/organic-sync.mjs</code>, run by Claude): creates the short links on credolegal.s.gy, schedules approved Nextdoor posts in the Nextdoor feed calendar (the daily task publishes them at the slot), and queues approved Facebook, Instagram and LinkedIn posts in Buffer.</li>' +
      '<li><b>Measure.</b> Nextdoor metrics come back from the insights pages, the others from Buffer analytics; link clicks from short.io (utm_campaign ' + esc(OC.utmCampaign) + ', utm_medium social).</li></ol>' +
      '<div class="warnbox">Buffer: the Buffer connector in this workspace belongs to another organization (Izobilje), so nothing is queued yet. Connect Credo’s Buffer account (Facebook Page, Instagram business account, LinkedIn Page) and the sync queues approved posts. Instagram captions cannot link; set the profile link to credolegal.s.gy/ig-bio.</div>' +
      '<h2>Visuals</h2><p class="note">Higgsfield (GPT Image 2.5, 4:5, text-free bases), headlines baked per platform. Bold concepts carry the landing-page posts (the Nextdoor Bold campaign look); documentary photos carry the education posts.</p><div class="thumbs">' +
      Object.keys(OC.concepts).map(function (k) { var ex = cp.filter(function (p) { return p.concept === k && p.channel === 'instagram'; })[0] || cp.filter(function (p) { return p.concept === k; })[0];
        return ex ? '<button class="thumb"' + dr(function (el) { el.classList.add('sel'); drawerPost(ex); }) + '><img src="' + esc(ex.img) + '" alt=""><div class="cap">' + esc(OC.concepts[k].note) + '<small>' + esc(OC.concepts[k].style) + ' · used in ' + cp.filter(function (p) { return p.concept === k; }).length + ' posts</small></div></button>' : ''; }).join('') + '</div>';
    return h;
  }

  /* a platform: posts (+ Nextdoor page and engagement), voice, Buffer queue */
  function postRow(p, cols) {
    return '<tr class="clk"' + dr(function (el) { el.classList.add('sel'); drawerPost(p); }) + '><td class="oc-tt">' + (imgUrl(p) ? '<img src="' + esc(imgUrl(p)) + '" alt="" loading="lazy">' : '') + '</td><td>' + esc(fmtDay(p.date)) + '<div class="sub">' + esc(p.time ? fmtTime(p.time) + ' ET' : '') + '</div></td><td>' + esc(p.title || '') + '<div class="sub">' + esc((p.text || '').slice(0, 110)) + ((p.text || '').length > 110 ? '…' : '') + '</div></td><td>' +
      typeChip(p) + '</td><td>' + stChip(p) + '</td>' + (cols || '') + '</tr>';
  }
  function queueFor(id) { return COMMENTS ? Object.keys(COMMENTS).map(function (k) { return COMMENTS[k]; }).filter(function (x) { return x.page === 'nd-engagement-queue' && x.anchor === 'nd-engage-' + id; }) : []; }
  function voiceHtml(c) {
    var v = OC.voice[c]; return '<div class="kv"><dt>Role</dt><dd><b>' + esc(v.role) + '</b></dd><dt>Cadence</dt><dd>' + esc(v.cadence) + '</dd><dt>Length</dt><dd>' + esc(v.length) + '</dd><dt>Mix</dt><dd>' + esc(v.mix) + '</dd></div>' +
      '<ul class="notes">' + v.rules.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul><p class="note">All platforms follow brand/voice.md: plain and mechanical, second person, no emojis or exclamation marks, “our attorneys”.</p>';
  }
  function bufferHtml(c) {
    var ps = O.posts.filter(function (p) { return p.channel === c && p.buffer; }), ok = ps.filter(function (p) { var s = stOf(p); return s === 'approved' || s === 'scheduled'; });
    return '<p class="note">Facebook, Instagram and LinkedIn are published through Buffer. Approved posts are queued by Claude through the Buffer connector (channel, time, text with disclaimer, image, link); the export below is the same queue as a file.</p>' +
      '<div class="toolbar"><button class="btn" data-bufx="' + c + '"' + (ok.length ? '' : ' disabled') + '>Download Buffer queue (' + ok.length + ' approved)</button></div>' +
      '<div class="scroll"><table class="tbl"><thead><tr><th></th><th>Date</th><th>Post</th><th>Kind</th><th>Status</th><th>Buffer</th></tr></thead><tbody>' +
      ps.map(function (p) { return postRow(p, '<td>' + (p.buffer.queued ? '<span class="chip ok">queued</span>' : '<span class="chip">not queued</span>') + '</td>'); }).join('') + '</tbody></table></div>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-bufx]'); if (!b) return; var c = b.getAttribute('data-bufx');
    var q = O.posts.filter(function (p) { var s = stOf(p); return p.channel === c && p.buffer && (s === 'approved' || s === 'scheduled'); }).map(function (p) { return Object.assign({ id: p.id }, p.buffer); });
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(q, null, 1)], { type: 'application/json' })); a.download = 'buffer-queue-' + c + '.json'; a.click();
  });
  function viewChannel(c) {
    var ps = O.posts.filter(function (p) { return p.channel === c; }).slice().reverse(), base = '#/organic/' + c, ND = O.nextdoor;
    var tabs = [['posts', 'Posts', ps.length], ['voice', 'Voice']].concat(c === 'nextdoor' ? [['page', 'Business page', ND.snapshots.length], ['engagement', 'Engagement', ND.days.length]] : [['buffer', 'Buffer']]);
    var h = '<h1>' + esc(CH[c]) + '</h1><p class="lead">' + (c === 'nextdoor' ? 'The Crēdo Legal business page on Nextdoor (live since ' + esc(ND.liveSince) + '): the first campaign’s posts, the four-platform campaign, the page’s metrics and the daily engagement scans.' :
      c === 'facebook' ? 'The Crēdo Legal Facebook page (dormant until this campaign). Posts are published through Buffer once approved.' : c === 'instagram' ? 'The Crēdo Legal Instagram account (dormant until this campaign). Posts are published through Buffer once approved; captions cannot link, the profile link carries the clicks.' :
      'The Crēdo Legal LinkedIn page (about 1,100 followers). Posts are published through Buffer once approved.') + ' The blog-derived posts were removed on 6 Oct.</p>' + tabsBar(base, tabs, TAB);
    if (TAB === 'voice') return h + voiceHtml(c);
    if (TAB === 'buffer') return h + bufferHtml(c);
    if (c === 'nextdoor' && TAB === 'page') { var snap = ND.snapshots[ND.snapshots.length - 1];
      return h + '<div class="mgrid wide">' + mt('Page views', n0(snap.pageViews)) + mt('Post views', n0(snap.postViews)) + mt('Engagements', n0(snap.engagements)) + mt('Faves', n0(snap.faves)) + mt('Recommendations', n0(snap.recs)) + mt('Messages', n0(snap.messages)) + '</div>' +
        '<p class="note">Latest snapshot ' + esc(snap.asOf) + '.</p><div class="scroll"><table class="tbl"><thead><tr><th>As of</th><th class="num">Page views</th><th class="num">Posts</th><th class="num">Post views</th><th class="num">Engagements</th><th>Note</th></tr></thead><tbody>' +
        ND.snapshots.slice().reverse().map(function (x) { return '<tr><td>' + esc(x.asOf) + '</td><td class="num">' + n0(x.pageViews) + '</td><td class="num">' + n0(x.postsPublished) + '</td><td class="num">' + n0(x.postViews) + '</td><td class="num">' + n0(x.engagements) + '</td><td class="sub">' + esc(x.note || '') + '</td></tr>'; }).join('') + '</tbody></table></div>'; }
    if (c === 'nextdoor' && TAB === 'engagement') return h + '<p class="note">Each day’s scan of the neighbourhood feed: the candidate posts for a reaction or comment, and what the queue did with them (engaged, skipped, pending; read live from the shared queue).</p><div class="scroll"><table class="tbl"><thead><tr><th>Day</th><th class="num">Feed posts</th><th class="num">Candidates</th><th class="num">Engaged</th><th class="num">Skipped</th><th class="num">Excluded</th></tr></thead><tbody>' +
      ND.days.slice().reverse().map(function (d) { var q = d.candidates.map(function (x) { return (queueFor(x.id)[0] || {}).status; });
        return '<tr class="clk"' + dr(function (el) { el.classList.add('sel'); drawerDay(d); }) + '><td>' + esc(d.date) + '</td><td class="num">' + n0(d.feedPosts) + '</td><td class="num">' + d.candidates.length + '</td><td class="num">' + q.filter(function (x) { return x === 'engaged'; }).length + '</td><td class="num">' + q.filter(function (x) { return x === 'skipped'; }).length + '</td><td class="num">' + d.excluded.length + '</td></tr>'; }).join('') + '</tbody></table></div>';
    return h + '<div class="scroll"><table class="tbl"><thead><tr><th></th><th>Date</th><th>Post</th><th>Kind</th><th>Status</th><th class="num">Views</th><th class="num">Reactions</th><th class="num">Comments</th></tr></thead><tbody>' +
      ps.map(function (p) { var m = p.metrics || {}; return postRow(p, '<td class="num">' + n0(m.views) + '</td><td class="num">' + n0(m.reactions) + '</td><td class="num">' + n0(m.comments) + '</td>'); }).join('') + '</tbody></table></div>';
  }
  function drawerDay(d) {
    var cand = d.candidates.map(function (c) { var q = queueFor(c.id)[0] || {};
      return '<div class="cmt"><div class="sub">' + esc(c.who + ' · ' + (c.hood || '')) + ' · ' + link(c.url, 'post ↗') + ' <span class="chip ' + (q.status === 'engaged' ? 'ok' : q.status === 'skipped' ? '' : 'warn') + '">' + esc(q.status || 'not queued') + '</span></div>' +
        '<p><b>' + esc(c.subject || '') + '</b></p><p class="sub">' + esc((c.body || '').slice(0, 260)) + '</p>' + (c.why ? '<p>' + esc(c.why) + '</p>' : '') +
        (q.reaction || q.comment ? '<p>Queue: ' + esc([q.reaction, q.comment].filter(Boolean).join(' · ')) + '</p>' : c.suggestReaction || c.suggestComment ? '<p class="sub">Suggested: ' + esc([c.suggestReaction, c.suggestComment].filter(Boolean).join(' · ')) + '</p>' : '') + '</div>'; }).join('');
    var exc = d.excluded.map(function (x) { return '<li>' + esc((x.who || '') + ': ' + (x.subject || '')) + ' <span class="sub">' + esc(x.reason || '') + '</span></li>'; }).join('');
    openDrawer('Engagement · ' + d.date, [['Candidates', cand || '<p class="note">No candidates.</p>'], ['Excluded', exc ? '<ul class="notes">' + exc + '</ul>' : '<p class="note">None.</p>'],
      ['Basic info', kv([['Scanned', esc(d.scannedAt || '')], ['Feed posts', n0(d.feedPosts)], ['Posts from today', n0(d.todayPosts)]])]], true);
  }
  function viewArticles() {
    return '<h1>Articles</h1><p class="lead">The blog articles (a library; the social posts that linked to them were removed from the calendar on 6 Oct). Click a row for details; open an article for its text.</p><div class="scroll"><table class="tbl"><thead><tr><th>Article</th><th>Pillar</th></tr></thead><tbody>' +
      O.articles.map(function (a) { return '<tr class="clk"' + dr(function (el) { el.classList.add('sel'); openDrawer(a.title, [['Basic info', kv([['Pillar', esc(a.pillar)], ['Lifecycle stage', esc(a.lifecycle || '')], ['Link', link(a.link)]]) + '<div class="toolbar">' + go('#/organic/articles/' + enc(a.slug), 'Open the article') + '</div>']]); }) +
        '><td><a href="#/organic/articles/' + enc(a.slug) + '">' + esc(a.title) + '</a></td><td>' + esc(a.pillar) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function viewArticle(a) { return '<h1>' + esc(a.title) + '</h1><p class="lead">' + esc(a.pillar) + ' · ' + link(a.link, 'on the site ↗') + '</p><div class="mdoc article">' + a.html + '</div>'; }
  var ORG = { crumbs: [] };
  function organicHtml() {   /* the organic page for the current hash (also used to re-render after an approval) */
    var parts = location.hash.split('?')[0].replace(/^#\//, '').split('/').map(dec); ORG.crumbs = [['Organic', '#/organic']];
    if (parts[1] === 'articles') { var ar = parts[2] && O.articles.filter(function (x) { return x.slug === parts[2]; })[0]; ORG.crumbs.push(['Articles', '#/organic/articles']); if (ar) ORG.crumbs.push([ar.title, location.hash]); return ar ? viewArticle(ar) : viewArticles(); }
    if (parts[1] === 'campaign' && OC) { ORG.crumbs.push(['Campaign', '#/organic/campaign']); return viewOrgCampaign(); }
    if (CH[parts[1]]) { ORG.crumbs.push([CH[parts[1]], '#/organic/' + parts[1]]); return viewChannel(parts[1]); }
    return viewCalendar();
  }

  /* ───────────── router ───────────── */
  function route() {
    DR = []; closeDrawer();
    var hash = location.hash || '#/website', qs = hash.split('?'); hash = qs[0]; TAB = ((qs[1] || '').match(/(?:^|&)tab=([a-z0-9-]+)/) || [])[1] || null;
    var parts = hash.replace(/^#\//, '').split('/').map(dec), main = $('app-main'), html = '', crumbs = [];
    main.classList.remove('flush'); var after = null;
    if (parts[0] === 'website') {
      crumbs.push(['Website', '#/website']);
      var s = siteBy[parts[1]];
      if (!s) html = viewWebsite();
      else {
        crumbs.push([s.label, '#/website/' + s.angle]);
        var pg = parts[2] ? s.pages.filter(function (x) { return x.id === parts.slice(2).join('/'); })[0] : null;
        if (pg) { crumbs.push([pg.label, hash]); html = viewPage(s, pg); after = TAB ? null : wirePage; } else html = viewSite(s);
      }
    } else if (parts[0] === 'ads') {
      crumbs.push(['Ads', '#/ads']);
      if (parts[1] === 'phones' && PM) { crumbs.push(['Ads → pages → phones', '#/ads/phones']); html = viewPhoneMap(); }
      else {
      var f = findAd(parts[1], parts[2], parts[3], parts[4]);
      if (f.p) crumbs.push([f.p.label, adHref(f.p)]); if (f.c) crumbs.push([f.c.name, adHref(f.p, f.c)]); if (f.g) crumbs.push([f.g.name, adHref(f.p, f.c, f.g)]); if (f.a) crumbs.push([adLabel(f.p, f.a), hash]);
      AFTER = null; html = f.a ? viewAd(f.p, f.c, f.g, f.a) : f.g ? viewGroup(f.p, f.c, f.g) : f.c ? viewCampaign(f.p, f.c) : f.p ? viewPlatform(f.p) : viewAds(); after = AFTER;
      }
    } else if (parts[0] === 'organic' && O) {
      html = organicHtml(); crumbs = crumbs.concat(ORG.crumbs);
    } else if (parts[0] === 'reference') {
      crumbs.push(['Reference', '#/reference/statutes'], ['Statutes', '#/reference/statutes']); html = viewStatutes();
    } else if (parts[0] === 'work' && B) {
      crumbs.push(['Work', '#/work']);
      var pb = parts[1] && B.pbis.filter(function (x) { return x.id === parts[1]; })[0];
      if (pb) { crumbs.push([pb.id, hash]); html = viewPbi(pb); }
      else if (parts[1] === 'decisions') { crumbs.push(['Decisions', hash]); html = viewDecisions(); }
      else if (parts[1] === 'manual') { crumbs.push(['Manual steps', hash]); html = viewManual(); }
      else if (parts[1] === 'rules') { crumbs.push(['Rules', hash]); html = '<div class="mdoc">' + (W ? W.rules : '') + '</div>'; }
      else if (parts[1] === 'changelog') { crumbs.push(['Change log', hash]); html = '<h1>Change log</h1><p class="lead">Every change made to the staging site, item by item, with where it lives in Webflow and how to undo it.</p><div class="mdoc">' + (W ? md(W.changelog.replace(/^# .*\n/, ''), 'review/') : '') + '</div>'; }
      else if (parts[1] === 'reviews' && RV) { crumbs.push(['Reviews', '#/work/reviews']); var rg = parts[2] && RV.groups.filter(function (g) { return g.id === parts[2]; })[0];
        if (rg) { crumbs.push([rg.id, hash]); html = viewReview(rg); } else html = viewReviews(); }
      else if (parts[1] === 'doc' && RV && RV.docs[parts[2]] != null) { crumbs.push(['Reviews', '#/work/reviews'], [parts[2].replace(/^review\//, ''), hash]); html = viewDoc(parts[2]); }
      else html = viewBoard();
    } else if (parts[0] === 'more' && /^[a-z]+\.html$/.test(parts[1] || '')) {
      crumbs.push([parts[1].replace('.html', ''), hash]); main.classList.add('flush');
      html = '<iframe class="embed" src="' + parts[1] + '?embed=1" title="' + esc(parts[1]) + '"></iframe>';
    } else { location.replace('#/website'); return; }
    main.innerHTML = html; main.scrollTop = 0; if (after) after();
    $('app-crumbs').innerHTML = crumbs.map(function (c, i) { return (i ? '<span class="sep">›</span>' : '') + '<a href="' + esc(c[1]) + '">' + esc(c[0]) + '</a>'; }).join('');
    document.title = (crumbs.length ? crumbs[crumbs.length - 1][0] + ' · ' : '') + 'Marketing Hub · Crēdo Legal';
    renderTree(); $('app-nav').classList.remove('open'); $('app-menu').setAttribute('aria-expanded', 'false');
  }

  /* ───────────── wiring ───────────── */
  function header() {
    var r = '';
    if (M) r += '<label>Period <select id="app-period">' + Object.keys(M.periods).map(function (k) { return '<option value="' + k + '"' + (k === Hub.periodKey ? ' selected' : '') + '>' + esc(M.periods[k].label) + '</option>'; }).join('') + '</select></label><span class="mh-chip ok">Metrics: local</span>';
    else r += '<span class="mh-chip warn">Metrics locked</span>';
    $('app-right').innerHTML = r + '<span class="mh-chip">Local only</span>';
    var sel = $('app-period'); if (sel) sel.addEventListener('change', function () { try { localStorage.setItem('mh-period', sel.value); } catch (e) {} location.reload(); });
  }
  document.addEventListener('click', function (e) {
    var dt = e.target.closest('[data-dtab]'); if (dt) { pickDrawerTab(+dt.getAttribute('data-dtab')); return; }
    var t = e.target.closest('[data-tog]');
    if (t) { var k = t.getAttribute('data-tog'); expanded[k] = t.getAttribute('aria-expanded') !== 'true'; renderTree(); return; }
    var d = e.target.closest('[data-dr]');
    if (d && !e.target.closest('a')) { [].forEach.call(document.querySelectorAll('.sel'), function (x) { x.classList.remove('sel'); }); DR[+d.getAttribute('data-dr')](d); }
  });
  $('drawer-close').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if ($('app-drawer').classList.contains('open')) closeDrawer(); else $('app-nav').classList.remove('open'); } });
  $('app-filter').addEventListener('input', renderTree);
  $('app-menu').addEventListener('click', function () { var o = $('app-nav').classList.toggle('open'); $('app-menu').setAttribute('aria-expanded', String(o)); });
  window.addEventListener('hashchange', route);
  header(); route(); loadComments();
})();
