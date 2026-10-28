import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, addDoc, updateDoc,
  collection, query, where, orderBy, serverTimestamp, increment, onSnapshot, writeBatch
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestore = getFirestore(app);

// ---------------- AUTH ----------------

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signUp(email, password, name, phone) {
  const cleanEmail = email.trim().toLowerCase();
  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  const uid = cred.user.uid;
  try {
    return await createProfile(uid, cleanEmail, name, phone);
  } catch (err) {
    // Don't leave a login behind that has no profile.
    try { await cred.user.delete(); } catch (_) {}
    throw err;
  }
}

async function createProfile(uid, email, name, phone) {
  const base = { name, phone, email, createdAt: serverTimestamp() };

  // 1. Did the admin invite this email? (invites are keyed by email, so this is a
  //    single document lookup, not a collection query)
  const inviteRef = doc(firestore, "invites", email);
  const invite = await getDoc(inviteRef);
  if (invite.exists()) {
    const { kind, refId } = invite.data();
    const batch = writeBatch(firestore);
    if (kind === "collector") {
      batch.update(doc(firestore, "collectors", refId), { uid });
      batch.set(doc(firestore, "users", uid), { ...base, role: "collector", collectorRef: refId });
    } else {
      batch.update(doc(firestore, "customers", refId), { uid });
      batch.set(doc(firestore, "users", uid), { ...base, role: "customer", customerRef: refId });
    }
    batch.delete(inviteRef);
    await batch.commit();
    return kind;
  }

  // 2. The very first account on the system becomes admin.
  const adminRef = doc(firestore, "config", "admin");
  const adminSnap = await getDoc(adminRef);
  if (!adminSnap.exists()) {
    const batch = writeBatch(firestore);
    batch.set(adminRef, { uid, createdAt: serverTimestamp() });
    batch.set(doc(firestore, "users", uid), { ...base, role: "admin" });
    await batch.commit();
    return "admin";
  }

  // 3. Otherwise: a self-registered customer.
  const batch = writeBatch(firestore);
  batch.set(doc(firestore, "users", uid), { ...base, role: "customer", customerRef: uid });
  batch.set(doc(firestore, "customers", uid), {
    uid, name, phone, email, accountNumber: genAccountNumber(),
    collectorId: null, balance: 0, createdAt: serverTimestamp()
  });
  await batch.commit();
  return "customer";
}

export async function logIn(email, password) {
  await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
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
  const cleanEmail = email.trim().toLowerCase();
  const ref = doc(collection(firestore, "collectors"));
  const batch = writeBatch(firestore);
  batch.set(ref, { name, phone, email: cleanEmail, uid: null, active: true, createdAt: serverTimestamp() });
  batch.set(doc(firestore, "invites", cleanEmail), { kind: "collector", refId: ref.id, createdAt: serverTimestamp() });
  await batch.commit();
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
  const cleanEmail = email ? email.trim().toLowerCase() : null;
  const ref = doc(collection(firestore, "customers"));
  const batch = writeBatch(firestore);
  batch.set(ref, {
    uid: null, name, phone, email: cleanEmail,
    accountNumber: genAccountNumber(), collectorId: collectorId || null,
    balance: 0, createdAt: serverTimestamp()
  });
  if (cleanEmail) {
    batch.set(doc(firestore, "invites", cleanEmail), { kind: "customer", refId: ref.id, createdAt: serverTimestamp() });
  }
  await batch.commit();
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
