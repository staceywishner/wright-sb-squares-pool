// Pure pool math, shared by the guest board and (later) the organizer screen.
// "row team" = team down the left side, "col team" = team across the top.
// rowNums[i] / colNums[j] = the 0–9 digit printed on row i / column j.

(function (root) {
  const digit = (n) => ((n % 10) + 10) % 10;

  // Find the board cell (row index, col index) for a pair of last digits.
  function cellFor(rowNums, colNums, rowDigit, colDigit) {
    const i = rowNums.indexOf(rowDigit);
    const j = colNums.indexOf(colDigit);
    return i < 0 || j < 0 ? null : { i, j };
  }

  // Everything that should light up for the current score, matching the Excel sheet:
  // current winner, reverse winner, and the next field goal (+3) / touchdown (+7) for each team.
  function highlights(rowNums, colNums, rowScore, colScore) {
    const r = digit(rowScore), c = digit(colScore);
    const out = [];
    const add = (kind, rd, cd, newRow, newCol) => {
      const at = cellFor(rowNums, colNums, rd, cd);
      if (at) out.push({ kind, ...at, rowScore: newRow, colScore: newCol });
    };
    add("win", r, c, rowScore, colScore);
    if (r !== c) add("rev", c, r, rowScore, colScore);
    add("rowFG", digit(r + 3), c, rowScore + 3, colScore);
    add("rowTD", digit(r + 7), c, rowScore + 7, colScore);
    add("colFG", r, digit(c + 3), rowScore, colScore + 3);
    add("colTD", r, digit(c + 7), rowScore, colScore + 7);
    return out;
  }

  // Strongest highlight wins when one cell matches several.
  const PRIORITY = ["win", "rev", "rowTD", "colTD", "rowFG", "colFG"];

  // Winner + reverse winner for a finished period, given that period's cumulative score.
  function periodWinners(rowNums, colNums, rowScore, colScore) {
    const r = digit(rowScore), c = digit(colScore);
    return { win: cellFor(rowNums, colNums, r, c), rev: r === c ? null : cellFor(rowNums, colNums, c, r) };
  }

  // Colors for the 0-9 number boxes on each edge (organizer can set background and number color).
  function applyNumColors(pool) {
    if (typeof document === "undefined") return;
    const s = document.documentElement.style;
    s.setProperty("--row-num-bg", (pool.rowTeam && (pool.rowTeam.numBg || pool.rowTeam.color)) || "#555555");
    s.setProperty("--row-num-ink", (pool.rowTeam && pool.rowTeam.numInk) || "#ffffff");
    s.setProperty("--col-num-bg", (pool.colTeam && (pool.colTeam.numBg || pool.colTeam.color)) || "#555555");
    s.setProperty("--col-num-ink", (pool.colTeam && pool.colTeam.numInk) || "#ffffff");
  }

  const api = { digit, cellFor, highlights, periodWinners, PRIORITY, applyNumColors };
  if (typeof module !== "undefined") module.exports = api; else root.PoolLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
