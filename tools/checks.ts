import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod';
import { displaySchema, registrySchema, translationsSchema } from '../src/data/schema';

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
  checkSchema('src/i18n/th.json', translationsSchema, problems);
  checkSchema('assets-src/registry.json', registrySchema, problems);
  if (problems.length > 0) return problems;

  const registry = registrySchema.parse(readJson('assets-src/registry.json'));
  for (const [id, entry] of Object.entries(registry)) {
    if (!existsSync(join(projectRoot, 'public/assets', entry.file))) {
      problems.push(`assets-src/registry.json: ${id} points to missing file ${entry.file}`);
    }
  }

  const translations = translationsSchema.parse(readJson('src/i18n/th.json'));
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
