// Guest board. For now it runs on EXAMPLE data so the look can be approved.
// Later steps swap EXAMPLE for the shared online board (Firebase) and the live ESPN score.

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

let pool = EXAMPLE;
let selected = null;     // index of tapped square

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);
const sq = (i, j) => pool.squares[i * 10 + j];
const who = (s) => (s ? s.name : "Open square");
const money = (n) => "$" + n.toLocaleString("en-US");
const periodName = (p) => ["", "1st Qtr", "2nd Qtr", "3rd Qtr", "4th Qtr"][p] || "OT";
const boardFull = () => pool.squares.every((s) => s);
const numbersShown = () => pool.rowNums && pool.colNums;

function setTeamColors() {
  document.documentElement.style.setProperty("--row", pool.rowTeam.color);
  document.documentElement.style.setProperty("--col", pool.colTeam.color);
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
  $("period").textContent = g.state === "post" ? "Final" : g.state === "pre" ? "Kickoff" : periodName(g.period);
  $("clock").textContent = g.state === "in" ? g.clock : "";
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
      const rowD = showNums ? pool.rowNums[i] : "?", colD = showNums ? pool.colNums[j] : "?";
      b.setAttribute("aria-label", `${pool.rowTeam.name} ${rowD}, ${pool.colTeam.name} ${colD}: ${who(s)}${s && s.status === "pending" ? ", pending payment" : ""}`);
      b.addEventListener("click", () => { selected = selected === i * 10 + j ? null : i * 10 + j; render(); });
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
    const status = !s ? "Open — reserving opens in a later step" : s.status === "pending" ? "Reserved, waiting on payment" : "Paid";
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
  $("nowScore").textContent = `${R} ${g.rowScore} – ${C} ${g.colScore}`;

  const rows = [
    ["rev", "Reverse winner", "Same digits, flipped"],
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
    span.append(box, label);
    key.appendChild(span);
  }
  const br = document.createElement("span"); br.className = "row-break"; key.appendChild(br);
  for (const [cls, label] of [["pend", "Reserved, not paid"], ["open", "Open"]]) {
    const span = document.createElement("span");
    const box = document.createElement("i");
    box.className = "kbox cell " + (cls === "pend" ? "pending" : "open");
    box.textContent = cls === "open" ? "+" : "";
    span.append(box, label); key.appendChild(span);
  }
}

function render() {
  setTeamColors();
  renderScoreboard();
  renderBoard();
  renderKey();
  renderNext();
  renderPrizes();
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
