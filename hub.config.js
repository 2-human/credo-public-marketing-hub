/* Crēdo Legal Marketing Hub on hub-chassis 1.4.0: the thin config (identity, tokens, labels, file lists, storage prefix).
 * Navigation, text and figures are in data/ and views/. */
window.HUB_CONFIG = {
  id: 'credo-marketing-hub', title: 'Marketing Hub · Crēdo Legal', lang: 'en', locale: 'en-US', currency: 'USD',
  home: '/overview', theme: 'auto',
  brand: { name: 'Marketing Hub', sub: 'Crēdo Legal' },
  /* light = the old hub's palette; dark = a cool slate built on the old bar colour, text AA on every surface (skin.css holds the Credo-only tints) */
  tokens: { accent: '#c8323c', bg: '#f6f7f9', soft: '#f2f4f7', line: '#e3e6ea', ink: '#14181d', mute: '#667080', head: '#14181d',
    card: '#fff', accentSoft: '#e9edf3', onAccent: '#fff', ok: '#0b6b3a', okBg: '#eefaf2', warn: '#8a5200', warnBg: '#fff7e8', bad: '#8a1f26', badBg: '#fdf0f1',
    shadow: 'rgba(20,24,29,.14)' },
  tokensDark: { accent: '#f0767d', bg: '#111418', soft: '#232831', line: '#343b46', ink: '#e6e9ee', mute: '#9aa3b0', head: '#f3f5f8',
    card: '#1a1e24', accentSoft: '#2a313c', onAccent: '#111418', ok: '#6fd39b', okBg: '#12301f', warn: '#e8b65c', warnBg: '#352a12', bad: '#f3949a', badBg: '#3d1c20',
    shadow: 'rgba(0,0,0,.5)' },
  fonts: { body: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif' },
  skin: ['skin.css?v=f08e63ec05'],
  storage: { prefix: 'credo-mh' },
  modules: ['canvas'],   /* M10 diagram canvas: Work › Lead journey (views/journey.js) */
  /* the generated data files (tools/marketing-hub/build-*.mjs), in the old gate's order; the views need the first three */
  data: ['data/registry.js', 'data/microsites.js', 'data/ads-tree.js',
    'data/text/core.js', 'data/text/overview.js', 'data/text/website.js', 'data/text/reference.js', 'data/text/ads.js', 'data/text/google.js', 'data/text/platforms.js', 'data/text/streams.js', 'data/text/terms.js', 'data/text/organic.js', 'data/text/work.js', 'data/text/more.js', 'data/text/people.js', 'data/text/search.js', 'data/text/vault.js', 'data/text/journey.js', 'data/text/share.js',
    'data/review-config.js'],
  dataOptional: ['data/metrics.js', 'data/ads-metrics.js', 'data/phone-map.js', 'data/backlog-data.js', 'data/work.js', 'data/reviews.js', 'data/statutes.js',
    'data/organic.js', 'data/ad-copy.js', 'data/google-account.js', 'data/platforms.js', 'data/handoff.js', 'data/stream2.js', 'data/stream3.js', 'data/stream4.js',
    'data/retargeting.js', 'data/stream5.js', 'data/streams.js', 'data/disclaimers.js', 'data/heroes.js', 'data/people.js', 'data/questions.js', 'data/glossary.js', 'data/brand.js', 'data/vault.js', 'data/journey.js'],
  views: ['views/core.js', 'views/overview.js', 'views/website.js', 'views/reference.js', 'views/ads.js', 'views/google.js', 'views/platforms.js',
    'views/streams.js', 'views/terms.js', 'views/organic.js', 'views/work.js', 'views/more.js', 'views/people.js', 'views/glossary.js', 'views/brand.js', 'views/vault.js', 'views/journey.js', 'views/search.js',
    'views/share-rules.js', 'views/public-view.js'],   /* Public view (pages shared by link, no sign-in): the rules, then the button, panel and capture */
  /* page code the chassis loads once the hub runs (1.4.0 `after`): versioned by the publisher, so the review widget is never served stale */
  after: ['review-bootstrap.js?v=8117193a55'],
  /* personal sign-in (M13 key-gated, chassis/gate-key.js + the chassis's reference store chassis/gate-store.js since 12 Nov; the menu foot shows
   * "Signed in as …" with Sign out): Credo's Firebase credo-712c4, accounts and roles in tools/hub-firebase.
   * Locally gate-mode.js is false and the hub boots without sign-in; the published mirror's copy is true. */
  gate: { scripts: ['firebase-config.js?v=66d7a6dcb2', 'chassis/gate-store.js'], store: 'HubAuth', keyDoc: 'hubs/credo-mh/meta/gate', roles: ['admin', 'team'] },
  labels: { gateTitle: 'Marketing Hub · Crēdo Legal', filter: 'Filter the navigation', copyLink: 'Copy link', closeDrawer: 'Close the details', menu: 'Show navigation', navigation: 'Hub navigation',
    /* the public page view.html (a public file: it cannot read the bundle's data/text) */
    pubLoading: 'Loading…', pubNotShared: 'This page is not shared', pubNotSharedBody: 'The link may have been turned off. Ask the person who sent it for a new one.',
    pubFailed: 'This page could not be loaded. Try again in a moment.', pubMenu: 'Pages in this link', pubClose: 'Close the details',
    pubPdf: 'Save as PDF', pubCopyLink: 'Copy link to this screen', pubCopyLinkHint: 'Copies the address of what you see now, with any open details', pubCopied: 'Copied',
    pubFoot: 'A read-only copy of the Crēdo Legal Marketing Hub, made {date}.' }
};
