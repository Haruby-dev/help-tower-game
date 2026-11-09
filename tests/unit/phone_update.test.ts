import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import { defaultCosmetics } from '../../src/core/state';
import { chestData, cosmeticTable, openChest } from '../../src/systems/chests';
import { newWorld } from '../../src/systems/gauges';
import { SAVE_VERSION, parseSaveFile, toSaveFile } from '../../src/systems/save';

// phone update 2026-11-07c: เคสโทรศัพท์ไม่เป็นของแล้ว ของแต่งในหีบเหลือแค่สีบัวรดน้ำ โอกาสของแต่งลดครึ่ง

describe('phone cases are gone', () => {
  it('turns a version 15 save that still has a case into version 16 without the case fields', () => {
    const file = toSaveFile(newWorld());
    const cosmetics = {
      equipped: { ...file.world.cosmetics.equipped, case: 'case_mint' },
      owned: { ...file.world.cosmetics.owned, cases: ['case_pink_cat', 'case_mint'], canSkins: ['can_blue', 'can_mint'] },
    };
    const parsed = parseSaveFile({ ...file, version: 15, world: { ...file.world, cosmetics } })!;
    expect(SAVE_VERSION).toBe(22);
    expect(parsed.version).toBe(22);
    expect(parsed.world.cosmetics.equipped).not.toHaveProperty('case');
    expect(parsed.world.cosmetics.owned).not.toHaveProperty('cases');
    expect(parsed.world.cosmetics.owned.canSkins).toEqual(['can_blue', 'can_mint']);
  });

  it('has no case cosmetics and a new game has no case slot', () => {
    expect(Object.keys(cosmeticTable).filter((id) => id.startsWith('case_'))).toEqual([]);
    expect(defaultCosmetics().equipped).not.toHaveProperty('case');
    // ของแต่งโทรศัพท์อื่นยังอยู่ในตาราง (พักไว้ ไม่ได้ลบ)
    expect(cosmeticTable.charm_pink_bow).toBeDefined();
    expect(cosmeticTable.clip_star).toBeDefined();
    expect(cosmeticTable.wallpaper_gio).toBeDefined();
  });
});

describe('chest cosmetics', () => {
  it('only gives watering-can colours, with the halved chances and totals still 1', () => {
    const cosmetics = chestData.pool.filter((entry) => entry.category === 'cosmetics').map((entry) => entry.item);
    expect(cosmetics).toEqual(['can_mint', 'can_lavender', 'can_yellow', 'can_peach']);
    expect(chestData.categories.cosmetics).toEqual({ wooden: 0.04, silver: 0.08, golden: 0.18 });
    for (const tier of ['wooden', 'silver', 'golden'] as const) {
      const total = Object.values(chestData.categories).reduce((sum, chances) => sum + chances[tier], 0);
      expect(total).toBeCloseTo(1, 9);
    }
  });

  it('a golden chest (always one cosmetic) still rolls a can colour for every rarity roll', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const world = { ...newWorld(), bag: [{ item: 'chest_golden', count: 1 }] };
      const opened = openChest(world, 'chest_golden', createRng(seed))!;
      const cosmetic = opened.rewards.find((reward) => reward.kind === 'cosmetic');
      expect(cosmetic, `seed ${seed}`).toBeDefined();
      if (cosmetic && cosmetic.kind === 'cosmetic') expect(cosmetic.item.startsWith('can_')).toBe(true);
    }
  });
});
