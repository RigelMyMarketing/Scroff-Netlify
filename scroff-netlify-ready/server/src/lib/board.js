export const BOARD_SIZE = 50; // 10 x 5 layout

// Sum of physical stock across all prizes — informational only. Stock no
// longer has any bearing on the board itself (see generateBoard below); it
// only tracks physical inventory for the admin's own fulfillment purposes.
export function totalQty(prizeTypes) {
  return prizeTypes.reduce((sum, p) => sum + Number(p.qty || 0), 0);
}

// Sum of board-odds weight (%) across all prizes — this is what generateBoard
// actually uses, and what publishing validates (must equal exactly 100, since
// every cell now needs a prize behind it — see generateBoard below).
export function totalWeight(prizeTypes) {
  return prizeTypes.reduce((sum, p) => sum + Number(p.weight || 0), 0);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Builds a fresh, shuffled 50-cell board. Every single cell holds a real
// prize — there's no "no prize" bowl anymore, so a player always wins
// something. Each prize's `weight` (a % out of 100) decides how many of the
// 50 bowls it gets; weights must add up to exactly 100% (enforced here and
// on publish) so there's never a gap to fill with nothing.
//
// `qty` (physical stock) has no effect on this at all — a prize with 0 units
// left still appears exactly as often as its weight says. Stock only
// matters for the admin's own fulfillment bookkeeping (see admin.routes.js),
// completely decoupled from board odds.
//
// Percentages rarely divide 50 evenly (e.g. three prizes at 33.33% each), so
// plain floor()'ing each prize's share would leave a handful of cells short.
// Largest-remainder rounding hands those leftover cells to whichever
// prize(s) were closest to rounding up, so the board always comes out to
// exactly 50 cells with no gaps — the standard method for exactly this kind
// of "percentages must land on whole discrete units" problem.
export function generateBoard(prizeTypes) {
  const eligible = prizeTypes.filter((pt) => Number(pt.weight) > 0);
  const total = totalWeight(prizeTypes);
  if (Math.round(total) !== 100) {
    throw new Error(`Prize weights must add up to exactly 100%, got ${total}%`);
  }

  const shares = eligible.map((pt) => {
    const exact = (Number(pt.weight) / 100) * BOARD_SIZE;
    const count = Math.floor(exact);
    return { id: pt.id, count, remainder: exact - count };
  });

  let shortfall = BOARD_SIZE - shares.reduce((sum, s) => sum + s.count, 0);
  shares
    .slice()
    .sort((a, b) => b.remainder - a.remainder)
    .slice(0, shortfall)
    .forEach((s) => {
      shares.find((x) => x.id === s.id).count += 1;
    });

  let ids = [];
  shares.forEach((s) => {
    for (let i = 0; i < s.count; i++) ids.push(s.id);
  });
  ids = shuffle(ids);
  return ids.map((prizeTypeId, cellIndex) => ({
    cellIndex,
    prizeTypeId,
    status: 'available', // 'available' | 'taken'
  }));
}
