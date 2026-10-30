import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';
import { registrySchema, type AssetEntry } from '../src/data/schema';
import { projectRoot } from './checks';

async function downloadFrame(url: string): Promise<PNG> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return PNG.sync.read(Buffer.from(await response.arrayBuffer()));
}

async function fetchFrameStrip(id: string, entry: AssetEntry): Promise<void> {
  const sheet = new PNG({ width: entry.frameWidth * entry.frameCount, height: entry.frameHeight });

  for (let index = 0; index < entry.frameCount; index += 1) {
    const frame = await downloadFrame(entry.source.urlTemplate.replace('{i}', String(index)));
    if (frame.width !== entry.frameWidth || frame.height !== entry.frameHeight) {
      throw new Error(`${id} frame ${index} is ${frame.width}x${frame.height}, expected ${entry.frameWidth}x${entry.frameHeight}`);
    }
    PNG.bitblt(frame, sheet, 0, 0, frame.width, frame.height, index * entry.frameWidth, 0);
  }

  const target = join(projectRoot, 'public/assets', entry.file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, PNG.sync.write(sheet));
  console.log(`${id}: saved ${entry.frameCount} frames to public/assets/${entry.file}`);
}

const registry = registrySchema.parse(
  JSON.parse(readFileSync(join(projectRoot, 'assets-src/registry.json'), 'utf8')),
);

for (const [id, entry] of Object.entries(registry)) {
  await fetchFrameStrip(id, entry);
}
