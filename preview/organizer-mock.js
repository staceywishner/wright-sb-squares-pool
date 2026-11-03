// PREVIEW ONLY (not published to the live site): fake organizer data so the screen can be reviewed.
(function () {
  const now = Date.now();
  const people = ["Mike Johnson", "Lisa Park", "Tony Russo", "Dana Cole", "Ray Ortiz", "Kim Nguyen", "Joe Bianchi", "Pat Greene", "Sam Levy", "Nina Shah", "Carl Webb", "Rosa Diaz", "Ben Hart", "Amy Fox", "Luis Vega", "Jen Moss"];
  const ini = (n) => n.split(" ").map((w) => w[0]).join("");
  let squares = new Array(100).fill(null);
  for (let k = 0; k < 82; k++) { const n = people[(k * 7) % people.length]; squares[(k * 37) % 100] = { name: n, initials: ini(n), status: "paid", ownerUid: "g" + n }; }
  [["Greg Hale", 3, 5], ["Tina Lowe", 2, 30]].forEach(([n, count, hoursAgo]) => {
    let placed = 0;
    for (let k = 0; k < 100 && placed < count; k++) if (!squares[k]) { squares[k] = { name: n, initials: ini(n), status: "pending", ownerUid: "g" + n, reservedAt: new Date(now - hoursAgo * 3600e3) }; placed++; }
  });
  let pool = {
    title: "Super Bowl LXI",
    rowTeam: { name: "Eagles", abbr: "PHI", color: "#004C54" }, colTeam: { name: "Chiefs", abbr: "KC", color: "#E31837" },
    rowNums: null, colNums: null, pricePerSquare: 25, maxPerGuest: 10,
    prizes: [{ key: "q1", label: "1st Quarter", amount: 250, reverse: 50 }, { key: "half", label: "Halftime", amount: 500, reverse: 100 }, { key: "q3", label: "3rd Quarter", amount: 250, reverse: 50 }, { key: "final", label: "Final", amount: 1000, reverse: 300 }],
    overtime: { regulation: { amount: 250, reverse: 50 }, final: { amount: 750, reverse: 250 } },
    payment: { venmo: "", cashapp: "", paypal: "", zelle: "" }, paymentWindowHours: 48, finalCutoff: null,
    locked: false, finished: {}, game: { rowScore: 0, colScore: 0, period: 1, clock: "", state: "pre" },
  };
  const push = () => { window.OrgUI.setPool(JSON.parse(JSON.stringify(pool), (k, v) => (k === "finalCutoff" && v ? new Date(v) : v))); window.OrgUI.setSquares(squares.map((s) => s && { ...s })); };
  const ok = () => Promise.resolve();
  window.OrgAPI = {
    signIn: ok, signOut: ok, createPool: ok,
    savePool(d) { pool = { ...pool, ...d }; push(); return ok(); },
    markPaid(ix) { ix.forEach((k) => (squares[k].status = "paid")); push(); return ok(); },
    markPending(ix) { ix.forEach((k) => { squares[k].status = "pending"; squares[k].reservedAt = new Date(); }); push(); return ok(); },
    setSquare(k, d, ex) { squares[k] = ex ? { ...ex, ...d } : { ...d, ownerUid: "organizer", reservedAt: new Date() }; push(); return ok(); },
    removeSquares(pairs) { pairs.forEach(([k]) => (squares[k] = null)); push(); return ok(); },
    moveSquare(a, b, s) { squares[b] = s; squares[a] = null; push(); return ok(); },
  };
  window.OrgUI.setUser({ email: "david.wright333@gmail.com" }, true);
  push();
})();
