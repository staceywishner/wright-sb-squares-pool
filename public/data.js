// Loads the shared pool board from Firebase and keeps it updated live.
// Everyone can read the board; only the organizer (and guests reserving their own
// squares) can change it — see firestore.rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, collection, onSnapshot, getDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const params = new URLSearchParams(location.search);

if (!params.has("example")) {
  const app = initializeApp(window.FIREBASE_CONFIG);
  const db = getFirestore(app);
  const ui = window.SquaresApp;

  let poolDoc;                       // undefined = still loading, null = not set up yet
  let squares = new Array(100).fill(null);
  let squaresLoaded = false;

  ui.showNotice("Loading the pool board…");

  // ---------- live score from ESPN's public NFL scoreboard ----------
  const ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
  let espn = null;          // the matching game, or null if not found / not reachable

  const low = (x) => String(x || "").toLowerCase().trim();
  function sameTeam(t, team) {
    const n = low(team && team.name), a = low(team && team.abbr);
    if (!n && !a) return false;
    const names = [t.name, t.shortDisplayName, t.displayName, t.abbreviation, t.nickname, t.location].map(low);
    return names.some((x) => x && (x === n || (a && x === a))) || (n.length > 2 && low(t.displayName).includes(n));
  }
  function findGame(data, pool) {
    for (const ev of (data && data.events) || []) {
      const comp = ev.competitions && ev.competitions[0];
      if (!comp) continue;
      const row = comp.competitors.find((c) => sameTeam(c.team || {}, pool.rowTeam));
      const col = comp.competitors.find((c) => sameTeam(c.team || {}, pool.colTeam));
      if (!row || !col || row === col) continue;
      const st = ev.status || {}, type = st.type || {};
      const lines = (c) => (c.linescores || []).map((l) => Number(l.value) || 0);
      return {
        rowScore: Number(row.score) || 0, colScore: Number(col.score) || 0,
        period: st.period || 1, clock: st.displayClock || "",
        state: type.state || "pre", halftime: type.name === "STATUS_HALFTIME",
        detail: type.shortDetail || "",
        rowLines: lines(row), colLines: lines(col),
        rowLogo: row.team && row.team.logo, colLogo: col.team && col.team.logo,
      };
    }
    return null;
  }
  // Scores at the end of each finished period, from ESPN's quarter-by-quarter numbers.
  function finishedFrom(g) {
    const sum = (arr, n) => arr.slice(0, n).reduce((t, v) => t + v, 0);
    const done = (n) => g.state === "post" || g.period > n || (n === 2 && g.halftime);
    const f = {};
    if (g.rowLines.length >= 1 && done(1)) f.q1 = [sum(g.rowLines, 1), sum(g.colLines, 1)];
    if (g.rowLines.length >= 2 && done(2)) f.half = [sum(g.rowLines, 2), sum(g.colLines, 2)];
    if (g.rowLines.length >= 3 && done(3)) f.q3 = [sum(g.rowLines, 3), sum(g.colLines, 3)];
    if (g.state === "post") f.final = [g.rowScore, g.colScore];
    return f;
  }
  async function pollEspn() {
    if (!poolDoc) return;
    try {
      const res = await fetch(ESPN_URL, { cache: "no-store" });
      espn = findGame(await res.json(), poolDoc);
    } catch (e) {
      espn = null;    // ESPN unreachable: fall back to the organizer's score
    }
    push();
  }
  setInterval(pollEspn, 30000);

  const push = () => {
    if (poolDoc === undefined || !squaresLoaded) return;
    if (poolDoc === null) {
      document.body.classList.add("waiting");   // hide any old board after a full reset
      ui.showNotice("The organizer hasn't set up this year's pool yet. Check back soon.");
      return;
    }
    const view = { ...poolDoc, squares: squares.slice() };
    const manual = poolDoc.game && poolDoc.game.manual;
    if (espn) {
      view.rowTeam = { ...poolDoc.rowTeam, logo: (poolDoc.rowTeam && poolDoc.rowTeam.logo) || espn.rowLogo || null };
      view.colTeam = { ...poolDoc.colTeam, logo: (poolDoc.colTeam && poolDoc.colTeam.logo) || espn.colLogo || null };
      if (!manual) {
        view.game = { rowScore: espn.rowScore, colScore: espn.colScore, period: espn.period, clock: espn.clock, state: espn.state, detail: espn.detail };
        // Quarter results typed in by the organizer always win over ESPN's.
        view.finished = { ...finishedFrom(espn), ...(poolDoc.finished || {}) };
      }
    }
    ui.setPool(view);
  };

  const failed = () =>
    ui.showNotice("Couldn't load the pool board. Check your internet connection and refresh the page.");

  let firstPoll = true;
  onSnapshot(doc(db, "pool", "main"), (snap) => {
    poolDoc = snap.exists() ? snap.data() : null;
    push();
    if (poolDoc && firstPoll) { firstPoll = false; pollEspn(); }
  }, failed);

  // ---------- guests reserving squares ----------
  // Each phone gets a private anonymous pass (no sign-up) the first time it reserves,
  // so the app knows which squares are "yours" and can enforce the per-guest limit.
  const auth = getAuth(app);
  onAuthStateChanged(auth, (u) => ui.setMe(u ? u.uid : null));
  async function ensureSignedIn() {
    if (auth.currentUser) return auth.currentUser;
    const cred = await signInAnonymously(auth);
    return cred.user;
  }
  window.SquaresData = {
    async reserve(k, name, initials) {
      const user = await ensureSignedIn();
      ui.setMe(user.uid);
      const gref = doc(db, "guests", user.uid);
      const g = await getDoc(gref);
      const list = g.exists() ? (g.data().squares || []) : [];
      const b = writeBatch(db);
      b.set(doc(db, "squares", String(k)), { name, initials, status: "pending", ownerUid: user.uid, reservedAt: serverTimestamp() });
      if (g.exists()) b.update(gref, { squares: [...list, String(k)] });
      else b.set(gref, { squares: [String(k)] });
      await b.commit();
    },
  };

  onSnapshot(collection(db, "squares"), (qs) => {
    const next = new Array(100).fill(null);
    qs.forEach((d) => {
      const i = Number(d.id);
      if (Number.isInteger(i) && i >= 0 && i < 100) next[i] = d.data();
    });
    squares = next;
    squaresLoaded = true;
    push();
  }, failed);
}
