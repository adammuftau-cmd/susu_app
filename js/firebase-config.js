// ============================================================
// FIREBASE CONFIG — replace with YOUR project's values.
// Get these from: Firebase Console → Project Settings → General
// → "Your apps" → Web app → SDK setup and configuration
// ============================================================
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// PLACEHOLDER_CHECK
if (firebaseConfig.apiKey === "YOUR_API_KEY") {
  console.warn("Ledger: js/firebase-config.js still has placeholder values. Paste in your real Firebase config.");
}
