import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, addDoc, updateDoc,
  collection, query, where, orderBy, serverTimestamp, increment, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestore = getFirestore(app);

// ---------------- AUTH ----------------

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signUp(email, password, name, phone) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  // First-ever account on the whole system becomes admin.
  const usersSnap = await getDocs(collection(firestore, "users"));
  if (usersSnap.empty) {
    await setDoc(doc(firestore, "users", uid), { name, phone, email, role: "admin", createdAt: serverTimestamp() });
    return "admin";
  }

  // If the admin already created a collector record with this email (an invite),
  // claim it: link this auth account to that existing collector doc.
  const colQ = query(collection(firestore, "collectors"), where("email", "==", email), where("uid", "==", null));
  const colSnap = await getDocs(colQ);
  if (!colSnap.empty) {
    const collectorDoc = colSnap.docs[0];
    await updateDoc(doc(firestore, "collectors", collectorDoc.id), { uid });
    await setDoc(doc(firestore, "users", uid), {
      name, phone, email, role: "collector", collectorRef: collectorDoc.id, createdAt: serverTimestamp()
    });
    return "collector";
  }

  // If the admin already created a customer record with this email (an invite),
  // claim it: link this auth account to that existing customer doc.
  const custQ = query(collection(firestore, "customers"), where("email", "==", email), where("uid", "==", null));
  const custSnap = await getDocs(custQ);
  if (!custSnap.empty) {
    const customerDoc = custSnap.docs[0];
    await updateDoc(doc(firestore, "customers", customerDoc.id), { uid });
    await setDoc(doc(firestore, "users", uid), {
      name, phone, email, role: "customer", customerRef: customerDoc.id, createdAt: serverTimestamp()
    });
    return "customer";
  }

  // Otherwise: a brand-new, self-registered customer.
  await setDoc(doc(firestore, "users", uid), {
    name, phone, email, role: "customer", customerRef: uid, createdAt: serverTimestamp()
  });
  await setDoc(doc(firestore, "customers", uid), {
    uid, name, phone, email, accountNumber: genAccountNumber(),
    collectorId: null, balance: 0, createdAt: serverTimestamp()
  });
  return "customer";
}

export async function logIn(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logOut() {
  await signOut(auth);
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(firestore, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

function genAccountNumber() {
  return "SU" + Math.floor(100000 + Math.random() * 900000);
}

function genReceiptNumber() {
  return "RCT-" + Date.now().toString(36).toUpperCase();
}

// ---------------- ADMIN: COLLECTORS ----------------

export async function createCollector(name, phone, email) {
  const ref = await addDoc(collection(firestore, "collectors"), {
    name, phone, email, uid: null, active: true, createdAt: serverTimestamp()
  });
  return ref.id;
}

export function listCollectors(callback) {
  return onSnapshot(collection(firestore, "collectors"), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ---------------- ADMIN: CUSTOMERS ----------------

export function listCustomers(callback) {
  return onSnapshot(collection(firestore, "customers"), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function assignCollector(customerId, collectorId) {
  await updateDoc(doc(firestore, "customers", customerId), { collectorId });
}

export async function createCustomerByAdmin(name, phone, email, collectorId) {
  const ref = await addDoc(collection(firestore, "customers"), {
    uid: null, name, phone, email: email || null,
    accountNumber: genAccountNumber(), collectorId: collectorId || null,
    balance: 0, createdAt: serverTimestamp()
  });
  return ref.id;
}

// ---------------- COLLECTIONS (daily deposits) ----------------

export async function recordCollection(customerId, collectorId, amount, note) {
  const receiptNumber = genReceiptNumber();
  await addDoc(collection(firestore, "collections"), {
    customerId, collectorId, amount: Number(amount),
    note: note || "", receiptNumber, date: new Date().toISOString().slice(0, 10),
    timestamp: serverTimestamp()
  });
  await updateDoc(doc(firestore, "customers", customerId), {
    balance: increment(Number(amount))
  });
  return receiptNumber;
}

export function listCollectionsForCollector(collectorId, callback) {
  const q = query(collection(firestore, "collections"), where("collectorId", "==", collectorId));
  return onSnapshot(q, snap => {
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    callback(rows);
  });
}

export function listCollectionsForCustomer(customerId, callback) {
  const q = query(collection(firestore, "collections"), where("customerId", "==", customerId));
  return onSnapshot(q, snap => {
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    callback(rows);
  });
}

export function listAllCollections(callback) {
  return onSnapshot(collection(firestore, "collections"), snap => {
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    callback(rows);
  });
}

// ---------------- WITHDRAWALS ----------------

export async function requestWithdrawal(customerId, amount, reason) {
  await addDoc(collection(firestore, "withdrawals"), {
    customerId, amount: Number(amount), reason: reason || "",
    status: "pending", requestedAt: serverTimestamp(), processedAt: null, processedBy: null
  });
}

export function listWithdrawalsForCustomer(customerId, callback) {
  const q = query(collection(firestore, "withdrawals"), where("customerId", "==", customerId));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export function listAllWithdrawals(callback) {
  return onSnapshot(collection(firestore, "withdrawals"), snap => {
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => (b.status === "pending") - (a.status === "pending"));
    callback(rows);
  });
}

export async function processWithdrawal(withdrawalId, customerId, amount, approve, adminUid) {
  await updateDoc(doc(firestore, "withdrawals", withdrawalId), {
    status: approve ? "approved" : "rejected",
    processedAt: serverTimestamp(), processedBy: adminUid
  });
  if (approve) {
    await updateDoc(doc(firestore, "customers", customerId), {
      balance: increment(-Number(amount))
    });
  }
}
