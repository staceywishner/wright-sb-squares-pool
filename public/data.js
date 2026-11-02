// Loads the shared pool board from Firebase and keeps it updated live.
// Everyone can read the board; only the organizer (and guests reserving their own
// squares) can change it — see firestore.rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const params = new URLSearchParams(location.search);

if (!params.has("example")) {
  const app = initializeApp(window.FIREBASE_CONFIG);
  const db = getFirestore(app);
  const ui = window.SquaresApp;

  let poolDoc;                       // undefined = still loading, null = not set up yet
  let squares = new Array(100).fill(null);
  let squaresLoaded = false;

  ui.showNotice("Loading the pool board…");

  const push = () => {
    if (poolDoc === undefined || !squaresLoaded) return;
    if (poolDoc === null) {
      ui.showNotice("The organizer hasn't set up this year's pool yet. Check back soon.");
      return;
    }
    ui.setPool({ ...poolDoc, squares: squares.slice() });
  };

  const failed = () =>
    ui.showNotice("Couldn't load the pool board. Check your internet connection and refresh the page.");

  onSnapshot(doc(db, "pool", "main"), (snap) => {
    poolDoc = snap.exists() ? snap.data() : null;
    push();
  }, failed);

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
