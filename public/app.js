// Guest board. Shows the shared online board (loaded by data.js from Firebase).
// Add ?example to the address to see the built-in example board instead.

const { highlights, periodWinners, PRIORITY } = window.PoolLogic;

// ---------- Example pool (made-up names, clearly labeled as an example) ----------
const EXAMPLE = (() => {
  const people = [
    ["Mike Johnson", "MJ"], ["Lisa Park", "LP"], ["Tony Russo", "TR"], ["Dana Cole", "DC"],
    ["Ray Ortiz", "RO"], ["Kim Nguyen", "KN"], ["Joe Bianchi", "JB"], ["Pat Greene", "PG"],
    ["Sam Levy", "SL"], ["Nina Shah", "NS"], ["Carl Webb", "CW"], ["Rosa Diaz", "RD"],
    ["Ben Hart", "BH"], ["Amy Fox", "AF"], ["Luis Vega", "LV"], ["Jen Moss", "JM"],
    ["Greg Hale", "GH"], ["Tina Lowe", "TL"], ["Vic Sato", "VS"], ["Eddie Kerr", "EK"],
  ];
  // Every person gets 5 squares, spread around the board.
  const order = [...Array(100).keys()];
  let seed = 7;
  for (let k = 99; k > 0; k--) { seed = (seed * 1103515245 + 12345) % 2147483648; const r = seed % (k + 1); [order[k], order[r]] = [order[r], order[k]]; }
  const squares = new Array(100);
  order.forEach((cellIndex, k) => {
    const [name, initials] = people[k % people.length];
    squares[cellIndex] = { name, initials, status: "paid" };
  });
  // A few reserved but not paid yet, and a couple still open.
  [5, 23, 48, 71].forEach((i) => (squares[i].status = "pending"));
  [62, 89].forEach((i) => (squares[i] = null));

  return {
    title: "Super Bowl LXI",
    rowTeam: { name: "Eagles", abbr: "PHI", color: "#004C54", logo: null },
    colTeam: { name: "Chiefs", abbr: "KC", color: "#E31837", logo: null },
    rowNums: [6, 8, 9, 7, 5, 3, 0, 4, 1, 2],
    colNums: [4, 8, 2, 6, 5, 9, 0, 7, 1, 3],
    squares,
    pricePerSquare: 25,
    prizes: [
      { key: "q1", label: "1st Quarter", amount: 250, reverse: 50 },
      { key: "half", label: "Halftime", amount: 500, reverse: 100 },
      { key: "q3", label: "3rd Quarter", amount: 250, reverse: 50 },
      { key: "final", label: "Final", amount: 1000, reverse: 300 },
    ],
    // If the game goes to overtime, the Final prize is split like this.
    overtime: { regulation: { amount: 250, reverse: 50 }, final: { amount: 750, reverse: 250 } },
    // Cumulative score at the end of each finished period.
    finished: { q1: [7, 3], half: [10, 13] },
    game: { rowScore: 17, colScore: 13, period: 3, clock: "8:12", state: "in" },
  };
})();

const $ = (id) => document.getElementById(id);
let pool = EXAMPLE;
let selected = null;     // index of tapped square
let live = false;        // true once the shared board has loaded
let myUid = null;        // this phone's private pass (set after its first reservation)
let reserving = null;    // index of the open square this guest is about to reserve
let busy = false;
const store = {
  get(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};

// Fill in anything the saved board doesn't have yet, so the page never breaks.
function normalize(p) {
  const team = (t, fallback) => ({ name: fallback, abbr: "", color: "#555555", logo: null, ...(t || {}) });
  const squares = Array.from({ length: 100 }, (_, i) => (p.squares && p.squares[i]) || null);
  return {
    title: p.title || "Super Bowl",
    rowTeam: team(p.rowTeam, "Team 1"),
    colTeam: team(p.colTeam, "Team 2"),
    rowNums: Array.isArray(p.rowNums) && p.rowNums.length === 10 ? p.rowNums : null,
    colNums: Array.isArray(p.colNums) && p.colNums.length === 10 ? p.colNums : null,
    squares,
    pricePerSquare: p.pricePerSquare ?? EXAMPLE.pricePerSquare,
    prizes: p.prizes || EXAMPLE.prizes,
    overtime: p.overtime || EXAMPLE.overtime,
    finished: p.finished || {},
    game: { rowScore: 0, colScore: 0, period: 1, clock: "", state: "pre", ...(p.game || {}) },
    centerImage: p.centerImage || null,
    locked: p.locked !== false,
    maxPerGuest: p.maxPerGuest || 10,
    payment: p.payment || {},
    paymentWindowHours: p.paymentWindowHours ?? 48,
    finalCutoff: p.finalCutoff || null,
  };
}

function showNotice(text) {
  const n = $("notice");
  n.hidden = !text;
  n.textContent = text || "";
}

// data.js calls these when the shared board loads or changes.
window.SquaresApp = {
  setPool(p) {
    live = true;
    document.body.classList.remove("waiting");
    pool = normalize(p);
    $("tryPanel").hidden = true;
    $("foot").hidden = true;
    $("liveChip").lastChild.textContent = pool.game.state === "in" ? "Live" : "Pool board";
    $("liveChip").classList.toggle("live", pool.game.state === "in");
    showNotice("");
    render();
  },
  showNotice,
  setMe(uid) { if (uid !== myUid) { myUid = uid; if (live) render(); } },
};

// ---------- helpers ----------
const sq = (i, j) => pool.squares[i * 10 + j];
const who = (s) => (s ? s.name : "Open square");
const money = (n) => "$" + n.toLocaleString("en-US");
const periodName = (p) => ["", "1st Qtr", "2nd Qtr", "3rd Qtr", "4th Qtr"][p] || "OT";
const boardFull = () => pool.squares.every((s) => s);
const numbersShown = () => pool.rowNums && pool.colNums;

function setTeamColors() {
  document.documentElement.style.setProperty("--row", pool.rowTeam.color);
  document.documentElement.style.setProperty("--col", pool.colTeam.color);
  window.PoolLogic.applyNumColors(pool);
}

// Team logo: a real image when one is supplied (ESPN feed or organizer upload),
// otherwise a team-color badge with the team's abbreviation.
function setLogo(el, team) {
  el.innerHTML = "";
  el.classList.toggle("img", !!team.logo);
  if (team.logo) {
    const img = document.createElement("img");
    img.src = team.logo; img.alt = "";
    img.onerror = () => { el.classList.remove("img"); el.textContent = team.abbr || ""; };
    el.appendChild(img);
  } else {
    el.textContent = team.abbr || "";
  }
}

// ---------- render ----------
function renderScoreboard() {
  const g = pool.game;
  $("title").textContent = pool.title;
  $("rowName").textContent = pool.rowTeam.name;
  $("colName").textContent = pool.colTeam.name;
  setLogo($("rowLogo"), pool.rowTeam);
  setLogo($("colLogo"), pool.colTeam);
  $("rowScore").textContent = g.rowScore;
  $("colScore").textContent = g.colScore;
  const ci = $("centerImg");
  if (pool.centerImage) { if (ci.getAttribute("src") !== pool.centerImage) ci.src = pool.centerImage; ci.hidden = false; }
  else { ci.hidden = true; ci.removeAttribute("src"); }
  // Stack the quarter on two lines ("3RD" over "QTR") so the middle box stays narrow.
  const label = g.state === "post" ? "Final" : g.state === "pre" ? "Kickoff" : periodName(g.period);
  const per = $("period");
  per.innerHTML = "";
  label.split(" ").forEach((w) => { const s = document.createElement("span"); s.textContent = w; per.appendChild(s); });
  $("clock").textContent = g.state === "in" ? (g.detail && /half/i.test(g.detail) ? "Halftime" : g.clock) : "";
}

function renderBoard() {
  const board = $("board");
  board.innerHTML = "";
  const add = (el, col, row) => { el.style.gridColumn = col; el.style.gridRow = row; board.appendChild(el); };

  const top = document.createElement("div");
  top.className = "band-top"; top.textContent = pool.colTeam.name;
  board.appendChild(top);
  const left = document.createElement("div");
  left.className = "band-left"; left.textContent = pool.rowTeam.name;
  board.appendChild(left);
  const corner = document.createElement("div"); corner.className = "corner"; board.appendChild(corner);

  const showNums = numbersShown();
  const hl = showNums ? highlights(pool.rowNums, pool.colNums, pool.game.rowScore, pool.game.colScore) : [];
  const winAt = hl.find((h) => h.kind === "win");

  for (let j = 0; j < 10; j++) {
    const n = document.createElement("div");
    n.className = "num c" + (winAt && winAt.j === j ? " hit" : "");
    n.textContent = showNums ? pool.colNums[j] : "?";
    add(n, j + 3, 2);
  }
  for (let i = 0; i < 10; i++) {
    const n = document.createElement("div");
    n.className = "num r" + (winAt && winAt.i === i ? " hit" : "");
    n.textContent = showNums ? pool.rowNums[i] : "?";
    add(n, 2, i + 3);

    for (let j = 0; j < 10; j++) {
      const s = sq(i, j);
      const b = document.createElement("button");
      b.type = "button";
      b.id = "cell-" + i + "-" + j;
      const kinds = hl.filter((h) => h.i === i && h.j === j).map((h) => h.kind);
      kinds.sort((a, b2) => PRIORITY.indexOf(a) - PRIORITY.indexOf(b2));
      const cls = ["cell"];
      if (!s) cls.push("open"); else if (s.status === "pending") cls.push("pending");
      if (kinds[0]) cls.push(kinds[0]);
      if (selected === i * 10 + j) cls.push("selected");
      b.className = cls.join(" ");
      b.textContent = s ? s.initials : "+";
      if (s && s.initials.length >= 3) b.classList.add("long");
      const rowD = showNums ? pool.rowNums[i] : "?", colD = showNums ? pool.colNums[j] : "?";
      b.setAttribute("aria-label", `${pool.rowTeam.name} ${rowD}, ${pool.colTeam.name} ${colD}: ${who(s)}${s && s.status === "pending" ? ", pending payment" : ""}`);
      b.addEventListener("click", () => {
        const k = i * 10 + j;
        if (!s && signupsOpen()) { reserving = reserving === k ? null : k; selected = null; render(); scrollToPanel(); return; }
        reserving = null;
        selected = selected === k ? null : k; render();
      });
      if (reserving === i * 10 + j) b.classList.add("selected");
      add(b, j + 3, i + 3);
    }
  }

  // Detail line for a tapped square
  const d = $("detail");
  if (selected == null) {
    d.innerHTML = "";
    d.hidden = true;
  } else {
    d.hidden = false;
    const i = Math.floor(selected / 10), j = selected % 10, s = pool.squares[selected];
    const rowD = showNums ? pool.rowNums[i] : "?", colD = showNums ? pool.colNums[j] : "?";
    const status = !s ? "Open" : s.status === "pending" ? "Reserved, waiting on payment" : "Paid";
    const R = pool.rowTeam.name, C = pool.colTeam.name;
    const meaning = { win: "Winning now", rev: "Reverse winner", rowFG: `Wins if ${R} kick a field goal`, rowTD: `Wins if ${R} score a touchdown`, colFG: `Wins if ${C} kick a field goal`, colTD: `Wins if ${C} score a touchdown` };
    const here = hl.filter((h) => h.i === i && h.j === j).map((h) => meaning[h.kind]);
    d.innerHTML = "";
    const b = document.createElement("b"); b.textContent = who(s);
    d.append(b, ` · ${R} ${rowD} / ${C} ${colD} · ${status}${here.length ? " · " + here.join(", ") : ""}`);
  }
}

function renderNext() {
  const box = $("nextList");
  box.innerHTML = "";
  if (!numbersShown()) {
    $("now").hidden = true;
    box.innerHTML = "<li><span></span><span class='what'>Numbers are drawn once all 100 squares are filled.</span><span></span></li>";
    return;
  }
  const g = pool.game;
  const hl = highlights(pool.rowNums, pool.colNums, g.rowScore, g.colScore);
  const byKind = Object.fromEntries(hl.map((h) => [h.kind, h]));
  const R = pool.rowTeam.name, C = pool.colTeam.name;

  const w = byKind.win;
  $("now").hidden = false;
  $("nowWho").textContent = w ? who(sq(w.i, w.j)) : "—";
  const rv = byKind.rev;
  $("nowRev").textContent = rv ? who(sq(rv.i, rv.j)) : "Same square";
  $("nowScore").textContent = `${R} ${g.rowScore} – ${C} ${g.colScore}`;

  const rows = [
    ["rowFG", `${R} field goal`, `${R} ${g.rowScore + 3} – ${C} ${g.colScore}`],
    ["rowTD", `${R} touchdown`, `${R} ${g.rowScore + 7} – ${C} ${g.colScore}`],
    ["colFG", `${C} field goal`, `${R} ${g.rowScore} – ${C} ${g.colScore + 3}`],
    ["colTD", `${C} touchdown`, `${R} ${g.rowScore} – ${C} ${g.colScore + 7}`],
  ];
  for (const [kind, label, sub] of rows) {
    const h = byKind[kind];
    if (!h) continue;
    const li = document.createElement("li");
    const swatch = document.createElement("span"); swatch.className = "sw " + kind;
    const what = document.createElement("span"); what.className = "what"; what.textContent = label;
    const small = document.createElement("small"); small.textContent = sub; what.appendChild(small);
    const name = document.createElement("span"); name.className = "who"; name.textContent = who(sq(h.i, h.j));
    li.append(swatch, what, name);
    box.appendChild(li);
  }
}

function renderPrizes() {
  const box = $("prizes");
  box.innerHTML = "";
  const g = pool.game;
  const liveKey = g.state !== "in" ? null : g.period <= 1 ? "q1" : g.period === 2 ? "half" : g.period === 3 ? "q3" : "final";
  const total = pool.prizes.reduce((t, p) => t + p.amount + p.reverse, 0);
  $("pot").textContent = `${money(pool.pricePerSquare)} a square · ${money(total)} total`;

  const cell = (kind, title, amount, holder) => {
    const c = document.createElement("div");
    c.className = "pbox " + kind;
    const t = document.createElement("span"); t.className = "p-kind"; t.textContent = title;
    const amt = document.createElement("span"); amt.className = "p-amt"; amt.textContent = money(amount);
    const w = document.createElement("span"); w.className = "p-who"; w.textContent = holder;
    c.append(t, amt, w);
    return c;
  };

  for (const p of pool.prizes) {
    const done = pool.finished[p.key] || (p.key === "final" && g.state === "post" ? [g.rowScore, g.colScore] : null);
    const row = document.createElement("div");
    row.className = "prize" + (done ? " done" : p.key === liveKey ? " live" : "");
    const head = document.createElement("div"); head.className = "p-label";
    head.textContent = p.label;
    const status = document.createElement("span"); status.className = "p-status";
    let winName = "", revName = "";
    if (done && numbersShown()) {
      const pw = periodWinners(pool.rowNums, pool.colNums, done[0], done[1]);
      winName = pw.win ? who(sq(pw.win.i, pw.win.j)) : "—";
      revName = pw.rev ? who(sq(pw.rev.i, pw.rev.j)) : "Same square as winner";
      status.textContent = `${pool.rowTeam.name} ${done[0]} – ${pool.colTeam.name} ${done[1]}`;
    } else {
      status.textContent = p.key === liveKey ? "In progress" : "Not played yet";
    }
    head.appendChild(status);
    row.append(head, cell("win", "Winner", p.amount, winName || "—"), cell("rev", "Reverse winner", p.reverse, revName || "—"));
    if (p.key === "final" && pool.overtime) {
      const o = pool.overtime;
      const note = document.createElement("p"); note.className = "p-note";
      note.textContent = `If there's overtime: end of regulation pays ${money(o.regulation.amount)} (reverse ${money(o.regulation.reverse)}), final score pays ${money(o.final.amount)} (reverse ${money(o.final.reverse)}).`;
      row.appendChild(note);
    }
    box.appendChild(row);
  }
}

// Color key under the board, with the initials of whoever holds each highlighted square.
function renderKey() {
  const key = $("key");
  key.innerHTML = "";
  const R = pool.rowTeam.name, C = pool.colTeam.name;
  const hl = numbersShown() ? highlights(pool.rowNums, pool.colNums, pool.game.rowScore, pool.game.colScore) : [];
  const at = Object.fromEntries(hl.map((h) => [h.kind, h]));
  const items = [
    ["win", "Winning now"], ["rev", "Reverse"],
    ["rowTD", `${R} TD`], ["rowFG", `${R} FG`], ["colTD", `${C} TD`], ["colFG", `${C} FG`],
  ];
  for (const [kind, label] of items) {
    const span = document.createElement("span");
    const box = document.createElement("i"); box.className = "kbox cell " + kind;
    const h = at[kind];
    const s = h ? sq(h.i, h.j) : null;
    box.textContent = h ? (s ? s.initials : "+") : "";
    if (s && s.initials.length >= 3) box.classList.add("long");
    span.append(box, label);
    key.appendChild(span);
  }
  // Only explain striped / open squares while there are some on the board.
  const extras = [["pend", "Reserved, not paid"], ["open", "Open"]].filter(([cls]) =>
    cls === "pend" ? pool.squares.some((s) => s && s.status === "pending") : pool.squares.some((s) => !s));
  if (extras.length) { const br = document.createElement("span"); br.className = "row-break"; key.appendChild(br); }
  for (const [cls, label] of extras) {
    const span = document.createElement("span");
    const box = document.createElement("i");
    box.className = "kbox cell " + (cls === "pend" ? "pending" : "open");
    box.textContent = cls === "open" ? "+" : "";
    span.append(box, label); key.appendChild(span);
  }
}

// ---------- picking squares ----------
const signupsOpen = () => live && !!window.SquaresData && pool.locked === false && !numbersShown();
const mine = () => (myUid ? pool.squares.map((s, k) => [k, s]).filter(([, s]) => s && s.ownerUid === myUid) : []);
function scrollToPanel() { setTimeout(() => { const el = $("reservePanel"); if (!el.hidden) el.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 30); }
const initialsFrom = (name) => name.trim().split(/\s+/).map((w) => w[0] || "").join("").slice(0, 3).toUpperCase();
const squareLabel = (k) => numbersShown()
  ? `${pool.rowTeam.name} ${pool.rowNums[Math.floor(k / 10)]} / ${pool.colTeam.name} ${pool.colNums[k % 10]}`
  : `Square ${k + 1}`;

function renderOpenBanner() {
  const open = signupsOpen();
  const left = pool.squares.filter((s) => !s).length;
  $("openBanner").hidden = !open;
  if (open) $("openBannerText").textContent = `${left} square${left === 1 ? "" : "s"} still open. Tap any + square on the board to pick it.`;
}

function renderReserve() {
  const panel = $("reservePanel");
  if (reserving == null || !signupsOpen() || pool.squares[reserving]) { reserving = null; panel.hidden = true; panel.innerHTML = ""; return; }
  panel.hidden = false;
  if (panel.dataset.k === String(reserving) && panel.contains(document.activeElement)) return; // don't wipe what they're typing
  panel.dataset.k = String(reserving);
  const count = mine().length, max = pool.maxPerGuest;
  panel.innerHTML = "";
  const h = document.createElement("h2"); h.textContent = "Pick this square"; panel.appendChild(h);
  const p = document.createElement("p"); p.className = "hint"; p.textContent = `${squareLabel(reserving)} · ${money(pool.pricePerSquare)}`; panel.appendChild(p);
  if (count >= max) {
    const m = document.createElement("p"); m.textContent = `You already have ${max} squares, the most allowed per person.`;
    panel.appendChild(m);
    const c = document.createElement("button"); c.type = "button"; c.className = "btn"; c.textContent = "OK";
    c.addEventListener("click", () => { reserving = null; render(); });
    panel.appendChild(c);
    return;
  }
  const form = document.createElement("form"); form.className = "form"; form.noValidate = true;
  form.innerHTML = `
    <div class="row2">
      <label>Your full name <input id="r-name" maxlength="40" autocomplete="name"></label>
      <label>Initials for the square <input id="r-init" maxlength="4" autocomplete="off" style="text-transform:uppercase"></label>
    </div>
    <div class="actions">
      <button type="submit" class="btn primary" id="r-go">Reserve this square</button>
      <button type="button" class="btn" id="r-cancel">Cancel</button>
    </div>
    <p class="hint" id="r-msg"></p>`;
  panel.appendChild(form);
  const nameIn = form.querySelector("#r-name"), initIn = form.querySelector("#r-init");
  nameIn.value = store.get("guestName"); initIn.value = store.get("guestInit");
  let initTouched = !!initIn.value;
  initIn.addEventListener("input", () => (initTouched = true));
  nameIn.addEventListener("input", () => { if (!initTouched) initIn.value = initialsFrom(nameIn.value); });
  form.querySelector("#r-cancel").addEventListener("click", () => { reserving = null; render(); });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    const name = nameIn.value.trim().replace(/\s+/g, " ");
    const initials = (initIn.value.trim() || initialsFrom(name)).toUpperCase().slice(0, 4);
    const msg = form.querySelector("#r-msg");
    if (!name) { msg.textContent = "Type your name first."; nameIn.focus(); return; }
    store.set("guestName", name); store.set("guestInit", initials);
    busy = true; form.querySelector("#r-go").textContent = "Reserving…";
    const k = reserving;
    try {
      await window.SquaresData.reserve(k, name, initials);
      reserving = null;
      showToast(`Square reserved for ${name}. Pay below to lock it in.`);
    } catch (err) {
      console.error(err);
      msg.textContent = pool.squares[k] ? "Someone just took that square. Pick another one." :
        "That didn't go through. The square may have just been taken, or sign-ups may have closed. Refresh and try again.";
    } finally {
      busy = false;
      const go = form.querySelector("#r-go"); if (go) go.textContent = "Reserve this square";
      render();
    }
  });
  setTimeout(() => (nameIn.value ? form.querySelector("#r-go") : nameIn).focus({ preventScroll: true }), 50);
}

function payLinks(amount, note) {
  const pay = pool.payment || {}, links = [];
  const amt = String(amount);
  if (pay.venmo) links.push(["Venmo", `https://venmo.com/${encodeURIComponent(pay.venmo.replace(/^@/, ""))}?txn=pay&amount=${amt}&note=${encodeURIComponent(note)}`]);
  if (pay.cashapp) links.push(["Cash App", `https://cash.app/$${encodeURIComponent(pay.cashapp.replace(/^\$/, ""))}/${amt}`]);
  if (pay.paypal) links.push(["PayPal", `https://paypal.me/${encodeURIComponent(pay.paypal)}/${amt}USD`]);
  return links;
}

function renderMine() {
  const panel = $("myPanel");
  const list = mine();
  if (!list.length) { panel.hidden = true; return; }
  panel.hidden = false;
  const unpaid = list.filter(([, s]) => s.status === "pending");
  const owed = unpaid.length * pool.pricePerSquare;
  $("myCount").textContent = `${list.length} square${list.length === 1 ? "" : "s"} · ${list.length - unpaid.length} paid · ${unpaid.length} waiting on payment`;
  const ul = $("myList"); ul.innerHTML = "";
  list.forEach(([k, s]) => {
    const li = document.createElement("li");
    const b = document.createElement("b"); b.textContent = s.initials;
    li.append(b, ` ${squareLabel(k)} · ${s.status === "paid" ? "Paid" : "Not paid yet"}`);
    ul.appendChild(li);
  });
  const payBox = $("payBox");
  payBox.hidden = owed === 0;
  if (owed > 0) {
    const name = list[0][1].name;
    const note = `Super Bowl Squares - ${name} (${unpaid.length})`;
    $("owed").textContent = `You owe ${money(owed)}`;
    const win = pool.paymentWindowHours;
    $("payHintText").textContent = (win > 0 ? `Please pay within ${win} hours, or your unpaid squares go back on the board. ` : "") +
      "Your squares turn from striped to solid once the organizer marks you paid.";
    const btns = $("payButtons"); btns.innerHTML = "";
    payLinks(owed, note).forEach(([label, url]) => {
      const a = document.createElement("a"); a.className = "btn primary"; a.href = url; a.target = "_blank"; a.rel = "noopener";
      a.textContent = `Pay ${money(owed)} with ${label}`;
      btns.appendChild(a);
    });
    const z = (pool.payment || {}).zelle;
    $("zelleRow").hidden = !z;
    if (z) $("zelleTo").textContent = z;
    $("cashNote").hidden = false;
  }
}

let toastTimer;
function showToast(text) {
  const t = $("toast"); t.textContent = text; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 5000);
}

$("zelleCopy").addEventListener("click", () => {
  const v = $("zelleTo").textContent, btn = $("zelleCopy");
  const done = () => { btn.textContent = "Copied"; setTimeout(() => (btn.textContent = "Copy"), 2000); };
  try { navigator.clipboard.writeText(v).then(done, () => {}); } catch (e) {}
});

function render() {
  setTeamColors();
  renderScoreboard();
  renderBoard();
  renderKey();
  renderNext();
  renderPrizes();
  renderOpenBanner();
  renderReserve();
  renderMine();
}

// ---------- events ----------

// Preview-only: pretend scoring so the highlighting can be seen moving.
document.querySelectorAll("[data-score]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const [team, pts] = btn.dataset.score.split(":");
    if (team === "reset") {
      pool.game.rowScore = 0; pool.game.colScore = 0; pool.game.period = 1; pool.game.clock = "15:00";
      pool.finished = {};
    } else {
      pool.game[team === "r" ? "rowScore" : "colScore"] += Number(pts);
    }
    render();
  });
});

render();

// On the real site, never show the example names: hide the board until the shared board loads.
if (!new URLSearchParams(location.search).has("example")) {
  document.body.classList.add("waiting");
  showNotice("Loading the pool board…");
  setTimeout(() => {
    if (!live && $("notice").textContent.startsWith("Loading")) {
      showNotice("Couldn't load the pool board. Check your internet connection and refresh the page.");
    }
  }, 15000);
}
