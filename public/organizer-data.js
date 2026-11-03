// Organizer screen: Firebase sign-in and saving. The look and buttons live in organizer-ui.js.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, collection, onSnapshot, setDoc, updateDoc, getDoc, writeBatch,
  serverTimestamp, arrayRemove, getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Must match the organizer email in firestore.rules.
const ORGANIZERS = ["david.wright333@gmail.com", "stacey.wishner@gmail.com"];

const app = initializeApp(window.FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const ui = window.OrgUI;
const poolRef = doc(db, "pool", "main");
const sqRef = (k) => doc(db, "squares", String(k));
const guestRef = (uid) => doc(db, "guests", uid);

const DEFAULT_POOL = () => ({
  title: "Super Bowl LXI",
  rowTeam: { name: "Team 1", abbr: "", color: "#004C54", logo: null },
  colTeam: { name: "Team 2", abbr: "", color: "#E31837", logo: null },
  rowNums: null,
  colNums: null,
  pricePerSquare: 25,
  maxPerGuest: 10,
  prizes: [
    { key: "q1", label: "1st Quarter", amount: 250, reverse: 50 },
    { key: "half", label: "Halftime", amount: 500, reverse: 100 },
    { key: "q3", label: "3rd Quarter", amount: 250, reverse: 50 },
    { key: "final", label: "Final", amount: 1000, reverse: 300 },
  ],
  overtime: { regulation: { amount: 250, reverse: 50 }, final: { amount: 750, reverse: 250 } },
  payment: { venmo: "", cashapp: "", paypal: "", zelle: "" },
  paymentWindowHours: 48,
  finalCutoff: null,
  locked: true,
  finished: {},
  game: { rowScore: 0, colScore: 0, period: 1, clock: "", state: "pre" },
  createdAt: serverTimestamp(),
});

let unsubs = [];
function stopListening() { unsubs.forEach((u) => u()); unsubs = []; }

function listen() {
  stopListening();
  unsubs.push(onSnapshot(poolRef, (snap) => ui.setPool(snap.exists() ? snap.data() : null),
    (e) => ui.notice("Couldn't load the pool (" + e.code + "). Refresh the page to try again.")));
  unsubs.push(onSnapshot(collection(db, "squares"), (qs) => {
    const arr = new Array(100).fill(null);
    qs.forEach((d) => { const i = Number(d.id); if (Number.isInteger(i) && i >= 0 && i < 100) arr[i] = d.data(); });
    ui.setSquares(arr);
  }, (e) => ui.notice("Couldn't load the squares (" + e.code + "). Refresh the page to try again.")));
}

onAuthStateChanged(auth, (user) => {
  const ok = !!user && ORGANIZERS.includes((user.email || "").toLowerCase());
  ui.setUser(user, ok);
  if (ok) listen(); else stopListening();
});

window.OrgAPI = {
  async signIn() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try { await signInWithPopup(auth, provider); }
    catch (e) {
      if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") return signInWithRedirect(auth, provider);
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") return;
      throw e;
    }
  },
  signOut() { return signOut(auth); },
  createPool() { return setDoc(poolRef, DEFAULT_POOL()); },
  // Clear every name, the drawn numbers, the score and quarter results. Settings stay.
  async startOver() {
    const [sq, gs] = await Promise.all([getDocs(collection(db, "squares")), getDocs(collection(db, "guests"))]);
    const refs = [...sq.docs.map((x) => x.ref), ...gs.docs.map((x) => x.ref)];
    for (let i = 0; i < refs.length; i += 400) {
      const b = writeBatch(db);
      refs.slice(i, i + 400).forEach((r) => b.delete(r));
      await b.commit();
    }
    await updateDoc(poolRef, {
      rowNums: null, colNums: null, locked: true, finished: {},
      game: { rowScore: 0, colScore: 0, period: 1, clock: "", state: "pre" },
    });
  },
  savePool(data) { return updateDoc(poolRef, data); },
  useLiveScore() { return updateDoc(poolRef, { "game.manual": false }); },

  markPaid(indices) {
    const b = writeBatch(db);
    indices.forEach((k) => b.update(sqRef(k), { status: "paid" }));
    return b.commit();
  },
  markPending(indices) {
    const b = writeBatch(db);
    indices.forEach((k) => b.update(sqRef(k), { status: "pending", reservedAt: serverTimestamp() }));
    return b.commit();
  },
  setSquare(k, data, existing) {
    if (existing) return updateDoc(sqRef(k), { name: data.name, initials: data.initials, status: data.status });
    return setDoc(sqRef(k), { ...data, ownerUid: "organizer", reservedAt: serverTimestamp() });
  },
  // pairs: [[index, squareData], ...]
  removeSquares(pairs) {
    const b = writeBatch(db);
    const byGuest = new Map();
    pairs.forEach(([k, s]) => {
      b.delete(sqRef(k));
      if (s && s.ownerUid && s.ownerUid !== "organizer") {
        if (!byGuest.has(s.ownerUid)) byGuest.set(s.ownerUid, []);
        byGuest.get(s.ownerUid).push(String(k));
      }
    });
    byGuest.forEach((ids, uid) => b.set(guestRef(uid), { squares: arrayRemove(...ids) }, { merge: true }));
    return b.commit();
  },
  async moveSquare(from, to, s) {
    const b = writeBatch(db);
    b.set(sqRef(to), s);
    b.delete(sqRef(from));
    if (s.ownerUid && s.ownerUid !== "organizer") {
      const g = await getDoc(guestRef(s.ownerUid));
      if (g.exists()) {
        const list = (g.data().squares || []).map((id) => (id === String(from) ? String(to) : id));
        b.update(guestRef(s.ownerUid), { squares: list });
      }
    }
    return b.commit();
  },
};
