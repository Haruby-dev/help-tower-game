import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import type { GioReport, World } from '../../src/core/state';
import dialogue from '../../src/data/dialogue.json';
import monsters from '../../src/data/monsters.json';
import recipesJson from '../../src/data/recipes.json';
import { chestData, openChest } from '../../src/systems/chests';
import { dishItem } from '../../src/systems/cooking';
import { newWorld } from '../../src/systems/gauges';
import { hasMet, newVisitMemo, takePlate, teachRecipes } from '../../src/systems/monsters';
import { gainTips, tipText } from '../../src/systems/news';
import { SAVE_VERSION, parseSaveFile, toSaveFile } from '../../src/systems/save';
import { reputationStars } from '../../src/systems/sets';
import { offersFor } from '../../src/systems/shop';

const recipeShelf = (world: World): { daily: string[]; random: string[] } => {
  const recipes = offersFor(world).filter((offer) => offer.group === 'recipes');
  return { daily: recipes.filter((offer) => offer.tab === 'daily').map((offer) => offer.target), random: recipes.filter((offer) => offer.tab === 'random').map((offer) => offer.target) };
};
const withAffection = (world: World, id: string, points: number): World => ({
  ...world,
  monsters: { ...world.monsters, affection: { ...world.monsters.affection, [id]: { points, signature: false } } },
});
const report = (day: number): GioReport => ({ day, sold: [], returned: [], gross: 0, commission: 0, coins: 0, gift: null, tier: 0 });
const pointsForStars = (stars: number): number => {
  let points = 0;
  while (reputationStars(points).stars < stars) points += 1;
  return points;
};

describe('monster tastes (GDD "รสนิยมอาหาร" 7 Nov 2026)', () => {
  it('uses the GDD favourite, likes, dislike, favourite drink and favourite topping for every floor', () => {
    expect(monsters.popcorn).toMatchObject({ favourite: ['buttered_corn'], likes: ['boiled_egg', 'corn_egg_fried_rice'], dislikes: ['tomato_soup'], favouriteDrink: 'corn_milk', favouriteTopping: 'rainbow_sprinkles' });
    expect(monsters.yaibaimai).toMatchObject({ favourite: ['kapi_chili_dip'], favouriteDrink: 'basil_tea', favouriteTopping: 'umami_powder' });
    expect(monsters.tubpong).toMatchObject({ favourite: ['grilled_shrimp'], favouriteDrink: 'soy_milk', favouriteTopping: 'fish_ball' });
    expect(monsters.puefaotung).toMatchObject({ favourite: ['strawberry_milk_pudding'], dislikes: ['corn_egg_fried_rice'], favouriteTopping: 'toasted_sesame' });
    expect(monsters.puefaotung.signature).toEqual({ recipe: 'strawberry_skewer', stars: 3 });
  });

  it('merges the favourite lines held back on 7 Nov and Gio’s first news line', () => {
    expect(dialogue.monsters.puinun.favourite.any[0]).toContain('สลัดผักผลไม้');
    expect(dialogue.monsters.popcorn.favourite.any[0]).toContain('ข้าวโพดคลุกเนย');
    expect(dialogue.monsters.tubpong.favourite.any[0]).toContain('กุ้งเผา');
    expect(dialogue.gio.news[0]).toContain('สลัดผักผลไม้');
  });
});

describe('where recipes come from (spec 8.1)', () => {
  it('sells only buttered corn, grilled shrimp and kaprao shrimp as random recipes', () => {
    const seen = new Set<string>();
    for (let day = 1; day <= 60; day += 1) for (const id of recipeShelf({ ...newWorld(), day }).random) seen.add(id);
    expect([...seen].sort()).toEqual(['buttered_corn', 'grilled_shrimp', 'kaprao_shrimp']);
    const shop = Object.entries(recipesJson).filter(([, recipe]) => recipe.source === 'shop').map(([id]) => id).sort();
    expect(shop).toEqual(['buttered_corn', 'grilled_shrimp', 'kaprao_shrimp']);
  });

  it('puts the heart menu of floors 2/3/7/8/10 on the permanent shelf once she has met that monster', () => {
    const world = newWorld();
    expect(recipeShelf(world).daily).toEqual(['fruit_veg_salad']);
    const met = withAffection(world, 'popcorn', 1);
    expect(hasMet(met, 'popcorn')).toBe(true);
    expect(recipeShelf(met).daily).toEqual(['grilled_corn', 'fruit_veg_salad']);
    // ชั้น 10 เมนูประจำใจคือถังหูลู่ · ชั้น 4 สอนโดยมุกมิก ไม่ขายในร้าน
    expect(recipeShelf(withAffection(world, 'puefaotung', 1)).daily).toContain('strawberry_skewer');
    expect(recipeShelf(withAffection(world, 'toomtia', 1)).daily).toEqual(['fruit_veg_salad']);
    // เจอแฝดน้องไม่นับ (ก่อนเฉลยหน้าตาเหมือนพี่)
    expect(recipeShelf(withAffection(world, 'tangkrading_b', 1)).daily).toEqual(['fruit_veg_salad']);
  });

  it('adds the dessert recipes as rewards when the restaurant reaches each star', () => {
    const world = newWorld();
    expect(recipeShelf(world).daily).not.toContain('caramel_pudding');
    const two = { ...world, sets: { ...world.sets, reputation: pointsForStars(2) } };
    expect(recipeShelf(two).daily).toEqual(expect.arrayContaining(['whip_cream_mumu', 'caramel_pudding', 'honey_macaron', 'strawberry_jelly']));
    expect(recipeShelf(two).daily).not.toContain('cream_puff');
    const five = { ...world, sets: { ...world.sets, reputation: pointsForStars(5) } };
    expect(recipeShelf(five).daily).toEqual(expect.arrayContaining(['cream_puff', 'choco_donut', 'strawberry_parfait', 'choco_parfait']));
  });

  it('hides the rank-special recipes (no player rank yet)', () => {
    const shelf = recipeShelf({ ...newWorld(), sets: { ...newWorld().sets, reputation: pointsForStars(5) } });
    for (const id of ['fish_rice_ball', 'mackerel_chili_dip', 'steamed_crab', 'lime_steamed_fish']) expect([...shelf.daily, ...shelf.random]).not.toContain(id);
  });
});

describe('teacher monsters (spec 8.1)', () => {
  it('Mookmik teaches tomato soup at 25%, once', () => {
    const below = withAffection(newWorld(), 'mookmik', monsters.mookmik.points * 0.2);
    expect(teachRecipes(below, 'mookmik').taught).toEqual([]);
    const at = withAffection(newWorld(), 'mookmik', monsters.mookmik.points * 0.25);
    const lesson = teachRecipes(at, 'mookmik');
    expect(lesson.taught).toEqual(['tomato_soup']);
    expect(lesson.world.recipes.known).toContain('tomato_soup');
    expect(teachRecipes(lesson.world, 'mookmik').taught).toEqual([]);
  });

  it('Yai Bai Mai teaches kapi chili dip at 25% and cabbage shrimp soup at 50%; Jao Tung Tong honey apple and strawberry juice', () => {
    expect(teachRecipes(withAffection(newWorld(), 'yaibaimai', monsters.yaibaimai.points * 0.3), 'yaibaimai').taught).toEqual(['kapi_chili_dip']);
    expect(teachRecipes(withAffection(newWorld(), 'yaibaimai', monsters.yaibaimai.points * 0.5), 'yaibaimai').taught).toEqual(['kapi_chili_dip', 'cabbage_shrimp_soup']);
    expect(teachRecipes(withAffection(newWorld(), 'jaotungtong', monsters.jaotungtong.points * 0.6), 'jaotungtong').taught).toEqual(['honey_apple_grill', 'strawberry_juice']);
    // ตัวอื่นไม่สอน
    expect(teachRecipes(withAffection(newWorld(), 'puinun', monsters.puinun.points * 0.8), 'puinun').taught).toEqual([]);
  });

  it('teaches while taking from the tray when the dish pushes affection over the step', () => {
    const fish = dishItem('grilled_fish', 1);
    const start = withAffection({ ...newWorld(), tray: { level: 0, plates: [{ item: fish, count: 1 }, null, null] } }, 'mookmik', monsters.mookmik.points * 0.24);
    const taken = takePlate(start, 'mookmik', { plate: 0, item: fish, count: 1, reaction: 'neutral' }, newVisitMemo());
    expect(taken.taught).toEqual(['tomato_soup']);
    expect(taken.world.recipes.known).toContain('tomato_soup');
  });
});

describe('recipe scroll pieces from fishing chests (spec 8.1)', () => {
  const chestWorld = (patch: Partial<World>): World => ({ ...newWorld(), bag: [{ item: 'chest_wooden', count: 30 }], ...patch });

  it('gives 1 piece per chest, and 2 pieces of one recipe teach it', () => {
    const fragments = chestData.fragments;
    const others = Object.keys(fragments.recipes).filter((id) => id !== 'squid_salad');
    const world = chestWorld({ recipes: { ...newWorld().recipes, known: [...newWorld().recipes.known, ...others], fragments: { squid_salad: 1 } } });
    const opened = openChest(world, 'chest_wooden', createRng(5))!;
    const piece = opened.rewards.find((reward) => reward.kind === 'fragment');
    expect(piece).toEqual({ kind: 'fragment', item: 'squid_salad', have: 2, need: 2, learned: true });
    expect(opened.world.recipes.known).toContain('squid_salad');
    // ครบทุกสูตรแล้วไม่มีเศษอีก
    const again = openChest(opened.world, 'chest_wooden', createRng(6))!;
    expect(again.rewards.some((reward) => reward.kind === 'fragment')).toBe(false);
  });

  it('makes fish congee rarer, but after 8 chests in a row without it the next chest gives it', () => {
    let world = chestWorld({});
    const rng = createRng(11);
    let congee = 0;
    let streak = 0;
    for (let index = 0; index < 14; index += 1) {
      const opened = openChest(world, 'chest_wooden', rng)!;
      const piece = opened.rewards.find((reward) => reward.kind === 'fragment')!;
      if (piece.item === 'fish_congee') {
        congee += 1;
        streak = 0;
      } else streak += 1;
      expect(streak).toBeLessThanOrEqual(chestData.fragments.rare.after);
      world = opened.world;
    }
    expect(congee).toBe(2);
    expect(Object.keys(chestData.fragments.recipes).every((id) => world.recipes.known.includes(id))).toBe(true);
    const due = openChest(chestWorld({ chests: { sinceCosmetic: 0, sinceRareFragment: chestData.fragments.rare.after } }), 'chest_wooden', createRng(2))!;
    expect(due.rewards.find((reward) => reward.kind === 'fragment')).toMatchObject({ item: 'fish_congee', have: 1 });
  });

  it('Gio hints once that recipe scrolls float in the water, after the first fish', () => {
    const noFish = gainTips({ ...newWorld(), day: 2, gio: { ...newWorld().gio, report: report(2) } });
    expect(noFish.gio.tips.some((tip) => tip.kind === 'scroll_hint')).toBe(false);
    const fished: World = { ...newWorld(), day: 2, fishing: { ...newWorld().fishing, caught: { lost_mackerel: 1 } }, gio: { ...newWorld().gio, report: report(2) } };
    const hinted = gainTips(fished);
    const hints = hinted.gio.tips.filter((tip) => tip.kind === 'scroll_hint');
    expect(hints).toHaveLength(1);
    expect(tipText(hints[0]!)).toContain('ม้วนสูตรลอยมากับน้ำ');
    const later = gainTips({ ...hinted, day: 3, gio: { ...hinted.gio, report: report(3) } });
    expect(later.gio.tips.filter((tip) => tip.kind === 'scroll_hint')).toHaveLength(1);
  });
});

describe('save version 23', () => {
  it('adds empty recipe scroll pieces to an old save', () => {
    const file = toSaveFile(newWorld());
    const { fragments: _fragments, ...recipes } = file.world.recipes;
    const oldWorld = { ...file.world, recipes, chests: { sinceCosmetic: 3 } };
    const parsed = parseSaveFile({ ...file, version: 22, world: oldWorld })!;
    expect(SAVE_VERSION).toBe(24);
    expect(parsed.version).toBe(24);
    expect(parsed.world.recipes.fragments).toEqual({});
    expect(parsed.world.chests).toEqual({ sinceCosmetic: 3, sinceRareFragment: 0 });
  });
});
