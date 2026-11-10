/* The Marketing Hub's Firebase project (credo-712c4, web app "Credo Meta Ads Review", shared with the review widgets).
 * Public by design: access is decided by email-link sign-in, the account's role claim and the Firestore rules
 * (firebase/), not by keeping this hidden. The object below is plain JSON so tools can read it; the publish script
 * (tools/marketing-hub/publish-hub.sh) refuses a config for another project or one that points at the emulators. */
window.FIREBASE_CONFIG = {
  "apiKey": "AIzaSyCQvyKmdjRlIBcRW8CbC73Ew9o5uFp9jt0",
  "authDomain": "credo-712c4.firebaseapp.com",
  "projectId": "credo-712c4",
  "storageBucket": "credo-712c4.firebasestorage.app",
  "messagingSenderId": "494337801532",
  "appId": "1:494337801532:web:298e363efe2ed11807f239"
};
