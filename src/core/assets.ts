import registryJson from '../../assets-src/registry.json';
import spriteMetaJson from '../data/sprite-meta.json';
import type { CharacterEntry, Registry, SpriteMeta } from '../data/schema';

export const registry = registryJson as unknown as Registry;
const spriteMeta = spriteMetaJson as SpriteMeta;

export function assetUrl(file: string): string {
  return `${import.meta.env.BASE_URL}assets/${file}`;
}

export function characterEntry(id: string): CharacterEntry {
  const entry = registry[id];
  if (entry?.type !== 'character') throw new Error(`${id} is not a character in the registry`);
  return entry;
}

export function directionsOf(entry: CharacterEntry): string[] {
  return Object.keys(entry.directions);
}

export function footY(id: string, direction = 'default'): number {
  const value = spriteMeta[id]?.footY[direction];
  if (value === undefined) throw new Error(`${id} has no foot position for ${direction}`);
  return value;
}

export function animationKey(id: string, direction: string): string {
  return `${id}_${direction}`;
}
