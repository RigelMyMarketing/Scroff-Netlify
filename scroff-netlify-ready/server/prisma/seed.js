import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/lib/auth.js';

// Runs on every server start. Safe to call repeatedly — it only creates
// things that don't already exist, so it never overwrites an admin's
// changed password or a prize pool the admin has already configured.
export async function ensureSeedAdmin() {
  const adminCount = await prisma.admin.count();
  if (adminCount === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'change-me-now';
    await prisma.admin.create({
      data: { username, passwordHash: await hashPassword(password) },
    });
    console.log(`Seeded admin account "${username}" — change this password after first login.`);
  }

  const config = await prisma.drawConfig.findUnique({ where: { id: 1 } });
  if (!config) {
    await prisma.drawConfig.create({ data: { id: 1, attemptsPerUser: 3 } });
  }

  const prizeCount = await prisma.prizeType.count();
  if (prizeCount === 0) {
    // weight is set to qty * 2 here purely to preserve the same relative
    // proportions the original 50-slot design implied. These happen to sum
    // to 100, but that's not required — the board proportionally scales
    // whatever weights are set to always fill all 50 cells (see
    // generateBoard in lib/board.js). qty itself is otherwise unrelated to
    // board odds.
    const defaults = [
      { name: 'Grand Prize — New Phone', emoji: '📱', qty: 1, weight: 2 },
      { name: 'Cash RM500', emoji: '💵', qty: 2, weight: 4 },
      { name: 'Cash RM100', emoji: '💰', qty: 5, weight: 10 },
      { name: 'Bluetooth Earbuds', emoji: '🎧', qty: 4, weight: 8 },
      { name: 'Movie Ticket x2', emoji: '🎬', qty: 8, weight: 16 },
      { name: 'Coffee Voucher', emoji: '☕', qty: 9, weight: 18 },
      { name: 'RM10 Shopping Voucher', emoji: '🎫', qty: 15, weight: 30 },
      { name: 'One More Time', emoji: '🔁', qty: 6, weight: 12, isFreeRetry: true },
    ];
    await prisma.prizeType.createMany({
      data: defaults.map((d, i) => ({ ...d, sortOrder: i })),
    });
    console.log('Seeded a default 50-slot prize pool (odds summing to exactly 100%).');
  }
}

// Allows `npm run seed` to be run standalone too.
if (import.meta.url === `file://${process.argv[1]}`) {
  ensureSeedAdmin().then(() => process.exit(0));
}
