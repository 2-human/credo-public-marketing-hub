/* Credo Marketing Hub · review widget config (MH-95, operator 27 Oct 2026).
 *
 * Comments go to the shared Firebase Realtime Database of the other Credo hubs (project credo-712c4, /comments), as
 * records with page "credo-marketing-hub:<route>" (the hub's hash route, plus ?tab when a tab is open) and, for a
 * comment left in a drawer, drawer "d=<item>&dt=<tab>" (the hub's own drawer permalink).
 * Operator 27 Oct: no text preview is stored — the database is readable without the hub password, so a record holds the
 * route, the anchor and the comment only; the widget shows the element's text live when its page is open.
 * The drawer "Comments" tabs (page "credo-marketing-hub") and organic approvals (page "organic-approval") are separate
 * records and are not shown in this widget.
 */
window.CREDO_REVIEW_CONFIG = {
  FIREBASE_CONFIG: {
    apiKey: "AIzaSyCQvyKmdjRlIBcRW8CbC73Ew9o5uFp9jt0",
    authDomain: "credo-712c4.firebaseapp.com",
    databaseURL: "https://credo-712c4-default-rtdb.firebaseio.com",
    projectId: "credo-712c4",
    storageBucket: "credo-712c4.firebasestorage.app",
    messagingSenderId: "494337801532",
    appId: "1:494337801532:web:298e363efe2ed11807f239"
  },
  PAGE_PREFIX: 'credo-marketing-hub:',
  REVIEW_LABELS: {
    toggleButton: "Comments",
    toggleButtonTitle: "Open comment review mode",
    bannerTitle: "Review mode · Marketing Hub",
    localOnly: "Local-only — add Firebase config for shared comments",
    exit: "Exit review",
    sidebarTitle: "Comments",
    empty: "No comments on this screen yet. Hover any text and click the + to add one.",
    add: "+ Comment",
    save: "Post comment",
    cancel: "Cancel",
    edit: "Edit",
    del: "Delete",
    resolve: "Resolve",
    reopen: "Reopen",
    tabOpen: "Open",
    tabResolved: "Resolved",
    scopePage: "This screen",
    scopeAll: "All screens",
    thisPage: "This screen",
    hideSide: "Hide comments",
    showSide: "Show comments",
    resolvePrompt: "Resolution note (what was done):",
    placeholder: "Your feedback…",
    replacementPlaceholder: "Suggested change (optional)…",
    namePrompt: "Your name (so the team knows who left this comment):"
  }
};
