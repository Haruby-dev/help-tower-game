import type { BagStack, GioCare, GioReport, World } from '../core/state';
import balance from '../data/balance.json';
import shopJson from '../data/shop.json';
import type { ShopData } from '../data/schema';
import { MYSTERY, isDish, isRawProduce, parseDish, recipes } from './cooking';
import { createRng } from '../core/rng';
import { applyTransaction } from './economy';
import { addToBag, countOf, cropOfItem, crops, takeFromBag } from './farm';
import { fishOfItem, fishTable, isFish } from './fishing';
import { starsOf } from './stars';

const care = balance.gioCare;
const shop = shopJson as ShopData;
const DAYS_PER_WEEK = 7;
const HAPPINESS_MAX = 100;
const HAPPINESS_MIN = 0;
const GIFT_SEED_STEP = 4091;

export type TreatTaste = ShopData['treats'][number]['taste'];

export const newGioCare = (): GioCare => ({
  happiness: care.startHappiness,
  treatDay: 0,
  treatsToday: 0,
  pettedDay: 0,
  specialWeek: -1,
  newsDay: 0,
  album: [],
  consignment: null,
  report: null,
});

const clampHappiness = (value: number): number => Math.min(HAPPINESS_MAX, Math.max(HAPPINESS_MIN, value));

/** ช่วงความสุขเรียงจากสูงไปต่ำ ตอบตำแหน่งในตาราง เพื่อเก็บไว้กับของที่ฝาก */
export function tierIndex(happiness: number): number {
  const index = care.tiers.findIndex((tier) => happiness >= tier.from);
  return index === -1 ? care.tiers.length - 1 : index;
}

export const tierFor = (happiness: number) => care.tiers[tierIndex(happiness)]!;

/** จีโอออกไปเร่ขายเฉพาะวันที่มีของฝาก ตั้งแต่เที่ยงถึงหกโมงเย็นของวันที่จะกลับ วันอื่นอยู่บ้านทั้งวัน */
export function isGioAway(world: World): boolean {
  const deal = world.gio.consignment;
  return deal !== null && world.day === deal.returnDay && world.hour >= care.leaveHour && world.hour < care.returnHour;
}

/** เพิ่งถึงเวลาออกหรือกลับไม่เกิน tripWindowHours จีโอจึงเดินเข้าหรือออกจากโพรงให้เห็น ถ้านานกว่านั้น (เช่นเพิ่งโหลดเซฟ) วางที่ปลายทางเลย */
export const isTripLive = (world: World, away: boolean): boolean => {
  const since = world.hour - (away ? care.leaveHour : care.returnHour);
  return since >= 0 && since < care.tripWindowHours;
};

export const isTreat = (item: string): boolean => shop.treats.some((treat) => treat.item === item);
export const tasteOf = (item: string): TreatTaste | null => shop.treats.find((treat) => treat.item === item)?.taste ?? null;

/** ราคาที่จีโอขายได้ต่อชิ้นก่อนหักค่าคอม ของที่ขายไม่ได้ตอบ null · อาหาร 2 ดาว ×1.2 · 3 ดาว ×1.5 */
export function saleValue(item: string): number | null {
  if (isRawProduce(item)) {
    const price = crops[cropOfItem(item)]?.sellPrice;
    // ผักดาวสูงขายแพงขึ้นเหมือนอาหาร (ค่าที่ฝั่งโค้ดเติม GDD ไม่ระบุ)
    const multiplier = balance.stars.priceMultiplier[Math.min(Math.max(starsOf(item) ?? 1, 1), 3) - 1]!;
    return price === undefined ? null : Math.round(price * multiplier);
  }
  if (isFish(item)) return fishTable[fishOfItem(item)]?.price ?? null;
  if (isDish(item)) {
    const { recipe, stars } = parseDish(item);
    if (recipe === MYSTERY) return null;
    const price = recipes[recipe]?.price;
    const multiplier = care.dishStarPrice[Math.min(Math.max(stars, 1), care.dishStarPrice.length) - 1]!;
    return price === undefined ? null : Math.round(price * multiplier);
  }
  return null;
}

export const canConsign = (item: string): boolean => saleValue(item) !== null;

/** ราคาต่อชิ้นหลังโบนัสความสุข */
const pricedAt = (item: string, priceBonus: number): number => Math.round((saleValue(item) ?? 0) * (1 + priceBonus));

/** ยอดประมาณก่อนฝาก คิดจากความสุขตอนนี้ */
export function estimate(items: BagStack[], happiness: number): { gross: number; commission: number; coins: number } {
  const tier = tierFor(happiness);
  const sellable = sellPortion(items, tier.sellShare).sold;
  const gross = sellable.reduce((sum, stack) => sum + pricedAt(stack.item, tier.priceBonus) * stack.count, 0);
  const commission = Math.round(gross * tier.commission);
  return { gross, commission, coins: gross - commission };
}

/** ความสุขต่ำขายได้แค่ส่วนหนึ่ง ขายของแพงก่อน ที่เหลือคืน */
function sellPortion(items: BagStack[], share: number): { sold: BagStack[]; returned: BagStack[] } {
  const total = items.reduce((sum, stack) => sum + stack.count, 0);
  let left = share >= 1 ? total : Math.floor(total * share);
  const sold: BagStack[] = [];
  const returned: BagStack[] = [];
  const byValue = [...items].sort((a, b) => (saleValue(b.item) ?? 0) - (saleValue(a.item) ?? 0));
  for (const stack of byValue) {
    const take = Math.min(stack.count, left);
    left -= take;
    if (take > 0) sold.push({ item: stack.item, count: take });
    if (stack.count > take) returned.push({ item: stack.item, count: stack.count - take });
  }
  return { sold, returned };
}

const merge = (stacks: BagStack[], item: string, count: number): BagStack[] => {
  const found = stacks.find((stack) => stack.item === item);
  return found ? stacks.map((stack) => (stack === found ? { ...stack, count: stack.count + count } : stack)) : [...stacks, { item, count }];
};

/** ใส่ของ 1 ชิ้นหรือทั้งกองลงกระเป๋าจีโอ ช่องละชนิด ไม่เกินจำนวนช่อง และไม่เกินที่มีในกระเป๋าเรา */
export function addToGioBag(picked: BagStack[], bag: BagStack[], item: string, count: number): BagStack[] {
  if (!canConsign(item)) return picked;
  const already = picked.find((stack) => stack.item === item)?.count ?? 0;
  const room = countOf(bag, item) - already;
  if (room <= 0) return picked;
  if (already === 0 && picked.length >= care.bagSlots) return picked;
  return merge(picked, item, Math.min(count, room));
}

export function removeFromGioBag(picked: BagStack[], item: string, count: number): BagStack[] {
  return picked.flatMap((stack) => (stack.item !== item ? [stack] : stack.count > count ? [{ ...stack, count: stack.count - count }] : []));
}

/** ฝากแล้วของออกจากกระเป๋าเรา ฝากก่อนเที่ยงจีโอออกเที่ยงนี้และกลับเย็นนี้ หลังจากนั้นออกเที่ยงพรุ่งนี้ ฝากได้ครั้งละชุด */
export function consign(world: World, items: BagStack[]): World | null {
  if (world.gio.consignment || items.length === 0 || items.length > care.bagSlots) return null;
  let bag: BagStack[] | null = world.bag;
  for (const stack of items) {
    if (!canConsign(stack.item) || stack.count <= 0) return null;
    bag = bag && takeFromBag(bag, stack.item, stack.count);
  }
  if (!bag) return null;
  const returnDay = world.hour >= care.leaveHour ? world.day + 1 : world.day;
  return { ...world, bag, gio: { ...world.gio, consignment: { items, returnDay, tier: tierIndex(world.gio.happiness) } } };
}

export const returnsToday = (world: World): boolean => world.hour < care.leaveHour;

/** ถึงเวลากลับ จีโอเอาเงินเข้ากระเป๋าเงินทันที สรุปยอดรอให้ผู้เล่นมาคุย ใช้ค่าคอมตามความสุขตอนฝาก */
export function settleGio(world: World): World {
  const deal = world.gio.consignment;
  if (!deal) return world;
  const due = world.day > deal.returnDay || (world.day === deal.returnDay && world.hour >= care.returnHour);
  if (!due) return world;
  const tier = care.tiers[deal.tier] ?? tierFor(world.gio.happiness);
  const { sold, returned } = sellPortion(deal.items, tier.sellShare);
  const gross = sold.reduce((sum, stack) => sum + pricedAt(stack.item, tier.priceBonus) * stack.count, 0);
  const commission = Math.round(gross * tier.commission);
  const coins = gross - commission;
  const report: GioReport = { day: world.day, sold, returned, gross, commission, coins, gift: rollGift(world, deal.tier), tier: deal.tier };
  const next: World = { ...world, gio: { ...world.gio, consignment: null, report } };
  return coins > 0 ? applyTransaction(next, 'coins', coins, 'wallet.gio_sale', 'wallet.category_sale') : next;
}

/** ความสุขช่วงบนสุดมีโอกาสได้ของมาฝาก สุ่มจาก seed ของเซฟกับวันที่ จึงได้ผลเดิมทุกครั้ง */
function rollGift(world: World, tier: number): BagStack | null {
  if (tier !== 0) return null;
  const rng = createRng(world.seed + world.day * GIFT_SEED_STEP);
  if (rng.next() >= care.giftChance) return null;
  const pick = care.giftPool[Math.floor(rng.next() * care.giftPool.length)]!;
  return { item: pick.item, count: pick.count };
}

/** ปิดสรุปยอดแล้วรับของที่ขายไม่หมดและของฝากเข้ากระเป๋า กระเป๋าไม่พอตอบ null ของจึงไม่หาย */
export function collectReport(world: World): World | null {
  const { report } = world.gio;
  if (!report) return world;
  let bag: BagStack[] | null = world.bag;
  for (const stack of [...report.returned, ...(report.gift ? [report.gift] : [])]) bag = bag && addToBag(bag, stack.item, stack.count);
  if (!bag) return null;
  return { ...world, bag, gio: { ...world.gio, report: null } };
}

export type TreatResult = { world: World; gain: number; taste: TreatTaste } | { world: null; reason: 'none' | 'full' };

/** แมวเลียวันละ 3 ซอง ซองแรกได้ผลเต็ม ซองต่อไปน้อยลง · รสพิเศษซองแรกของสัปดาห์ได้มากกว่า */
export function giveTreat(world: World, item: string): TreatResult {
  const taste = tasteOf(item);
  const bag = taste ? takeFromBag(world.bag, item, 1) : null;
  if (!taste || !bag) return { world: null, reason: 'none' };
  const given = world.gio.treatDay === world.day ? world.gio.treatsToday : 0;
  if (given >= care.treatsPerDay) return { world: null, reason: 'full' };
  const week = Math.floor((world.day - 1) / DAYS_PER_WEEK);
  const special = taste === 'special' && world.gio.specialWeek !== week;
  const gain = special ? care.specialWeeklyGain : (care.treatGains[given] ?? care.treatGains[care.treatGains.length - 1]!);
  return {
    world: {
      ...world,
      bag,
      gio: {
        ...world.gio,
        happiness: clampHappiness(world.gio.happiness + gain),
        treatDay: world.day,
        treatsToday: given + 1,
        specialWeek: special ? week : world.gio.specialWeek,
        album: world.gio.album.includes(item) ? world.gio.album : [...world.gio.album, item],
      },
    },
    gain,
    taste,
  };
}

export const treatsLeftToday = (world: World): number =>
  care.treatsPerDay - (world.gio.treatDay === world.day ? world.gio.treatsToday : 0);

/** ลูบหัววันละครั้ง */
export function petGio(world: World): World | null {
  if (world.gio.pettedDay === world.day) return null;
  return { ...world, gio: { ...world.gio, happiness: clampHappiness(world.gio.happiness + care.petGain), pettedDay: world.day } };
}

/** เกมใหม่ได้เงินก้อนแรกจากจีโอ ไว้ซื้อเมล็ดวันแรก จนกว่าเควสแรกของจีโอจะมาใน M9 */
export const withFirstGift = (world: World): World =>
  care.firstGiftCoins > 0 ? applyTransaction(world, 'coins', care.firstGiftCoins, 'wallet.gio_gift', 'wallet.category_gift') : world;

/** ผ่านไป 1 วันความสุขลดลง */
export const gioMorning = (gio: GioCare): GioCare => ({ ...gio, happiness: clampHappiness(gio.happiness - care.dailyDecay) });

/** อ่านข่าววันนี้แล้ว จุดชมพูบนปุ่มข่าวหายไปจนถึงพรุ่งนี้ */
export const readNews = (world: World): World => (world.gio.newsDay === world.day ? world : { ...world, gio: { ...world.gio, newsDay: world.day } });

export const hasUnreadNews = (world: World): boolean => world.gio.newsDay !== world.day;

export const pettedToday = (world: World): boolean => world.gio.pettedDay === world.day;

/** จำนวนแมวเลียทุกรสในกระเป๋า */
export const treatsInBag = (world: World): number =>
  world.bag.filter((stack) => isTreat(stack.item)).reduce((sum, stack) => sum + stack.count, 0);

/** ยอดขายของหนึ่งชนิดในใบสรุปยอด ราคาตามช่วงความสุขตอนฝาก รวมทุกแถวได้เท่ายอดขาย */
export const soldTotal = (report: GioReport, stack: BagStack): number =>
  pricedAt(stack.item, (care.tiers[report.tier] ?? care.tiers[care.tiers.length - 1]!).priceBonus) * stack.count;
