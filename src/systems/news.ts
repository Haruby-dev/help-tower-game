import { t, type TextKey } from '../core/i18n';
import type { Tip, TipKind, World } from '../core/state';
import balance from '../data/balance.json';
import dialogueJson from '../data/dialogue.json';
import type { Dialogue } from '../data/schema';
import { eligibleMonsters, isCleared, isTwin, monsterTable, twinA } from './monsters';

/** แต่ละตัวเล่าตามลำดับนี้ เมนูประจำใจท้ายสุด เพราะใช้ตอนความชอบถึง 90% */
const KINDS: TipKind[] = ['favourite', 'drink', 'signature'];
const TWIN_KINDS: TipKind[] = ['favourite', 'drink', 'twin_clue', 'signature'];
const twinNews = (dialogueJson as unknown as Dialogue).twins.gio_news;
const tiers = balance.gioCare.newsByTier;

const known = (world: World, monster: string, kind: TipKind): boolean => world.gio.tips.some((tip) => tip.monster === monster && tip.kind === kind);

/**
 * ข่าวที่จะได้ครั้งต่อไป: เล่าตัวที่เคยมาเยี่ยมก่อน (มีความชอบแล้ว) แล้วตัวอื่นตามลำดับชั้น วนทีละตัว ตัวละ 1 ข้อต่อรอบ
 * เล่าเฉพาะตัวที่มาเยี่ยมได้และยังไม่ครบ 100%
 */
export function nextTips(world: World, count: number): { monster: string; kind: TipKind }[] {
  // พี่แฝดครบแล้ว (หลอดสลับ) ไม่เล่าต่อ ข่าวของน้องแบบปกติเริ่มหลังเฉลย (GDD)
  const monsters = eligibleMonsters(world)
    .filter((id) => !isCleared(world, id))
    .sort((a, b) => Number(world.monsters.affection[b] !== undefined) - Number(world.monsters.affection[a] !== undefined));
  const picked: { monster: string; kind: TipKind }[] = [];
  const has = (monster: string, kind: TipKind): boolean => known(world, monster, kind) || picked.some((tip) => tip.monster === monster && tip.kind === kind);
  // ก่อนเฉลยจีโอมีข่าวแฝดที่เล่าขัดกันเองแบบงง ๆ 1 ข้อเป็นเบาะแส ต่อจากเครื่องดื่มโปรด
  const kindsOf = (monster: string): TipKind[] => (isTwin(monster) && !world.monsters.twins.revealed ? TWIN_KINDS : KINDS);
  while (picked.length < count) {
    let added = false;
    for (const monster of monsters) {
      if (picked.length >= count) break;
      const kind = kindsOf(monster).find((candidate) => !has(monster, candidate));
      if (!kind) continue;
      picked.push({ monster, kind });
      added = true;
    }
    if (!added) break;
  }
  return picked;
}

/** จีโอกลับจากเร่ขายพร้อมข่าว จำนวนตามช่วงความสุขตอนฝาก (2 · 1 · 1 ข้อทุก 2 วัน) · เรียกซ้ำได้ ให้ข่าวครั้งเดียวต่อสรุปยอด */
export function gainTips(world: World): World {
  const report = world.gio.report;
  if (!report || report.day <= world.gio.tipsReportDay) return world;
  const rule = tiers[Math.min(report.tier, tiers.length - 1)]!;
  const due = world.gio.lastTipDay === 0 || report.day - world.gio.lastTipDay >= rule.everyDays;
  const fresh: Tip[] = due ? nextTips(world, rule.count).map((tip) => ({ ...tip, day: report.day, read: false })) : [];
  // วันหลังเฉลยแฝด จีโอมีข่าวด่วน "หางกระดิ่งมีสองตัว!" เพิ่มจากข่าวปกติ
  const twins = world.monsters.twins;
  const reveal: Tip[] =
    twins.revealed && report.day > twins.revealDay && !world.gio.tips.some((tip) => tip.kind === 'twin_reveal')
      ? [{ monster: twinA, kind: 'twin_reveal', day: report.day, read: false }]
      : [];
  return {
    ...world,
    gio: {
      ...world.gio,
      tips: [...world.gio.tips, ...reveal, ...fresh],
      tipsReportDay: report.day,
      lastTipDay: fresh.length > 0 ? report.day : world.gio.lastTipDay,
    },
  };
}

export const unreadTips = (world: World): number => world.gio.tips.filter((tip) => !tip.read).length;

export function readTips(world: World): World {
  if (unreadTips(world) === 0) return world;
  return { ...world, gio: { ...world.gio, tips: world.gio.tips.map((tip) => (tip.read ? tip : { ...tip, read: true })) } };
}

const dishName = (recipe: string): string => t(`dish.${recipe}.name` as TextKey);

/** ประโยคที่จีโอเล่า ประกอบจากชิ้นข้อความใน th.json */
export function tipText(tip: Tip): string {
  const monster = monsterTable[tip.monster];
  const name = t(`monster.${tip.monster}.name` as TextKey);
  if (!monster) return name;
  if (tip.kind === 'twin_clue') return twinNews.pre_reveal_clue;
  if (tip.kind === 'twin_reveal') return `${twinNews.reveal_next_day} ${twinNews.after}`;
  if (tip.kind === 'favourite') return `${t('news.favourite_a')}${name}${t('news.favourite_b')}${dishName(monster.favourite[0]!)}${t('news.favourite_c')}`;
  if (tip.kind === 'drink') {
    return `${name}${t('news.drink_a')}${dishName(monster.favouriteDrink)}${t('news.drink_b')}${dishName(monster.favourite[0]!)}${t('news.drink_c')}`;
  }
  const { recipe, stars } = monster.signature;
  const starText = stars > 1 ? `${t('news.signature_stars_a')}${stars}${t('news.signature_stars_b')}` : '';
  return `${t('news.signature_a')}${name}${t('news.signature_b')}${dishName(recipe)}${starText}${t('news.signature_c')}`;
}
