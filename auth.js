/* The Marketing Hub's sign-in store, window.HubAuth, for the chassis's key-gated gate (hub-chassis M13, chassis/gate-key.js;
 * library features/auth-gate/key-gated-bundle.md and email-link-sign-in.md). Public page code: it holds no data.
 *
 * Firebase project in window.FIREBASE_CONFIG (firebase-config.js). People sign in with their own account by a one-time
 * email link; public sign-up is closed, so a link works only for an account the operator created
 * (tools/hub-firebase/firebase-accounts.mjs). The account's `role` claim decides access, and firebase/firestore.rules
 * enforce the same: admin and team may read the hub's key ring at hubs/credo-mh/meta/gate; nothing else is readable.
 *
 * Nothing here runs until the gate calls init(), which happens only on the published mirror (gate-mode.js true). Locally
 * the plaintext files load and nobody signs in. The route asked for (#/…) is kept across the link in localStorage, and only
 * Firebase's own query parameters are removed when the link is finished. A sign-in or sign-out in another tab reloads;
 * signOut() leaves the reload to its caller.
 * Nothing that opens the hub is kept in the browser: the ring is read again on every visit, as the signed-in account.
 *
 * A config with `emulator: { auth, firestore }` (ports) talks to the local emulators instead; the publish script refuses
 * such a config. */
(function () {
  var KEY_DOC = 'hubs/credo-mh/meta/gate', ROLES = ['admin', 'team'];
  var MAILKEY = 'credo_mh_signin_email', HASHKEY = 'credo_mh_signin_route';
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-';
  var INIT = null, AU = null, FS = '', LEAVING = false;
  var label = function (k, d) { var L = (window.HUB_CONFIG || {}).labels || {}; return L[k] || d; };
  var get = function (k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  var put = function (k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} };

  /* A sign-in link lands here with ?mode=signIn&oobCode=…: put the route asked for back before anything renders, drop only
   * Firebase's parameters (the page's own, such as ?review=1, stay), then finish the sign-in. */
  function finishLink(Au, auth) {
    var href = location.href; if (!Au.isSignInWithEmailLink(auth, href)) return null;
    var email = get(MAILKEY);
    if (!email) { try { email = (window.prompt(label('signInConfirmEmail', 'Confirm your email address to finish signing in')) || '').trim(); } catch (e) {} }
    var u = new URL(href); ['mode', 'oobCode', 'apiKey', 'lang', 'continueUrl', 'tenantId'].forEach(function (k) { u.searchParams.delete(k); });
    var back = get(HASHKEY); put(HASHKEY, '');
    history.replaceState(null, '', u.pathname + u.search + (u.hash || back));
    if (!email) { api.signInError = 'auth/missing-email'; return null; }
    return Au.signInWithEmailLink(auth, email, href).then(function () { put(MAILKEY, ''); })
      .catch(function (e) { api.signInError = e.code || 'failed'; console.warn('[auth] sign-in link', e.code || e); });
  }

  /* Sign-in state, once per page: finishes a link in the address, then settles on the first auth state. */
  function init() {
    if (INIT) return INIT;
    var cfg = window.FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey || !cfg.projectId) return (INIT = Promise.resolve());
    var fb = {}; Object.keys(cfg).forEach(function (k) { if (k !== 'emulator') fb[k] = cfg[k]; });
    var emu = cfg.emulator;
    FS = (emu ? 'http://127.0.0.1:' + emu.firestore : 'https://firestore.googleapis.com') + '/v1/projects/' + cfg.projectId + '/databases/(default)/documents/';
    INIT = Promise.all([import(SDK + 'app.js'), import(SDK + 'auth.js?v=fa6ed78dbe')]).then(function (M) {
      var A = M[0], Au = M[1];
      var app = A.getApps().length ? A.getApp() : A.initializeApp(fb), auth = Au.getAuth(app);
      if (emu) Au.connectAuthEmulator(auth, 'http://127.0.0.1:' + emu.auth, { disableWarnings: true });
      AU = { Au: Au, auth: auth };
      return Promise.resolve(finishLink(Au, auth)).then(function () {
        return new Promise(function (ok) {
          var first = true;
          Au.onAuthStateChanged(auth, function (u) {
            /* an account change after start (another tab) reloads, so nothing of the previous account stays; signOut() here
             * leaves the reload to its caller (the gate and the menu reload after it), so two reloads never race */
            if (!first) { if (!LEAVING && (u ? u.uid : null) !== (api.user ? api.user.uid : null)) location.reload(); return; }
            first = false; if (!u) return ok();
            u.getIdTokenResult().then(function (t) { api.user = { uid: u.uid, email: u.email, role: t.claims.role || '' }; ok(); }, function () { ok(); });
          });
        });
      });
    });
    return INIT;
  }

  /* Fields of a Firestore REST document: keys: { arrayValue: { values: [{ stringValue }] } } */
  function ring(doc) { return (((doc.fields || {}).keys || {}).arrayValue || {}).values || []; }

  var api = window.HubAuth = {
    user: null, signInError: null,
    init: init,
    canRead: function () { return !!api.user && ROLES.indexOf(api.user.role) >= 0; },
    /* the hub's decryption keys, newest first; the rules let only admin and team read them */
    gateKeys: function () {
      return init().then(function () {
        if (!api.canRead() || !AU.auth.currentUser) return [];
        return AU.auth.currentUser.getIdToken().then(function (tok) {
          return fetch(FS + KEY_DOC, { headers: { Authorization: 'Bearer ' + tok }, cache: 'no-store' });
        }).then(function (r) {
          if (r.status === 404) return [];
          if (!r.ok) throw new Error('key ring: ' + r.status);
          return r.json().then(function (d) { return ring(d).map(function (v) { return v.stringValue; }).filter(Boolean); });
        });
      });
    },
    /* emails a one-time link; only accounts the operator created can use it. The continue address carries no #route:
     * Firebase appends its parameters, so the route waits in localStorage until the link is finished. */
    signIn: function (email) {
      return init().then(function () {
        if (!AU) throw new Error('no sign-in backend');
        return AU.Au.sendSignInLinkToEmail(AU.auth, email, { url: location.origin + location.pathname + location.search, handleCodeInApp: true })
          .then(function () { put(MAILKEY, email); put(HASHKEY, location.hash); });
      });
    },
    signOut: function () { LEAVING = true; return AU ? AU.Au.signOut(AU.auth) : Promise.resolve(); }
  };

  /* Once the hub has opened behind the gate: who is signed in, and a way out, at the foot of the menu. */
  window.addEventListener('auth-granted', function () {
    var nav = document.getElementById('app-nav'); if (!nav || !api.user || document.getElementById('hub-account')) return;
    var row = document.createElement('div'); row.id = 'hub-account'; row.className = 'hub-account';
    row.style.cssText = 'margin-top:16px;padding-top:10px;border-top:1px solid var(--line,#ddd);font-size:12px;color:var(--mute,#666);overflow-wrap:anywhere';
    var who = document.createElement('span'); who.textContent = api.user.email + ' · ';
    var out = document.createElement('button'); out.type = 'button'; out.className = 'linkbtn';
    out.textContent = label('gateSignOut', 'Sign out');
    out.onclick = function () { api.signOut().then(function () { location.reload(); }); };
    row.appendChild(who); row.appendChild(out); nav.appendChild(row);
  });
})();
