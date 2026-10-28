// ============================================================
// FIREBASE CONFIG — replace with YOUR project's values.
// Get these from: Firebase Console → Project Settings → General
// → "Your apps" → Web app → SDK setup and configuration
// ============================================================
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyDhxMVDr54Xla7xDUh47xvf5_12rNf2Q-o",
  authDomain: "susu-f485e.firebaseapp.com",
  databaseURL: "https://susu-f485e-default-rtdb.firebaseio.com",
  projectId: "susu-f485e",
  storageBucket: "susu-f485e.firebasestorage.app",
  messagingSenderId: "403940740905",
  appId: "1:403940740905:web:05ce061274056ef15c3138",
  measurementId: "G-865N93286F"
};
// PLACEHOLDER_CHECK
if (firebaseConfig.apiKey === "YOUR_API_KEY") {
  console.warn("Ledger: js/firebase-config.js still has placeholder values. Paste in your real Firebase config.");
}
