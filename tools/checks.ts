import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import type { z } from 'zod';
import { atlasGroups, fileHash } from './pack-atlases';
import {
  atlasSchema,
  audioIndexSchema,
  audioSchema,
  balanceSchema,
  baitsSchema,
  chestsSchema,
  cosmeticsSchema,
  cropsSchema,
  dialogueSchema,
  gatesSchema,
  gateMapSchema,
  mailSchema,
  petsSchema,
  fishSchema,
  monstersSchema,
  ingredientsSchema,
  recipeStepsSchema,
  recipesSchema,
  displaySchema,
  linesSchema,
  shopSchema,
  registrySchema,
  spriteMetaSchema,
  toppingsSchema,
  translationsSchema,
  workbenchSchema,
  stationsSchema,
  setsSchema,
} from '../src/data/schema';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const THAI_CHARACTER = /[฀-๿]/;
const TEXT_KEY_REFERENCE = /\bt\(\s*'([^']+)'\s*\)|'([a-z_]+(?:\.[a-z_]+)+)'/g;
const COMMENT = /\/\*[\s\S]*?\*\/|\/\/.*$/gm;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(projectRoot, path), 'utf8'));
}

function checkSchema(path: string, schema: z.ZodType, problems: string[]): void {
  const result = schema.safeParse(readJson(path));
  if (!result.success) problems.push(`${path}: ${result.error.message}`);
}

/** ภาพตัวเอกสาวทุกชิ้น ท่าเดิน ท่ายืน ท่าทำงาน และหน้าในแถบบน */
const GIRL_ART = /^(player_girl_(walk|stand)|anim_[a-z]+_(south|east|north)|portrait_girl_[a-z]+)$/;
const OLD_SKIN = 0xf9bfab;
/** ภาพผิวเดิมมีสีนี้ราว 5–20% ของพิกเซลทึบ ภาพผิวสว่างไม่มีเลย */
const OLD_SKIN_MAX_SHARE = 0.01;

function oldSkinShare(path: string): number {
  const { data } = PNG.sync.read(readFileSync(path));
  let opaque = 0;
  let old = 0;
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) < 128) continue;
    opaque += 1;
    if ((((data[i] ?? 0) << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0)) === OLD_SKIN) old += 1;
  }
  return opaque > 0 ? old / opaque : 0;
}

function listCodeFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return listCodeFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

export function checkProject(): string[] {
  const problems: string[] = [];

  checkSchema('src/data/display.json', displaySchema, problems);
  checkSchema('src/data/balance.json', balanceSchema, problems);
  checkSchema('src/data/lines.json', linesSchema, problems);
  checkSchema('src/data/crops.json', cropsSchema, problems);
  checkSchema('src/data/recipes.json', recipesSchema, problems);
  checkSchema('src/data/ingredients.json', ingredientsSchema, problems);
  checkSchema('src/data/recipe_steps.json', recipeStepsSchema, problems);
  checkSchema('src/data/toppings.json', toppingsSchema, problems);
  checkSchema('src/data/workbench.json', workbenchSchema, problems);
  checkSchema('src/data/stations.json', stationsSchema, problems);
  checkSchema('src/data/sets.json', setsSchema, problems);
  checkSchema('src/data/fish.json', fishSchema, problems);
  checkSchema('src/data/baits.json', baitsSchema, problems);
  checkSchema('src/data/chests.json', chestsSchema, problems);
  checkSchema('src/data/cosmetics.json', cosmeticsSchema, problems);
  checkSchema('src/data/shop.json', shopSchema, problems);
  checkSchema('src/data/monsters.json', monstersSchema, problems);
  checkSchema('src/data/dialogue.json', dialogueSchema, problems);
  checkSchema('src/data/pets.json', petsSchema, problems);
  checkSchema('src/data/gates.json', gatesSchema, problems);
  checkSchema('src/data/mail.json', mailSchema, problems);
  checkSchema('src/data/audio.json', audioSchema, problems);
  checkSchema('public/assets/audio/_audio_index.json', audioIndexSchema, problems);
  checkSchema('src/data/sprite-meta.json', spriteMetaSchema, problems);
  checkSchema('src/i18n/th.json', translationsSchema, problems);
  checkSchema('assets-src/registry.json', registrySchema, problems);
  checkSchema('src/data/atlas.json', atlasSchema, problems);
  if (problems.length > 0) return problems;

  // แผ่นรวมภาพต้องตรงกับไฟล์ต้นทาง: ครบทุกภาพ ไฟล์แผ่นมีจริง และไม่มีภาพไหนเปลี่ยนหลังรวม (ไม่งั้นเกมแสดงภาพเก่า)
  const atlas = atlasSchema.parse(readJson('src/data/atlas.json'));
  const stale = 'run npm run pack-atlases';
  for (const page of atlas.pages) if (!existsSync(join(projectRoot, 'public/assets', page.file))) problems.push(`src/data/atlas.json: sheet ${page.file} is missing (${stale})`);
  for (const items of atlasGroups().values()) {
    for (const { id, file } of items) {
      if (!atlas.frames[id]) problems.push(`src/data/atlas.json: ${id} is not in an atlas sheet (${stale})`);
      else if (atlas.hashes[file] !== fileHash(file)) problems.push(`src/data/atlas.json: ${file} changed after packing (${stale})`);
    }
  }
  const registered = readJson('assets-src/registry.json') as Record<string, unknown>;
  for (const id of Object.keys(atlas.frames)) if (!registered[id]) problems.push(`src/data/atlas.json: ${id} is not in the registry (${stale})`);

  // เสียงทุกตัวในรายการมีทั้ง .ogg และ .m4a (iPhone ใช้ .m4a) และเพลงทุกเพลงมีจุดวน
  const audioIndex = audioIndexSchema.parse(readJson('public/assets/audio/_audio_index.json'));
  for (const [key, group] of Object.entries(audioIndex)) {
    for (const ext of ['ogg', 'm4a']) {
      const file = `public/assets/audio/${group}/${key}.${ext}`;
      if (!existsSync(join(projectRoot, file))) problems.push(`${file}: missing`);
    }
  }
  const audio = audioSchema.parse(readJson('src/data/audio.json'));
  for (const key of Object.keys(audio.music)) {
    if (audioIndex[key] !== 'bgm') problems.push(`src/data/audio.json: music ${key} is not a bgm key in _audio_index.json`);
  }
  // ชื่อเสียงทุกตัวที่ audio.json อ้างต้องมีในรายการ และอยู่กลุ่มที่ถูกต้อง
  const wanted: [string, string][] = [
    ...[...audio.voiceTakes, audio.tillVoice].map((key): [string, string] => [key, 'voice']),
    ...[...audio.bath.splashes, ...audio.steps.keys, ...audio.steps.dirtKeys, ...audio.chestItems, audio.eatSound, audio.faint, audio.twinChime.key].map((key): [string, string] => [key, 'sfx']),
    ...[audio.ambience.day, audio.ambience.night, audio.ambience.rain, audio.nearAmbience.pond.key, audio.nearAmbience.campfire.key].map((key): [string, string] => [key, 'amb']),
  ];
  for (const [key, group] of wanted) {
    if (audioIndex[key] !== group) problems.push(`src/data/audio.json: ${key} is not a ${group} key in _audio_index.json`);
  }

  const registry = registrySchema.parse(readJson('assets-src/registry.json'));
  const spriteMeta = spriteMetaSchema.parse(readJson('src/data/sprite-meta.json'));
  const translations = translationsSchema.parse(readJson('src/i18n/th.json'));
  for (const treat of shopSchema.parse(readJson('src/data/shop.json')).treats) {
    if (!translations[`item.${treat.item}.name`]) problems.push(`src/data/shop.json: ${treat.item} has no name in th.json`);
  }
  for (const [id, entry] of Object.entries(registry)) {
    if (entry.type === 'placeholder') {
      if (!translations[entry.labelKey]) problems.push(`assets-src/registry.json: ${id} has no text ${entry.labelKey}`);
      continue;
    }
    if (entry.type === 'not_used') continue;
    if (!existsSync(join(projectRoot, 'public/assets', entry.file))) {
      problems.push(`assets-src/registry.json: ${id} points to missing file ${entry.file}`);
    }
    if (entry.type !== 'tileset' && entry.type !== 'local_tileset' && !spriteMeta[id]) {
      problems.push(`src/data/sprite-meta.json: ${id} has no foot position, run npm run fetch-assets`);
    }
  }

  for (const [id, crop] of Object.entries(cropsSchema.parse(readJson('src/data/crops.json')))) {
    if (!translations[`crop.${id}.name`]) problems.push(`src/i18n/th.json: crop ${id} has no name`);
    for (const prefix of ['crop', 'icon', 'seed']) {
      if (!registry[`${prefix}_${id}`]) problems.push(`assets-src/registry.json: crop ${id} has no ${prefix} image`);
    }
    if ((crop.regrowDays === null) !== (crop.regrowYield === null)) problems.push(`src/data/crops.json: ${id} regrow numbers do not match`);
    if (crop.regrowDays !== null && !registry[`withered_${id}`]) problems.push(`assets-src/registry.json: crop ${id} has no withered image`);
  }

  const cropIds = cropsSchema.parse(readJson('src/data/crops.json'));
  const ingredientIds = ingredientsSchema.parse(readJson('src/data/ingredients.json'));
  const fishData = fishSchema.parse(readJson('src/data/fish.json'));
  const knownItem = (item: string): boolean => {
    if (item.startsWith('produce_')) return Boolean(cropIds[item.slice('produce_'.length)]);
    if (item.startsWith('fish_')) return Boolean(fishData[item.slice('fish_'.length)]);
    return Boolean(ingredientIds[item.slice('ing_'.length)]);
  };
  for (const id of Object.keys(ingredientIds)) {
    if (!translations[`ingredient.${id}.name`]) problems.push(`src/i18n/th.json: ingredient ${id} has no name`);
  }
  for (const [id, recipe] of Object.entries(recipesSchema.parse(readJson('src/data/recipes.json')))) {
    if (!translations[`dish.${id}.name`]) problems.push(`src/i18n/th.json: dish ${id} has no name`);
    if (recipe.icon && !registry[recipe.icon]) problems.push(`src/data/recipes.json: ${id} icon ${recipe.icon} is not registered`);
    if (recipe.bagIcon && !registry[recipe.bagIcon]) problems.push(`src/data/recipes.json: ${id} bag icon ${recipe.bagIcon} is not registered`);
    if (!recipeStepsSchema.parse(readJson('src/data/recipe_steps.json'))[id]) problems.push(`src/data/recipe_steps.json: ${id} has no steps`);
    for (const item of Object.keys(recipe.ingredients)) {
      if (!knownItem(item)) problems.push(`src/data/recipes.json: ${id} uses unknown ${item}`);
    }
  }
  // กลุ่มวัตถุดิบ (ปลาชนิดไหนก็ได้ ลูกชิ้น) ต้องอ้างของที่มีจริง และกลุ่มปลาต้องมีปลาอย่างน้อยหนึ่งชนิด
  for (const [id, entry] of Object.entries(ingredientIds)) {
    for (const member of entry.anyOf ?? []) if (!knownItem(member)) problems.push(`src/data/ingredients.json: ${id} uses unknown ${member}`);
    const group = entry.fish;
    if (group && !Object.values(fishData).some((fish) => fish.kind === group.kind && (group.rank === undefined || fish.rank === group.rank))) {
      problems.push(`src/data/ingredients.json: fish group ${id} matches no fish`);
    }
  }

  // ท็อปปิ้ง: ใช้ของที่มีจริงและมีภาพบนจาน
  const toppingData = toppingsSchema.parse(readJson('src/data/toppings.json'));
  for (const [id, topping] of Object.entries(toppingData)) {
    if (!knownItem(topping.item)) problems.push(`src/data/toppings.json: ${id} uses unknown ${topping.item}`);
    if (registry[topping.art]?.type !== 'local') problems.push(`src/data/toppings.json: ${id} art ${topping.art} is not a local image`);
  }

  if (registry[balanceSchema.parse(readJson('src/data/balance.json')).hud.interactIcon]?.type !== 'local') problems.push('src/data/balance.json: hud.interactIcon is not a local image');

  // ร้านจีโอมาร์ท (ขั้นที่ 7): วัตถุดิบเป็นของจริงหรือเหยื่อจริง ท็อปปิ้งอยู่ใน toppings.json
  const shopFile = shopSchema.parse(readJson('src/data/shop.json'));
  const baitItems = new Set(Object.values(baitsSchema.parse(readJson('src/data/baits.json'))).map((bait) => bait.item));
  for (const entry of [...shopFile.ingredients.daily, ...shopFile.ingredients.random]) {
    if (!knownItem(entry.item) && !baitItems.has(entry.item)) problems.push(`src/data/shop.json: ${entry.item} is not an ingredient or bait`);
  }
  const toppingItems = new Set(Object.values(toppingData).map((topping) => topping.item));
  for (const entry of shopFile.toppings.items) if (!toppingItems.has(entry.item)) problems.push(`src/data/shop.json: ${entry.item} is not a topping`);
  if (shopFile.toppings.kinds[1]! > shopFile.toppings.items.length) problems.push('src/data/shop.json: toppings.kinds is more than the topping list');

  // โต๊ะช่าง: วัสดุเป็นวัสดุจริง ของที่ได้มีชื่อและภาพ · บทครั้งแรกอ้างของที่มีจริง
  const craftBalance = balanceSchema.parse(readJson('src/data/balance.json')).crafting;
  const isMaterial = (item: string): boolean => craftBalance.materials.includes(item) || knownItem(item);
  for (const [id, recipe] of Object.entries(workbenchSchema.parse(readJson('src/data/workbench.json')))) {
    if (!translations[`item.${id}.name`]) problems.push(`src/i18n/th.json: workbench item ${id} has no name`);
    if (registry[id]?.type !== 'local') problems.push(`assets-src/registry.json: workbench item ${id} has no image`);
    for (const item of Object.keys(recipe.materials)) if (!isMaterial(item)) problems.push(`src/data/workbench.json: ${id} uses unknown material ${item}`);
  }
  for (const item of [...Object.keys(craftBalance.banana), ...Object.values(craftBalance.harvestExtras).flatMap((extras) => Object.keys(extras))]) {
    if (!isMaterial(item)) problems.push(`src/data/balance.json: crafting gives unknown ${item}`);
  }
  // สถานี: วัตถุดิบและของที่ได้มีจริง สูตรอาหารที่ครกสอนมีจริง
  const stationData = stationsSchema.parse(readJson('src/data/stations.json'));
  const stationRecipes = [...Object.values(stationData.drying.recipes), ...Object.values(stationData.mortar.items)];
  for (const recipe of stationRecipes) {
    for (const item of [...Object.keys(recipe.in), recipe.out]) if (!isMaterial(item)) problems.push(`src/data/stations.json: unknown item ${item}`);
  }
  for (const entry of stationData.trap.catch) if (!knownItem(entry.item)) problems.push(`src/data/stations.json: trap catches unknown ${entry.item}`);
  for (const id of stationData.mortar.teaches) if (!recipesSchema.parse(readJson('src/data/recipes.json'))[id]) problems.push(`src/data/stations.json: mortar teaches unknown recipe ${id}`);
  // จัดชุด: ถาดมีจริง ชุดคอมโบอ้างสูตรและกลุ่มที่มีจริง จำนวนช่องเท่าขนาดถาด และมีชื่อ
  const setData = setsSchema.parse(readJson('src/data/sets.json'));
  const allRecipes = recipesSchema.parse(readJson('src/data/recipes.json'));
  for (const tray of Object.values(setData.trays)) if (registry[tray.item]?.type !== 'local') problems.push(`src/data/sets.json: tray ${tray.item} has no image`);
  for (const [id, group] of Object.entries(setData.groups)) {
    if ('recipes' in group) for (const recipe of group.recipes) if (!allRecipes[recipe]) problems.push(`src/data/sets.json: group ${id} uses unknown recipe ${recipe}`);
  }
  for (const [id, combo] of Object.entries(setData.combos)) {
    if (!translations[`combo.${id}.name`]) problems.push(`src/i18n/th.json: combo ${id} has no name`);
    if (!translations[`news.set_hint.${id}`]) problems.push(`src/i18n/th.json: combo ${id} has no gio hint`);
    if (combo.slots.length !== setData.trays[combo.tray].pieces) problems.push(`src/data/sets.json: combo ${id} does not fill its tray`);
    for (const slot of combo.slots) {
      if (slot.startsWith('@') ? !setData.groups[slot.slice(1)] : !allRecipes[slot]) problems.push(`src/data/sets.json: combo ${id} uses unknown ${slot}`);
    }
  }
  if (registry[setData.bigTable.item]?.type !== 'local') problems.push('src/data/sets.json: big table has no image');
  for (const item of Object.keys(linesSchema.parse(readJson('src/data/lines.json')).player.firstItem)) {
    if (!isMaterial(item)) problems.push(`src/data/lines.json: first-item line for unknown ${item}`);
  }

  // มอนสเตอร์: ชื่อและประโยคครบ 100% อยู่ใน th.json เมนูทุกเมนูมีจริง เมนูประจำใจทำได้ในโซน (แรงก์ไม่เกินอุปกรณ์ช่วงนั้น) ภาพครบทุกท่า และมีบทพูด
  const recipesData = recipesSchema.parse(readJson('src/data/recipes.json'));
  const balanceData = balanceSchema.parse(readJson('src/data/balance.json'));
  const dialogueData = dialogueSchema.parse(readJson('src/data/dialogue.json'));
  const ranks = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
  for (const [id, monster] of Object.entries(monstersSchema.parse(readJson('src/data/monsters.json')))) {
    // แฝดน้องไม่มีบทครบ 100% ของตัวเอง (ฉากเฉลยใช้บทแฝด) และใช้บทพูดของพี่ · พี่มีชื่อหลังเฉลยเพิ่ม
    const keys = monster.twinOf ? [`monster.${id}.name`, `monster.${monster.twinOf}.name_revealed`] : [`monster.${id}.name`, `monster.${id}.clear`];
    for (const key of keys) if (!translations[key]) problems.push(`src/i18n/th.json: monster ${id} has no ${key}`);
    if (monster.twinOf && !monstersSchema.parse(readJson('src/data/monsters.json'))[monster.twinOf]) problems.push(`src/data/monsters.json: ${id} is a twin of unknown ${monster.twinOf}`);
    const menus = [...monster.favourite, ...monster.likes, ...monster.dislikes, monster.signature.recipe];
    if (recipesData[monster.favouriteDrink]?.category !== 'drink') problems.push(`src/data/monsters.json: ${id} favourite drink ${monster.favouriteDrink} is not a drink`);
    for (const recipe of menus) if (!recipesData[recipe]) problems.push(`src/data/monsters.json: ${id} uses unknown recipe ${recipe}`);
    if (monster.favouriteTopping && !toppingData[monster.favouriteTopping]) problems.push(`src/data/monsters.json: ${id} favourite topping ${monster.favouriteTopping} is unknown`);
    const signature = recipesData[monster.signature.recipe];
    const highest = monster.zone === 1 ? 'D' : 'SSS';
    if (signature && ranks.indexOf(signature.rank) > ranks.indexOf(highest)) problems.push(`src/data/monsters.json: ${id} signature ${monster.signature.recipe} cannot be cooked in zone ${monster.zone}`);
    if (!dialogueData.monsters[monster.twinOf ?? id]) problems.push(`src/data/dialogue.json: monster ${id} has no lines`);
    if (monster.art) {
      for (const mood of ['hungry', 'sweet']) {
        for (const kind of ['stand', 'walk', 'eat']) if (!registry[`${monster.art.sheet}_${mood}_${kind}`]) problems.push(`assets-src/registry.json: ${id} has no ${monster.art.sheet}_${mood}_${kind}`);
      }
    }
  }
  // ที่มาของสูตร (ขั้นที่ 8): ครูสอนสูตร teacher มีบทสอน · ของหวาน reputation อยู่ในรายการดาวของร้าน · สูตร chest อยู่ในเศษม้วน · shop_heart เป็นเมนูประจำใจ
  const monsterData = monstersSchema.parse(readJson('src/data/monsters.json'));
  const taught = new Set<string>();
  for (const [id, monster] of Object.entries(monsterData)) {
    for (const lesson of monster.teaches ?? []) {
      taught.add(lesson.recipe);
      if (recipesData[lesson.recipe]?.source !== 'teacher') problems.push(`src/data/monsters.json: ${id} teaches ${lesson.recipe} which is not a teacher recipe`);
      if (!dialogueData.teach[id]?.[lesson.recipe]) problems.push(`src/data/dialogue.json: ${id} has no teach line for ${lesson.recipe}`);
    }
  }
  const shopFile8 = shopSchema.parse(readJson('src/data/shop.json'));
  const reputationList = new Set(Object.values(shopFile8.reputationRecipes).flat());
  const fragmentList = chestsSchema.parse(readJson('src/data/chests.json')).fragments;
  if (!fragmentList.recipes[fragmentList.rare.recipe]) problems.push(`src/data/chests.json: rare fragment ${fragmentList.rare.recipe} is not in the fragment list`);
  for (const id of [...reputationList, ...Object.keys(fragmentList.recipes)]) if (!recipesData[id]) problems.push(`unknown recipe ${id} in shop.json or chests.json`);
  for (const [id, recipe] of Object.entries(recipesData)) {
    const wrong = (where: string): void => void problems.push(`src/data/recipes.json: ${id} has source ${recipe.source} but ${where}`);
    if (recipe.source === 'teacher' && !taught.has(id)) wrong('no monster teaches it');
    if ((recipe.source === 'reputation') !== reputationList.has(id)) wrong('the reputation list in shop.json does not match');
    if ((recipe.source === 'chest') !== (fragmentList.recipes[id] !== undefined)) wrong('the fragment list in chests.json does not match');
    if (recipe.source === 'shop_heart' && !Object.values(monsterData).some((monster) => !monster.twinOf && monster.signature.recipe === id)) wrong('it is no monster’s heart menu');
  }
  for (const item of Object.keys(balanceData.fertilizer.tiers)) {
    if (!translations[`item.${item}.name`]) problems.push(`src/i18n/th.json: ${item} has no name`);
    if (!registry[item]) problems.push(`assets-src/registry.json: ${item} has no bag image`);
  }
  const shopData = shopSchema.parse(readJson('src/data/shop.json'));
  for (const entry of shopData.fertilizers) {
    if (balanceData.fertilizer.tiers[entry.item] === undefined) problems.push(`src/data/shop.json: ${entry.item} is not a fertilizer in balance.json`);
  }
  for (const [target, art] of Object.entries(shopData.shelfArt)) {
    if (registry[art]?.type !== 'local') problems.push(`src/data/shop.json: shelf art ${art} for ${target} is not registered`);
  }
  for (const level of balanceData.tray.levels) if (!registry[level.id]) problems.push(`src/data/balance.json: tray ${level.id} is not registered`);

  const baits = baitsSchema.parse(readJson('src/data/baits.json'));
  const rods = balanceSchema.parse(readJson('src/data/balance.json')).fishing.rods;
  for (const [id, fish] of Object.entries(fishSchema.parse(readJson('src/data/fish.json')))) {
    if (!translations[`fish.${id}.name`]) problems.push(`src/i18n/th.json: fish ${id} has no name`);
    for (const art of [`fish_${id}`, `ing_mini_fish_${id}`]) if (!registry[art]) problems.push(`assets-src/registry.json: fish ${id} has no image ${art}`);
    if (!baits[fish.bait]) problems.push(`src/data/fish.json: ${id} uses unknown bait ${fish.bait}`);
    if (!rods[fish.rod]) problems.push(`src/data/fish.json: ${id} uses unknown rod ${fish.rod}`);
  }
  for (const [id, bait] of Object.entries(baits)) {
    if (!translations[`item.${bait.item}.name`]) problems.push(`src/i18n/th.json: bait ${id} has no name`);
    if (!registry[bait.item]) problems.push(`assets-src/registry.json: bait ${id} has no image`);
  }
  const cosmetics = cosmeticsSchema.parse(readJson('src/data/cosmetics.json'));
  for (const [id, cosmetic] of Object.entries(cosmetics)) {
    if (!translations[`cosmetic.${id}.name`]) problems.push(`src/i18n/th.json: cosmetic ${id} has no name`);
    if (!registry[cosmetic.art]) problems.push(`src/data/cosmetics.json: ${id} art ${cosmetic.art} is not registered`);
  }
  const chests = chestsSchema.parse(readJson('src/data/chests.json'));
  for (const [tier, info] of Object.entries(chests.tiers)) {
    if (!registry[info.item] || !translations[`item.${info.item}.name`]) problems.push(`src/data/chests.json: ${tier} chest needs an image and a name`);
  }
  for (const entry of chests.pool) {
    const named =
      entry.kind === 'seed_bag' ||
      (entry.kind === 'cosmetic' ? cosmetics[entry.item] !== undefined : entry.item.startsWith('ing_') ? translations[`ingredient.${entry.item.slice(4)}.name`] : translations[`item.${entry.item}.name`]);
    if (!named) problems.push(`src/data/chests.json: ${entry.item} has no name`);
    if (entry.min > entry.max) problems.push(`src/data/chests.json: ${entry.item} min is above max`);
  }

  // ผู้ใช้เลือกตัวเอกผิวสว่าง 4 พ.ย. 2026 ถ้าภาพไหนกลับเป็นผิวเดิม แปลว่าการดึงภาพเขียนทับ
  for (const [id, entry] of Object.entries(registry)) {
    if (!GIRL_ART.test(id) || entry.type === 'not_used' || entry.type === 'placeholder') continue;
    const path = join(projectRoot, 'public/assets', entry.file);
    if (existsSync(path) && oldSkinShare(path) > OLD_SKIN_MAX_SHARE) {
      problems.push(`public/assets/${entry.file}: ${id} has the old skin colour #${OLD_SKIN.toString(16)}, the fair skin was overwritten`);
    }
  }

  for (const file of listCodeFiles(join(projectRoot, 'src'))) {
    const label = relative(projectRoot, file);
    const code = readFileSync(file, 'utf8').replace(COMMENT, '');
    if (THAI_CHARACTER.test(code)) problems.push(`${label}: Thai text belongs in src/i18n/th.json`);
    for (const match of code.matchAll(TEXT_KEY_REFERENCE)) {
      const key = match[1] ?? match[2];
      if (key && !translations[key]) problems.push(`${label}: missing text key ${key}`);
    }
  }

  // เกตที่เดินเข้าไปได้: แผนที่ผ่าน schema มีภาพพื้นหลัง ชั้นหน้า ญาติมอนสเตอร์ครบ และของรางวัลกับของป่ามีชื่อในเกม
  const gatesFile = gatesSchema.parse(readJson('src/data/gates.json'));
  const monsterFile = monstersSchema.parse(readJson('src/data/monsters.json'));
  const itemNamed = (item: string): boolean =>
    item.startsWith('ing_') ? Boolean(translations[`ingredient.${item.slice('ing_'.length)}.name`] && ingredientIds[item.slice('ing_'.length)]) : Boolean(translations[`item.${item}.name`]);
  // รางวัลครั้งแรกของทุกบาน: ของต้องมีชื่อในเกม สูตรต้องเป็นสูตรของเกต และสูตรของเกตทุกสูตรต้องมีบานที่ให้
  const gateRecipes = new Set<string>();
  for (const gate of gatesFile.gates) {
    if (!gate.reward) continue;
    if ('recipe' in gate.reward) {
      gateRecipes.add(gate.reward.recipe);
      if (recipesData[gate.reward.recipe]?.source !== 'gate') problems.push(`src/data/gates.json: floor ${gate.floor} reward ${gate.reward.recipe} is not a gate recipe`);
    } else if (!itemNamed(gate.reward.item)) problems.push(`src/data/gates.json: floor ${gate.floor} reward ${gate.reward.item} has no name`);
  }
  for (const [id, recipe] of Object.entries(recipesData)) {
    if (recipe.source === 'gate' && !gateRecipes.has(id)) problems.push(`src/data/recipes.json: ${id} is a gate recipe but no gate gives it`);
  }
  for (const gate of gatesFile.gates) {
    if (!gate.map) continue;
    const label = `src/data/gate_maps/${gate.map}_map.json`;
    if (!existsSync(join(projectRoot, label))) {
      problems.push(`src/data/gates.json: floor ${gate.floor} map ${gate.map} has no ${label}`);
      continue;
    }
    const parsed = gateMapSchema.safeParse(readJson(label));
    if (!parsed.success) {
      problems.push(`${label}: ${parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ')}`);
      continue;
    }
    const map = parsed.data;
    // ฉากกล่องสี (box) วาดด้วยโค้ด ไม่มีภาพพื้นหลัง · บานที่ใช้ต้องบอกมอนสเตอร์เจ้าของชั้นเอง
    if (gate.map === 'box') {
      if (!gate.owner) problems.push(`src/data/gates.json: floor ${gate.floor} uses the colour-box scene but has no owner`);
    } else {
      for (const layer of ['bg', 'fg']) {
        const entry = registry[`${gate.map}_${layer}`];
        if (entry?.type !== 'local') problems.push(`assets-src/registry.json: gate ${gate.floor} has no ${gate.map}_${layer} image`);
        else if (entry.width !== map.size[0] * map.tile || entry.height !== map.size[1] * map.tile) problems.push(`assets-src/registry.json: ${gate.map}_${layer} does not match the map size`);
      }
    }
    const owner = gate.owner ?? map.owner.monster;
    if (!monsterFile[owner]?.art) problems.push(`${label}: monster ${owner} has no art`);
    if (gate.owner && monsterFile[gate.owner]?.floor !== gate.floor) problems.push(`src/data/gates.json: floor ${gate.floor} owner ${gate.owner} does not live on that floor`);
    if (map.kin) {
      if (!monsterFile[map.kin.monster]?.art) problems.push(`${label}: monster ${map.kin.monster} has no art`);
      for (const variant of map.kin.variants) {
        for (const kind of ['stand', 'walk', 'eat']) {
          if (!registry[`${gate.map}_kin_${variant}_sweet_${kind}`]) problems.push(`assets-src/registry.json: ${label} kin ${variant} has no ${kind} sheet`);
        }
      }
    }
    for (const [x, y] of map.blocked) if (x >= map.size[0] || y >= map.size[1]) problems.push(`${label}: blocked cell ${x},${y} is outside the map`);
    if (gate.forage && !itemNamed(gate.forage.item)) problems.push(`src/data/gates.json: floor ${gate.floor} forage ${gate.forage.item} has no name`);
    if (gate.reward && !registry.gate_reward_chest) problems.push('assets-src/registry.json: gate_reward_chest is missing');
  }

  return problems;
}
