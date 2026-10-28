/* Credo Legal — Marketing Hub prototype pages · review widget config (28 Oct 2026).
 *
 * The widget is the plain-page composition of public/harassment-lp/ (pathname pages, not the hub's hash routes).
 * Source: tools/marketing-hub/microsites/_review/; build-microsites.mjs copies it to public/marketing-hub/microsites/_review/
 * and adds it to the main-site prototypes of About, Privacy, Terms of Use and Cookie Policy only (microsites/default/), with the Firebase hosts added
 * to those pages' Content-Security-Policy. Comments go to the shared Credo database (credo-712c4 /comments).
 * pageKey keeps the comment key stable on any host (localhost or the GitHub Pages mirror): "credo-prototype:<file>",
 * so the same page in another microsite folder would share its comments.
 */
window.CREDO_REVIEW_CONFIG = {
  /* "All pages" lists only these prototype pages, not the other Credo hubs' comments in the same database */
  pageFilter: function (page) { return page.indexOf('credo-prototype:') === 0; },
  pageKey: function (loc) { return 'credo-prototype:' + ((loc.pathname.split('/').pop() || 'index').replace(/\.html?$/, '') || 'index'); },
  FIREBASE_CONFIG: {
    apiKey: "AIzaSyCQvyKmdjRlIBcRW8CbC73Ew9o5uFp9jt0",
    authDomain: "credo-712c4.firebaseapp.com",
    databaseURL: "https://credo-712c4-default-rtdb.firebaseio.com",
    projectId: "credo-712c4",
    storageBucket: "credo-712c4.firebasestorage.app",
    messagingSenderId: "494337801532",
    appId: "1:494337801532:web:298e363efe2ed11807f239"
  },
  REVIEW_LABELS: {
    toggleButton: "Comments",
    toggleButtonTitle: "Open comment review mode",
    bannerTitle: "Review mode · Credo website prototype",
    localOnly: "Local-only — add Firebase config for shared comments",
    exit: "Exit review",
    sidebarTitle: "Comments",
    empty: "No comments on this LP yet. Hover any line of text and click the + to add one.",
    add: "+ Comment",
    save: "Post comment",
    cancel: "Cancel",
    edit: "Edit",
    del: "Delete",
    resolve: "Resolve",
    reopen: "Reopen",
    tabOpen: "Open",
    tabResolved: "Resolved",
    resolvePrompt: "Resolution note (what was done):",
    placeholder: "Your feedback…",
    replacementPlaceholder: "Suggested change (optional)…",
    namePrompt: "Your name (so the team knows who left this comment):"
  }
};
