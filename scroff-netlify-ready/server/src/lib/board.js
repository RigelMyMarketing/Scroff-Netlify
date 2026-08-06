export const BOARD_SIZE = 50; // 10 x 5 layout

// Sum of physical stock across all prizes — informational only. Stock has
// no bearing on the board itself (see generateBoard below); it only tracks
// physical inventory for the admin's own fulfillment purposes.
export function totalQty(prizeTypes) {
  return prizeTypes.reduce((sum, p) => sum + Number(p.qty || 0), 0);
}

// Raw sum of every prize's weight — shown to the admin as a reference
// point, but generateBoard does NOT require this to equal 100. Whatever it
// adds up to (50, 100, 260, anything) gets proportionally rescaled so the
// board still always ends up fully populated — see generateBoard below.
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
// prize — there's no "no prize" bowl, so a player always wins something.
//
// The admin's `weight` numbers don't need to add up to 100 — they're just
// *relative proportions* to each other. Whatever they sum to, this
// normalizes them against that actual total (not a fixed 100), so e.g.
// weights of 10/20/20 (summing to 50) fill the board exactly the same way
// as 20/40/40 (summing to 100) would — same ratios, same result. Enter
// 40/40/40 (summing to 120) and everything scales back down proportionally
// instead. This is what "the system evaluates itself and rearranges the
// pool" means in practice: the board is always full, always in the same
// relative proportions the admin set, regardless of what they add up to.
//
// `qty` (physical stock) has no effect on any of this — a prize with 0
// units left still appears exactly as often as its weight implies. Stock
// only matters for the admin's own fulfillment bookkeeping (see
// admin.routes.js), completely decoupled from board odds.
//
// Proportions rarely divide 50 evenly, so plain floor()'ing each prize's
// share would leave a handful of cells short. Largest-remainder rounding
// hands those leftover cells to whichever prize(s) were closest to
// rounding up, so the board always comes out to exactly 50 cells with no
// gaps — the standard method for exactly this kind of "shares must land on
// whole discrete units" problem.
export function generateBoard(prizeTypes) {
  const eligible = prizeTypes.filter((pt) => Number(pt.weight) > 0);
  const total = eligible.reduce((sum, pt) => sum + Number(pt.weight), 0);
  if (total <= 0) {
    throw new Error('At least one prize needs odds above 0% before a board can be generated');
  }

  const shares = eligible.map((pt) => {
    const exact = (Number(pt.weight) / total) * BOARD_SIZE;
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
