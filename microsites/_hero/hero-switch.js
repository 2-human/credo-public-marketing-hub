/* Hero image switcher for the prototype pages (operator 28 Oct 2026: "come up with alternative hero images for these pages
 * and all other pages in the hub. There should be a switcher for them in the prototype. Produce 2 more alternative hero
 * images, so that each is contextually relevant for the page and its message and value proposition.")
 * Swaps the page's .hero-photo between the current staging photo and the page's two alternatives (heroes.js, written by
 * tools/marketing-hub/bake-heroes.py; images in assets/heroes/). The page is <html data-hero-id="…">, set by
 * build-microsites.mjs for mirrored pages and by the hub for new pages. ?hero=0|1|2 picks one; the choice is kept per page
 * in this browser. The control sits outside <main> and <footer>, so the page itself stays identical to staging. */
(function () {
  var me = document.currentScript, base = new URL('../../assets/heroes/', me.src).href;
  function start() {
    var H = window.CREDO_HEROES || {}, id = document.documentElement.getAttribute('data-hero-id'), alts = H[id], img = document.querySelector('img.hero-photo');
    if (!img || !alts || !alts.length) return;
    var opts = [{ src: img.getAttribute('src'), srcset: img.getAttribute('srcset'), sizes: img.getAttribute('sizes'), alt: img.getAttribute('alt'), label: 'Current', concept: 'The staging photo' }]
      .concat(alts.map(function (a, i) { return { src: base + a.file, srcset: null, sizes: null, alt: a.alt, label: 'Alt ' + (i + 1), concept: a.concept }; }));
    var key = 'credo-hero:' + id, q = new URLSearchParams(location.search).get('hero'), cur = 0;
    try { cur = +(q != null ? q : localStorage.getItem(key) || 0) || 0; } catch (e) { cur = +(q || 0) || 0; }
    var bar = document.createElement('div');
    bar.setAttribute('data-hero-switch', ''); bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Hero image');
    bar.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483000;display:flex;align-items:center;gap:4px;padding:6px 8px;background:rgba(17,20,24,.88);color:#fff;border-radius:999px;font:600 12px/1 system-ui,-apple-system,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25)';
    bar.innerHTML = '<span style="padding:0 6px 0 4px;opacity:.8">Hero image</span>' + opts.map(function (o, i) {
      return '<button type="button" data-i="' + i + '" title="' + o.concept.replace(/"/g, '&quot;') + '" style="border:0;border-radius:999px;padding:6px 10px;font:inherit;cursor:pointer">' + o.label + '</button>'; }).join('');
    function show(i) {
      var o = opts[i] || opts[0]; cur = opts[i] ? i : 0;
      img.src = o.src; if (o.srcset) img.setAttribute('srcset', o.srcset); else img.removeAttribute('srcset'); if (o.sizes) img.setAttribute('sizes', o.sizes); else img.removeAttribute('sizes'); img.alt = o.alt || '';
      [].forEach.call(bar.querySelectorAll('button'), function (b, k) { var on = k === cur; b.setAttribute('aria-pressed', String(on)); b.style.background = on ? '#c92028' : 'transparent'; b.style.color = '#fff'; });
      try { localStorage.setItem(key, String(cur)); } catch (e) {}
    }
    bar.addEventListener('click', function (e) { var b = e.target.closest('button[data-i]'); if (b) show(+b.getAttribute('data-i')); });
    document.body.appendChild(bar); show(cur);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
