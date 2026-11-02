import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod';
import {
  balanceSchema,
  cropsSchema,
  ingredientsSchema,
  recipesSchema,
  displaySchema,
  linesSchema,
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
  checkSchema('src/data/sprite-meta.json', spriteMetaSchema, problems);
  checkSchema('src/i18n/th.json', translationsSchema, problems);
  checkSchema('assets-src/registry.json', registrySchema, problems);
  if (problems.length > 0) return problems;

  const registry = registrySchema.parse(readJson('assets-src/registry.json'));
  const spriteMeta = spriteMetaSchema.parse(readJson('src/data/sprite-meta.json'));
  const translations = translationsSchema.parse(readJson('src/i18n/th.json'));
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
    for (const item of Object.keys(recipe.ingredients)) {
      const known = item.startsWith('produce_') ? cropIds[item.slice('produce_'.length)] : ingredientIds[item.slice('ing_'.length)];
      if (!known) problems.push(`src/data/recipes.json: ${id} uses unknown ${item}`);
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
