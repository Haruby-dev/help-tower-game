import { describe, expect, it } from 'vitest';
import type { GioReport, World } from '../../src/core/state';
import { newWorld } from '../../src/systems/gauges';
import { gainTips, nextTips, readTips, tipText, unreadTips } from '../../src/systems/news';
import { parseSaveFile } from '../../src/systems/save';
import { stepClock } from '../../src/systems/time';

const report = (day: number, tier: number): GioReport => ({ day, sold: [], returned: [], gross: 0, commission: 0, coins: 0, gift: null, tier });
const back = (world: World, day: number, tier: number): World => ({ ...world, day, gio: { ...world.gio, report: report(day, tier) } });

describe('Gio news (GDD: 2 tips · 1 tip · 1 tip every 2 days by happiness)', () => {
  it('gives 2 tips at happiness 70+, 1 at 30–69, once per summary', () => {
    const happy = gainTips(back(newWorld(), 3, 0));
    expect(happy.gio.tips).toHaveLength(2);
    expect(gainTips(happy)).toBe(happy);
    expect(gainTips(back(newWorld(), 3, 1)).gio.tips).toHaveLength(1);
  });

  it('gives a tip only every 2 days at low happiness', () => {
    const first = gainTips(back(newWorld(), 3, 2));
    expect(first.gio.tips).toHaveLength(1);
    const nextDay = gainTips(back(first, 4, 2));
    expect(nextDay.gio.tips).toHaveLength(1);
    expect(gainTips(back(nextDay, 5, 2)).gio.tips).toHaveLength(2);
  });

  it('tells monsters that already visited first, one fact per monster per round, favourite → drink → signature', () => {
    const met: World = { ...newWorld(), monsters: { ...newWorld().monsters, affection: { mookmik: { points: 3, signature: false } } } };
    expect(nextTips(met, 4)).toEqual([
      { monster: 'mookmik', kind: 'favourite' },
      { monster: 'puinun', kind: 'favourite' },
      { monster: 'popcorn', kind: 'favourite' },
      { monster: 'toomtia', kind: 'favourite' },
    ]);
    const all = nextTips(newWorld(), 99);
    // 9 ตัว ตัวละ 3 ข้อ และแฝดชั้น 5 มีข่าวเบาะแสเพิ่ม 1 ข้อ
    expect(all).toHaveLength(31);
    expect(all.filter((tip) => tip.monster === 'puinun').map((tip) => tip.kind)).toEqual(['favourite', 'drink', 'signature']);
  });

  it('marks tips read and writes them as Gio lines', () => {
    const world = gainTips(back(newWorld(), 2, 0));
    expect(unreadTips(world)).toBe(2);
    expect(unreadTips(readTips(world))).toBe(0);
    expect(tipText({ monster: 'puinun', kind: 'favourite', day: 2, read: false })).toContain('ถังหูลู่สตรอว์เบอร์รี');
    expect(tipText({ monster: 'puinun', kind: 'drink', day: 2, read: false })).toContain('น้ำสตรอว์เบอร์รี');
    expect(tipText({ monster: 'puinun', kind: 'signature', day: 2, read: false })).toContain('มันฝรั่งเผา');
    expect(tipText({ monster: 'puefaotung', kind: 'signature', day: 2, read: false })).toContain('3 ดาว');
  });

  it('comes with the summary when Gio returns on the clock', () => {
    const world = back(newWorld(), 2, 0);
    expect(stepClock(world, 1).world.gio.tips).toHaveLength(2);
  });

  it('turns a version 12 save into version 13 with no tips, and an open summary gives no news afterwards', () => {
    const world = newWorld();
    const { tips: _tips, tipsReportDay: _day, lastTipDay: _last, ...oldGio } = world.gio;
    const parsed = parseSaveFile({ version: 12, savedAt: 'x', world: { ...world, gio: { ...oldGio, report: report(4, 0) } } })!;
    expect(parsed.version).toBe(17);
    expect(parsed.world.gio.tips).toEqual([]);
    expect(parsed.world.gio.tipsReportDay).toBe(4);
    expect(gainTips(parsed.world).gio.tips).toEqual([]);
  });
});
