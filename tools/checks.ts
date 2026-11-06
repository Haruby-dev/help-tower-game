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
  translationsSchema,
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
  checkSchema('src/data/fish.json', fishSchema, problems);
  checkSchema('src/data/baits.json', baitsSchema, problems);
  checkSchema('src/data/chests.json', chestsSchema, problems);
  checkSchema('src/data/cosmetics.json', cosmeticsSchema, problems);
  checkSchema('src/data/shop.json', shopSchema, problems);
  checkSchema('src/data/monsters.json', monstersSchema, problems);
  checkSchema('src/data/dialogue.json', dialogueSchema, problems);
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
    ...audio.voiceTakes.map((key): [string, string] => [key, 'voice']),
    ...[...audio.bath.splashes, ...audio.steps.keys, ...audio.chestItems].map((key): [string, string] => [key, 'sfx']),
    ...[audio.ambience.day, audio.ambience.night, audio.ambience.rain].map((key): [string, string] => [key, 'amb']),
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
  for (const id of Object.keys(ingredientIds)) {
    if (!translations[`ingredient.${id}.name`]) problems.push(`src/i18n/th.json: ingredient ${id} has no name`);
  }
  for (const [id, recipe] of Object.entries(recipesSchema.parse(readJson('src/data/recipes.json')))) {
    if (!translations[`dish.${id}.name`]) problems.push(`src/i18n/th.json: dish ${id} has no name`);
    if (recipe.icon && !registry[recipe.icon]) problems.push(`src/data/recipes.json: ${id} icon ${recipe.icon} is not registered`);
    if (recipe.bagIcon && !registry[recipe.bagIcon]) problems.push(`src/data/recipes.json: ${id} bag icon ${recipe.bagIcon} is not registered`);
    if (!recipeStepsSchema.parse(readJson('src/data/recipe_steps.json'))[id]) problems.push(`src/data/recipe_steps.json: ${id} has no steps`);
    for (const item of Object.keys(recipe.ingredients)) {
      const known = item.startsWith('produce_') ? cropIds[item.slice('produce_'.length)] : ingredientIds[item.slice('ing_'.length)];
      if (!known) problems.push(`src/data/recipes.json: ${id} uses unknown ${item}`);
    }
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

  return problems;
}
