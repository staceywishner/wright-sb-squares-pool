// Organizer screen (UI only). The data layer (organizer-data.js) talks to Firebase and
// calls OrgUI.setUser / setPool / setSquares; this file calls window.OrgAPI to save changes.

(function () {
  const $ = (id) => document.getElementById(id);
  const money = (n) => "$" + Number(n || 0).toLocaleString("en-US");
  const PRIZE_KEYS = [["q1", "1st Quarter"], ["half", "Halftime"], ["q3", "3rd Quarter"], ["final", "Final"]];

  let pool = null;            // pool/main document
  let squares = new Array(100).fill(null);
  let selected = null;        // square index being edited
  let editorMode = "view";    // view | edit | move
  let confirmAction = null;

  const api = () => window.OrgAPI;

  // ---------- small helpers ----------
  function show(id, on) { $(id).hidden = !on; }
  function notice(text) { const n = $("orgNotice"); n.hidden = !text; n.textContent = text || ""; }
  function flash(id) { const el = $(id); el.hidden = false; clearTimeout(el._t); el._t = setTimeout(() => (el.hidden = true), 2500); }
  async function run(promise, okMsg) {
    try { await promise; if (okMsg) notice(okMsg); return true; }
    catch (e) { console.error(e); notice("That didn't save. Check your internet connection and try again. (" + (e.code || e.message || "error") + ")"); return false; }
  }
  const toDate = (t) => (!t ? null : t.toDate ? t.toDate() : t instanceof Date ? t : new Date(t));
  const fmtTime = (d) => d ? d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  const initialsFrom = (name) => name.trim().split(/\s+/).map((w) => w[0] || "").join("").slice(0, 3).toUpperCase();

  function counts() {
    let paid = 0, pending = 0, open = 0;
    squares.forEach((s) => (!s ? open++ : s.status === "paid" ? paid++ : pending++));
    return { paid, pending, open };
  }
  function stage() {
    if (!pool) return "none";
    if (pool.rowNums && pool.colNums) return "drawn";
    if (pool.locked === false) return "open";
    return counts().open === 0 ? "full" : "closed";
  }

  // Square is past its payment deadline?
  function expiresAt(s) {
    if (!s || s.status !== "pending") return null;
    const times = [];
    const r = toDate(s.reservedAt);
    if (r && pool.paymentWindowHours > 0) times.push(new Date(r.getTime() + pool.paymentWindowHours * 3600e3));
    const c = toDate(pool.finalCutoff);
    if (c) times.push(c);
    return times.length ? new Date(Math.min(...times)) : null;
  }

  // ---------- confirm box (the viewer never shows browser pop-ups) ----------
  function askConfirm(text, action) {
    confirmAction = action;
    $("confirmText").textContent = text;
    show("confirmBox", true);
    $("confirmBox").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  $("confirmYes").addEventListener("click", async () => { show("confirmBox", false); const a = confirmAction; confirmAction = null; if (a) await a(); });
  $("confirmNo").addEventListener("click", () => { show("confirmBox", false); confirmAction = null; });

  // ---------- STATUS ----------
  function renderStatus() {
    const c = counts(), st = stage();
    $("statPaid").textContent = c.paid;
    $("statPending").textContent = c.pending;
    $("statOpen").textContent = c.open;
    $("statMoney").textContent = money(c.paid * (pool.pricePerSquare || 0));
    const pill = $("stagePill");
    const texts = {
      closed: ["Closed", "Guests can see the board but can't pick squares yet."],
      open: ["Open", "Guests can pick squares now. Send them the link below."],
      full: ["Full", "All 100 squares are taken. Lock the board and draw the numbers when everyone has paid."],
      drawn: ["Numbers drawn", "The board is locked and the numbers are set. You're ready for the game."],
    };
    pill.textContent = texts[st][0];
    pill.className = "pill " + st;
    $("stageText").textContent = texts[st][1];

    const box = $("stageActions");
    box.innerHTML = "";
    const btn = (label, cls, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn " + cls; b.textContent = label; b.addEventListener("click", fn); box.appendChild(b); };

    if (st === "closed" || st === "full") {
      btn("Open the board for sign-ups", "primary", () => run(api().savePool({ locked: false }), "The board is open. Guests can pick squares now."));
    }
    if (st === "open") {
      btn("Close sign-ups", "", () => run(api().savePool({ locked: true }), "Sign-ups are closed."));
    }
    const startOver = () => askConfirm("Start over? This erases ALL names on the board, the drawn numbers, the score and the quarter results. Your settings (teams, prices, prizes, payment info) stay. This can't be undone.",
      () => run(api().startOver(), "Cleared. The board is empty and closed. Open it for sign-ups when you're ready."));
    if (st !== "drawn") {
      btn("Lock board & draw numbers", st === "full" || (st === "open" && c.open === 0) ? "primary" : "", () => {
        if (c.open > 0) return askConfirm(`${c.open} square${c.open === 1 ? " is" : "s are"} still open. Draw the numbers anyway? Open squares will stay empty and nobody can pick them after this.`, drawNumbers);
        if (c.pending > 0) return askConfirm(`${c.pending} square${c.pending === 1 ? " hasn't" : "s haven't"} been paid yet. Draw the numbers anyway?`, drawNumbers);
        askConfirm("Lock the board and draw the numbers? Guests won't be able to change squares after this.", drawNumbers);
      });
    } else {
      btn("Clear the numbers", "", () => askConfirm("Clear the drawn numbers? You'd draw them again afterwards. Only do this if something went wrong.", () => run(api().savePool({ rowNums: null, colNums: null }), "Numbers cleared.")));
    }
    btn("Start over (erase all names)", "danger", startOver);
  }

  function shuffled() {
    const a = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const r = new Uint32Array(10); crypto.getRandomValues(r);
    for (let i = 9; i > 0; i--) { const j = r[i] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function drawNumbers() {
    return run(api().savePool({ locked: true, rowNums: shuffled(), colNums: shuffled() }), "Numbers drawn. The board is locked.");
  }

  $("copyLink").addEventListener("click", () => {
    const input = $("guestLink");
    const done = () => { $("copyLink").textContent = "Copied"; setTimeout(() => ($("copyLink").textContent = "Copy"), 2000); };
    try { navigator.clipboard.writeText(input.value).then(done, () => { input.select(); }); } catch (e) { input.select(); }
  });

  // ---------- PAYMENTS ----------
  function renderPayments() {
    const list = $("payList");
    list.innerHTML = "";
    const groups = new Map();
    squares.forEach((s, i) => {
      if (!s || s.status !== "pending") return;
      const key = (s.ownerUid || "") + "|" + s.name;
      if (!groups.has(key)) groups.set(key, { name: s.name, items: [] });
      groups.get(key).items.push(i);
    });
    $("payHint").textContent = groups.size ? "When someone pays, tap Paid. Unpaid squares are released automatically after the deadline." : "Nobody is waiting on payment right now.";
    for (const g of groups.values()) {
      const li = document.createElement("li");
      const first = squares[g.items[0]];
      const exp = expiresAt(first);
      const info = document.createElement("div");
      const b = document.createElement("b"); b.textContent = g.name;
      const small = document.createElement("small");
      small.textContent = `${g.items.length} square${g.items.length === 1 ? "" : "s"} · owes ${money(g.items.length * (pool.pricePerSquare || 0))}` +
        (toDate(first.reservedAt) ? ` · reserved ${fmtTime(toDate(first.reservedAt))}` : "") +
        (exp ? ` · released ${fmtTime(exp)} if unpaid` : "");
      info.append(b, small);
      const acts = document.createElement("div"); acts.className = "acts";
      const paid = document.createElement("button"); paid.type = "button"; paid.className = "btn primary small"; paid.textContent = "Paid";
      paid.addEventListener("click", () => run(api().markPaid(g.items), `${g.name} marked paid.`));
      const rel = document.createElement("button"); rel.type = "button"; rel.className = "btn small"; rel.textContent = "Release";
      rel.addEventListener("click", () => askConfirm(`Release ${g.name}'s ${g.items.length} unpaid square${g.items.length === 1 ? "" : "s"} so others can pick them?`, () => run(api().removeSquares(g.items.map((i) => [i, squares[i]])), "Squares released.")));
      acts.append(paid, rel);
      li.append(info, acts);
      list.appendChild(li);
    }
  }

  // Release reservations past their deadline (runs while this page is open).
  let releasing = false;
  async function releaseExpired() {
    if (!pool || releasing || stage() === "drawn") return;
    const now = Date.now();
    const expired = [];
    squares.forEach((s, i) => { const e = expiresAt(s); if (e && e.getTime() < now) expired.push([i, s]); });
    if (!expired.length) return;
    releasing = true;
    await run(api().removeSquares(expired), `${expired.length} unpaid square${expired.length === 1 ? " was" : "s were"} past the deadline and released.`);
    releasing = false;
  }
  setInterval(releaseExpired, 60e3);

  // ---------- BOARD ----------
  function renderBoard() {
    const board = $("orgBoard");
    board.innerHTML = "";
    const add = (el, col, row) => { el.style.gridColumn = col; el.style.gridRow = row; board.appendChild(el); };
    const top = document.createElement("div"); top.className = "band-top"; top.textContent = pool.colTeam.name; board.appendChild(top);
    const left = document.createElement("div"); left.className = "band-left"; left.textContent = pool.rowTeam.name; board.appendChild(left);
    const drawn = pool.rowNums && pool.colNums;
    for (let j = 0; j < 10; j++) { const n = document.createElement("div"); n.className = "num c"; n.textContent = drawn ? pool.colNums[j] : "?"; add(n, j + 3, 2); }
    for (let i = 0; i < 10; i++) {
      const n = document.createElement("div"); n.className = "num r"; n.textContent = drawn ? pool.rowNums[i] : "?"; add(n, 2, i + 3);
      for (let j = 0; j < 10; j++) {
        const k = i * 10 + j, s = squares[k];
        const b = document.createElement("button");
        b.type = "button";
        b.className = "cell" + (!s ? " open" : s.status === "pending" ? " pending" : "") + (selected === k ? " selected" : "") +
          (editorMode === "move" && !s ? " target" : "");
        b.textContent = s ? s.initials : "+";
        if (s && s.initials.length >= 3) b.classList.add("long");
        b.setAttribute("aria-label", `Square ${k + 1}: ${s ? s.name + (s.status === "pending" ? ", not paid" : ", paid") : "open"}`);
        b.addEventListener("click", () => onCellTap(k));
        add(b, j + 3, i + 3);
      }
    }
    renderEditor();
  }

  function onCellTap(k) {
    if (editorMode === "move" && selected != null) {
      if (squares[k]) { notice("Pick an open square (one with a +) to move to."); return; }
      const from = selected, s = squares[from];
      editorMode = "view"; selected = k;
      run(api().moveSquare(from, k, s), `${s.name} moved.`);
      return;
    }
    editorMode = "view";
    selected = selected === k ? null : k;
    renderBoard();
    if (selected != null) $("editor").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function renderEditor() {
    const ed = $("editor");
    if (selected == null) { ed.hidden = true; ed.innerHTML = ""; return; }
    ed.hidden = false;
    ed.innerHTML = "";
    const k = selected, s = squares[k];
    const title = document.createElement("h3");
    title.textContent = `Square ${k + 1}` + (pool.rowNums && pool.colNums ? ` · ${pool.rowTeam.name} ${pool.rowNums[Math.floor(k / 10)]} / ${pool.colTeam.name} ${pool.colNums[k % 10]}` : "");
    ed.appendChild(title);

    const btn = (label, cls, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn " + cls; b.textContent = label; b.addEventListener("click", fn); return b; };
    const acts = document.createElement("div"); acts.className = "actions";

    if (editorMode === "move") {
      const p = document.createElement("p"); p.textContent = `Now tap an open square (+) to move ${s.name} there.`; ed.appendChild(p);
      acts.append(btn("Cancel move", "", () => { editorMode = "view"; renderBoard(); }));
      ed.appendChild(acts);
      return;
    }

    if (!s || editorMode === "edit") {
      // Add or change a name
      const form = document.createElement("form"); form.className = "form"; form.noValidate = true;
      form.innerHTML = `
        <div class="row2">
          <label>Full name <input id="e-name" maxlength="40" autocomplete="off"></label>
          <label>Initials <input id="e-init" maxlength="4" autocomplete="off"></label>
        </div>
        <label class="check"><input type="checkbox" id="e-paid"> Already paid</label>`;
      ed.appendChild(form);
      const nameIn = form.querySelector("#e-name"), initIn = form.querySelector("#e-init"), paidIn = form.querySelector("#e-paid");
      nameIn.value = s ? s.name : ""; initIn.value = s ? s.initials : ""; paidIn.checked = s ? s.status === "paid" : true;
      let initTouched = !!s;
      initIn.addEventListener("input", () => (initTouched = true));
      nameIn.addEventListener("input", () => { if (!initTouched) initIn.value = initialsFrom(nameIn.value); });
      const save = btn(s ? "Save changes" : "Add to square", "primary", async () => {
        const name = nameIn.value.trim(), initials = (initIn.value.trim() || initialsFrom(name)).toUpperCase();
        if (!name) { nameIn.focus(); notice("Type a name first."); return; }
        const ok = await run(api().setSquare(k, { name, initials, status: paidIn.checked ? "paid" : "pending" }, s), s ? "Saved." : `${name} added.`);
        if (ok) { editorMode = "view"; }
      });
      acts.append(save);
      if (s) acts.append(btn("Cancel", "", () => { editorMode = "view"; renderEditor(); }));
      form.addEventListener("submit", (e) => { e.preventDefault(); save.click(); });
      ed.appendChild(acts);
      setTimeout(() => nameIn.focus(), 50);
      return;
    }

    const who = document.createElement("p");
    const b = document.createElement("b"); b.textContent = s.name;
    const exp = expiresAt(s);
    who.append(b, ` (${s.initials}) · ${s.status === "paid" ? "Paid" : "Not paid yet"}` + (exp ? ` · released ${fmtTime(exp)} if unpaid` : ""));
    ed.appendChild(who);
    if (s.status === "pending") acts.append(btn("Mark paid", "primary", () => run(api().markPaid([k]), `${s.name} marked paid.`)));
    else acts.append(btn("Mark not paid", "", () => run(api().markPending([k]), `${s.name} marked not paid.`)));
    acts.append(btn("Change name", "", () => { editorMode = "edit"; renderEditor(); }));
    if (!(pool.rowNums && pool.colNums)) acts.append(btn("Move", "", () => { editorMode = "move"; renderBoard(); }));
    acts.append(btn("Remove", "danger", () => askConfirm(`Remove ${s.name} from square ${k + 1}?`, async () => { const ok = await run(api().removeSquares([[k, s]]), "Removed."); if (ok) selected = null; })));
    ed.appendChild(acts);
  }

  // ---------- SETTINGS ----------
  const F = (id) => $("f-" + id);
  function fillSettings() {
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest("#settingsForm")) return; // don't overwrite while typing
    F("title").value = pool.title || "";
    F("rowName").value = pool.rowTeam.name; F("rowAbbr").value = pool.rowTeam.abbr || ""; F("rowColor").value = pool.rowTeam.color || "#004c54";
    F("colName").value = pool.colTeam.name; F("colAbbr").value = pool.colTeam.abbr || ""; F("colColor").value = pool.colTeam.color || "#e31837";
    for (const side of ["row", "col"]) {
      const t = pool[side + "Team"];
      F(side + "NumBg").value = t.numBg || t.color || "#555555";
      F(side + "NumInk").value = t.numInk || "#ffffff";
    }
    numPreview();
    $("picPreview").hidden = !pool.centerImage;
    if (pool.centerImage) $("picPreview").src = pool.centerImage;
    $("picRemove").hidden = !pool.centerImage;
    F("price").value = pool.pricePerSquare; F("max").value = pool.maxPerGuest ?? 10;
    const byKey = Object.fromEntries((pool.prizes || []).map((p) => [p.key, p]));
    for (const [k] of PRIZE_KEYS) { F(k + "w").value = byKey[k]?.amount ?? 0; F(k + "r").value = byKey[k]?.reverse ?? 0; }
    const ot = pool.overtime || {};
    F("otRegw").value = ot.regulation?.amount ?? 0; F("otRegr").value = ot.regulation?.reverse ?? 0;
    F("otFinw").value = ot.final?.amount ?? 0; F("otFinr").value = ot.final?.reverse ?? 0;
    const pay = pool.payment || {};
    F("venmo").value = pay.venmo || ""; F("cashapp").value = pay.cashapp || ""; F("paypal").value = pay.paypal || ""; F("zelle").value = pay.zelle || "";
    F("window").value = pool.paymentWindowHours ?? 48;
    const c = toDate(pool.finalCutoff);
    F("cutoff").value = c ? new Date(c.getTime() - c.getTimezoneOffset() * 60e3).toISOString().slice(0, 16) : "";
    potCheck();
  }
  const num = (id) => Math.max(0, Math.round(Number(F(id).value) || 0));
  function potCheck() {
    const prizes = PRIZE_KEYS.reduce((t, [k]) => t + num(k + "w") + num(k + "r"), 0);
    const pot = num("price") * 100;
    $("potCheck").textContent = prizes === pot
      ? `Prizes add up to ${money(prizes)}, which matches 100 squares × ${money(num("price"))}.`
      : `Prizes add up to ${money(prizes)}, but 100 squares × ${money(num("price"))} = ${money(pot)}. Double-check the amounts.`;
    $("potCheck").classList.toggle("warn", prizes !== pot);
  }
  function numPreview() {
    for (const side of ["row", "col"]) for (const id of ["pv-" + side, "pv-" + side + "2"]) {
      $(id).style.background = F(side + "NumBg").value;
      $(id).style.color = F(side + "NumInk").value;
    }
  }
  $("settingsForm").addEventListener("input", () => { potCheck(); numPreview(); });

  // Picture for the middle of the scoreboard: shrunk on this device, then saved with the pool settings.
  function shrinkImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Couldn't read that file."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("That file isn't a picture this browser can open. Try a PNG or JPG."));
        img.onload = () => {
          const max = 320, scale = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          let url = c.toDataURL("image/png");
          if (url.length > 300000) url = c.toDataURL("image/jpeg", 0.85);
          resolve(url);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  $("picFile").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const url = await shrinkImage(file);
      await run(api().savePool({ centerImage: url }), "Picture saved. It now shows in the middle of the scoreboard.");
    } catch (err) { notice(err.message); }
  });
  $("picRemove").addEventListener("click", () => run(api().savePool({ centerImage: null }), "Picture removed."));
  $("settingsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const cutoff = F("cutoff").value ? new Date(F("cutoff").value) : null;
    const data = {
      title: F("title").value.trim() || "Super Bowl",
      rowTeam: { ...pool.rowTeam, name: F("rowName").value.trim() || "Team 1", abbr: F("rowAbbr").value.trim().toUpperCase(), color: F("rowColor").value, numBg: F("rowNumBg").value, numInk: F("rowNumInk").value },
      colTeam: { ...pool.colTeam, name: F("colName").value.trim() || "Team 2", abbr: F("colAbbr").value.trim().toUpperCase(), color: F("colColor").value, numBg: F("colNumBg").value, numInk: F("colNumInk").value },
      pricePerSquare: num("price") || 1,
      maxPerGuest: Math.min(100, num("max") || 10),
      prizes: PRIZE_KEYS.map(([key, label]) => ({ key, label, amount: num(key + "w"), reverse: num(key + "r") })),
      overtime: { regulation: { amount: num("otRegw"), reverse: num("otRegr") }, final: { amount: num("otFinw"), reverse: num("otFinr") } },
      payment: { venmo: F("venmo").value.trim().replace(/^@/, ""), cashapp: F("cashapp").value.trim(), paypal: F("paypal").value.trim(), zelle: F("zelle").value.trim() },
      paymentWindowHours: num("window"),
      finalCutoff: cutoff && !isNaN(cutoff) ? cutoff : null,
    };
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
    if (await run(api().savePool(data))) { notice(""); flash("savedMsg"); }
  });

  // ---------- GAME DAY ----------
  function fillScore() {
    $("lblRowScore").textContent = pool.rowTeam.name;
    $("lblColScore").textContent = pool.colTeam.name;
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest("#scoreForm")) return;
    const g = pool.game || {};
    $("liveBtn").hidden = !g.manual;
    $("scoreMode").textContent = g.manual ? "Using the score you typed in. Guests see this score until you go back to the live ESPN score." : "Using the live ESPN score.";
    $("s-row").value = g.rowScore ?? 0; $("s-col").value = g.colScore ?? 0;
    $("s-period").value = g.state === "post" ? "post" : g.state === "in" ? String(Math.min(g.period || 1, 5)) : "pre";
  }
  $("scoreForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const p = $("s-period").value;
    const game = {
      rowScore: Math.max(0, Number($("s-row").value) || 0),
      colScore: Math.max(0, Number($("s-col").value) || 0),
      state: p === "pre" ? "pre" : p === "post" ? "post" : "in",
      period: p === "pre" ? 1 : p === "post" ? (pool.game?.period || 4) : Number(p),
      clock: "", manual: true,
    };
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
    if (await run(api().savePool({ game }))) { notice(""); flash("scoreSaved"); }
  });

  $("liveBtn").addEventListener("click", () => run(api().useLiveScore(), "Back to the live ESPN score."));

  function renderQuarters() {
    const list = $("qList");
    list.innerHTML = "";
    const g = pool.game || { rowScore: 0, colScore: 0 };
    const fin = pool.finished || {};
    for (const [key, label] of PRIZE_KEYS) {
      const li = document.createElement("li");
      const t = document.createElement("span");
      t.textContent = fin[key] ? `${label}: ${pool.rowTeam.name} ${fin[key][0]} – ${pool.colTeam.name} ${fin[key][1]}` : `${label}: not recorded`;
      const b = document.createElement("button"); b.type = "button"; b.className = "btn small";
      if (fin[key]) {
        b.textContent = "Undo";
        b.addEventListener("click", () => { const f = { ...fin }; delete f[key]; run(api().savePool({ finished: f })); });
      } else {
        b.textContent = `Record ${g.rowScore ?? 0}–${g.colScore ?? 0}`;
        b.addEventListener("click", () => run(api().savePool({ finished: { ...fin, [key]: [g.rowScore ?? 0, g.colScore ?? 0] } }), `${label} recorded.`));
      }
      li.append(t, b);
      list.appendChild(li);
    }
  }

  // ---------- render ----------
  function render() {
    if (!pool) return;
    document.documentElement.style.setProperty("--row", pool.rowTeam.color);
    document.documentElement.style.setProperty("--col", pool.colTeam.color);
    window.PoolLogic.applyNumColors(pool);
    renderStatus();
    renderPayments();
    renderBoard();
    fillSettings();
    fillScore();
    renderQuarters();
    releaseExpired();
  }

  // ---------- called by the data layer ----------
  window.OrgUI = {
    setUser(user, isOrganizer) {
      show("signInPanel", !user);
      show("wrongPanel", !!user && !isOrganizer);
      show("signOutBtn", !!user);
      if (user && !isOrganizer) $("wrongEmail").textContent = user.email || "(no email)";
      if (!user || !isOrganizer) { show("orgMain", false); show("setupPanel", false); }
      notice("");
    },
    setPool(p) {
      if (p === null) { show("setupPanel", true); show("orgMain", false); return; }
      show("setupPanel", false); show("orgMain", true);
      pool = {
        ...p,
        rowTeam: { name: "Team 1", abbr: "", color: "#004c54", ...(p.rowTeam || {}) },
        colTeam: { name: "Team 2", abbr: "", color: "#e31837", ...(p.colTeam || {}) },
      };
      render();
    },
    setSquares(arr) { squares = arr; if (selected != null && editorMode === "edit" && !squares[selected]) editorMode = "view"; render(); },
    notice,
  };

  $("signInBtn").addEventListener("click", () => run(api().signIn()));
  $("signOutBtn").addEventListener("click", () => api().signOut());
  $("wrongSignOut").addEventListener("click", () => api().signOut());
  $("createPoolBtn").addEventListener("click", () => run(api().createPool(), "Pool created. Check the settings below, then open the board."));
})();
