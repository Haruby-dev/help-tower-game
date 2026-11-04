import type { TextKey } from '../core/i18n';
import { gameState, type Currency, type Wallet, type WalletEntry, type World } from '../core/state';
import balance from '../data/balance.json';

export type WalletRange = 'today' | 'week' | 'all';

const DAYS_PER_WEEK = 7;

/** ตัวเลขเงินทุกจุดในเกมใช้รูปแบบเดียวกัน มีจุลภาคคั่นหลักพัน เช่น 40,000 */
export const formatMoney = (amount: number): string => amount.toLocaleString('en-US');

/** ทางเดียวที่เงินเปลี่ยนได้ ทุกครั้งจึงมีรายการเสมอ คำนวณอย่างเดียวเพื่อทดสอบแยกได้ */
export function applyTransaction(
  world: World,
  currency: Currency,
  amount: number,
  label: TextKey,
  category: TextKey,
): World {
  const { wallet, day, hour } = world;
  const entry: WalletEntry = { day, hour, currency, amount, label, category };
  const log = [entry, ...wallet.log].slice(0, balance.wallet.logLimit);
  const today = wallet.daily.find((total) => total.day === day) ?? { day, coins: 0, stars: 0 };
  const daily = [
    { ...today, [currency]: today[currency] + amount },
    ...wallet.daily.filter((total) => total.day !== day),
  ];
  return { ...world, wallet: { ...wallet, [currency]: wallet[currency] + amount, log, daily } };
}

export function changeMoney(currency: Currency, amount: number, label: TextKey, category: TextKey): void {
  gameState.setWorld(applyTransaction(gameState.world, currency, amount, label, category));
}

const inRange = (entryDay: number, today: number, range: WalletRange): boolean => {
  if (range === 'today') return entryDay === today;
  if (range === 'week') return entryDay > today - DAYS_PER_WEEK;
  return true;
};

export function entriesFor(wallet: Wallet, today: number, range: WalletRange): WalletEntry[] {
  return wallet.log.filter((entry) => inRange(entry.day, today, range));
}

/** ยอดสุทธิคิดจากยอดรวมรายวัน จึงยังถูกแม้รายการเก่าถูกตัดออกจากบันทึกแล้ว */
export function netFor(wallet: Wallet, today: number, range: WalletRange, currency: Currency): number {
  return wallet.daily
    .filter((total) => inRange(total.day, today, range))
    .reduce((sum, total) => sum + total[currency], 0);
}
