/* M13 reference sign-in store: window.HubAuth for the key-gated gate (chassis/gate-key.js), on Firebase Auth by email link,
 * with the key ring read from one Firestore document. Built from library/features/auth-gate/email-link-sign-in.md and
 * key-gated-bundle.md. Optional: a hub may keep its own store with the same members (FEATURE.md, Gates). Never edited per hub.
 *
 * Load it from gate.scripts after the web config: gate: { scripts: ['firebase-config.js', 'chassis/gate-store.js'], ... }.
 * Settings, all in hub.config.js gate:
 *   keyDoc    Firestore path of the key document, e.g. 'hubs/<hub>/meta/gate', holding keys: [newest, ...]. Required to open.
 *   roles     roles that may open the hub, read from the account's `role` custom claim. Default: any role at all.
 *   sdk       Firebase JS SDK version, default 10.12.0. Every Firebase copy on a site moves in lockstep (firebase-config-global).
 *   firebase  name of the web config global, default FIREBASE_CONFIG. Its `emulator` (true, or { auth, firestore } ports)
 *             talks to the local emulators instead. work-setup/build/publish_gated.sh reads only window.FIREBASE_CONFIG, to
 *             refuse an emulator config or another project's, so a hub it publishes keeps the default name.
 *   store     the global this store sets, default HubAuth.
 *
 * Nothing runs until the gate calls init(), which happens only on the published mirror (gate-mode.js true).
 *   - A sign-in link is finished before the first auth state. Only Firebase's own query parameters leave the address (the
 *     page's own, such as ?review=1, stay), and the screen asked for when the link was sent comes back with
 *     history.replaceState, before the hub first renders. The email and the screen wait in localStorage under the hub's
 *     storage prefix, and are removed once used.
 *   - The role is the account's `role` custom claim. canRead() is true for a role in `roles`.
 *   - gateKeys() reads the ring over Firestore REST as the signed-in account, every visit; nothing that opens the hub is kept.
 *   - A sign-in or sign-out in another tab reloads the page, so no part of it keeps the previous account. signOut() leaves the
 *     reload to its caller (the gate and the menu's account line reload after it), so two reloads never race.
 *   - firebase() gives a store that does more (answers, comments) the same app, auth and SDK version:
 *     HubAuth.firebase().then(function (fb) { return fb.sdk('firestore'); }). */
(function () {
  var C = window.HUB_CONFIG || {}, G = C.gate || {}, H = window.Hub;
  var SDK = 'https://www.gstatic.com/firebasejs/' + (G.sdk || '10.12.0') + '/firebase-';
  var ROLES = G.roles || null, KEY_DOC = String(G.keyDoc || '').replace(/^\/+|\/+$/g, '');
  var MAIL = 'signin-email', ROUTE = 'signin-route', FIREBASE_PARAMS = ['mode', 'oobCode', 'apiKey', 'lang', 'continueUrl', 'tenantId'];
  var INIT = null, FB = null, REST = '', LEAVING = false;
  var sdk = function (name) { return import(SDK + name + '.js'); };
  var get = function (k) { return H.store.get(k) || ''; };
  var put = function (k, v) { if (v) H.store.set(k, v); else H.store.del(k); };
  H.labelDefaults({ gateConfirmEmail: 'Confirm your email address to finish signing in' });

  /* a sign-in link lands here with ?mode=signIn&oobCode=…: the route back, Firebase's parameters out, then the sign-in */
  function finishLink(Au, auth) {
    var href = location.href; if (!Au.isSignInWithEmailLink(auth, href)) return null;
    var email = get(MAIL);
    if (!email) { try { email = (window.prompt(H.t('gateConfirmEmail')) || '').trim(); } catch (e) {} }   /* another device */
    var u = new URL(href); FIREBASE_PARAMS.forEach(function (k) { u.searchParams.delete(k); });
    var back = get(ROUTE); put(ROUTE, '');
    history.replaceState(null, '', u.pathname + u.search + (u.hash || back));
    if (!email) { api.signInError = 'auth/missing-email'; return null; }
    return Au.signInWithEmailLink(auth, email, href).then(function () { put(MAIL, ''); })
      .catch(function (e) { api.signInError = (e && e.code) || 'failed'; console.warn('[gate-store] sign-in link', (e && e.code) || e); });
  }

  /* sign-in state, once per page: finishes a link in the address, then settles on the first auth state */
  function init() {
    if (INIT) return INIT;
    var cfg = window[G.firebase || 'FIREBASE_CONFIG'];
    if (!cfg || !cfg.apiKey || !cfg.projectId) return (INIT = Promise.reject(new Error('no Firebase web config in window.' + (G.firebase || 'FIREBASE_CONFIG'))));
    var opts = {}; Object.keys(cfg).forEach(function (k) { if (k !== 'emulator') opts[k] = cfg[k]; });
    var emu = cfg.emulator === true ? {} : cfg.emulator || null;
    REST = (emu ? 'http://127.0.0.1:' + (emu.firestore || 8080) : 'https://firestore.googleapis.com') + '/v1/projects/' + encodeURIComponent(cfg.projectId) + '/databases/(default)/documents/';
    INIT = Promise.all([sdk('app'), sdk('auth')]).then(function (M) {
      /* this store owns sign-in, so it owns [DEFAULT]: found by name, since getApp() throws app/no-app when the only app on
       * the page is a feature's own named one (library/features/firebase-config-global/FEATURE.md) */
      var A = M[0], Au = M[1], app = A.getApps().filter(function (a) { return a.name === '[DEFAULT]'; })[0] || A.initializeApp(opts), auth = Au.getAuth(app);
      if (emu) Au.connectAuthEmulator(auth, 'http://127.0.0.1:' + (emu.auth || 9099), { disableWarnings: true });
      FB = { app: app, auth: auth, Au: Au };
      return Promise.resolve(finishLink(Au, auth)).then(function () {
        return new Promise(function (ok) {
          var first = true;
          Au.onAuthStateChanged(auth, function (u) {
            if (!first) { if (!LEAVING && (u ? u.uid : null) !== (api.user ? api.user.uid : null)) location.reload(); return; }
            first = false; if (!u) return ok();
            u.getIdTokenResult().then(function (r) {
              api.user = { uid: u.uid, email: u.email, name: u.displayName || u.email, role: r.claims.role || '', claims: r.claims }; ok();
            }, function () { ok(); });
          });
        });
      });
    });
    return INIT;
  }

  /* a Firestore REST document: keys: { arrayValue: { values: [{ stringValue }] } } */
  function ring(doc) { return ((((doc.fields || {}).keys || {}).arrayValue || {}).values || []).map(function (v) { return v.stringValue; }).filter(Boolean); }

  var api = window[G.store || 'HubAuth'] = {
    user: null, signInError: null,
    init: init,
    canRead: function () { return !!api.user && (ROLES ? ROLES.indexOf(api.user.role) >= 0 : !!api.user.role); },
    /* the hub's decryption keys, newest first, read as the signed-in account; the rules let only the roles read them */
    gateKeys: function () {
      return init().then(function () {
        if (!api.canRead() || !FB.auth.currentUser) return [];
        if (!KEY_DOC) throw new Error('gate.keyDoc is not set in hub.config.js');
        return FB.auth.currentUser.getIdToken().then(function (tok) {
          return fetch(REST + KEY_DOC.split('/').map(encodeURIComponent).join('/'), { headers: { Authorization: 'Bearer ' + tok }, cache: 'no-store' });
        }).then(function (r) {
          if (r.status === 404) return [];
          if (!r.ok) throw new Error('key ring: ' + r.status);
          return r.json().then(ring);
        });
      });
    },
    /* emails a one-time link; only accounts an admin created can use it. No #route in the continue address: Firebase appends
     * its parameters, so the route waits in localStorage until the link is finished. */
    signIn: function (email) {
      return init().then(function () {
        return FB.Au.sendSignInLinkToEmail(FB.auth, email, { url: location.origin + location.pathname + location.search, handleCodeInApp: true })
          .then(function () { put(MAIL, email); put(ROUTE, location.hash); });
      });
    },
    signOut: function () { LEAVING = true; return FB ? FB.Au.signOut(FB.auth) : Promise.resolve(); },
    /* for a store that does more on the same account: { app, auth, sdk(name) -> import of that Firebase module } */
    firebase: function () { return init().then(function () { return { app: FB.app, auth: FB.auth, sdk: sdk }; }); }
  };
})();
