import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { createRng } from '../src/core/rng';
import { registrySchema, tilesetMetaSchema, type TilesetMeta } from '../src/data/schema';
import { projectRoot } from './checks';
import {
  blockedRects,
  buildCorners,
  footprintRect,
  tileCorners,
  type MapLayout,
  type Rect,
  type Terrain,
  type TileCorners,
} from './map-layout';

const TILE_SIZE = 32;

const readJson = (path: string): unknown => JSON.parse(readFileSync(join(projectRoot, path), 'utf8'));

const layout = readJson('assets-src/maps/base-layout.json') as MapLayout;
const registry = registrySchema.parse(readJson('assets-src/registry.json'));

type Side = TilesetMeta[number]['corners']['NW'];

interface MapTileset {
  name: string;
  file: string;
  sides: Partial<Record<Terrain, Side>>;
  firstGid: number;
  columns: number;
  rows: number;
  tiles: TilesetMeta;
}

/** ทุกชุดต่อกันผ่านหญ้าปกติ ป่าทึบใช้ภาพหญ้าเข้มแต่เดินไม่ได้ */
const tilesets: MapTileset[] = [];
const addTileset = (name: string, sides: MapTileset['sides']): void => {
  const entry = registry[name];
  if (entry?.type !== 'tileset' && entry?.type !== 'local_tileset') throw new Error(`${name} is not a tileset`);
  const png = PNG.sync.read(readFileSync(join(projectRoot, 'public/assets', entry.file)));
  const previous = tilesets.at(-1);
  tilesets.push({
    name,
    file: entry.file,
    sides,
    firstGid: previous ? previous.firstGid + previous.columns * previous.rows : 1,
    columns: png.width / TILE_SIZE,
    rows: png.height / TILE_SIZE,
    tiles: tilesetMetaSchema.parse(readJson(entry.metaFile)),
  });
};
addTileset('ground_grass_dirt', { grass: 'upper', dirt: 'lower' });
addTileset('ground_grass_dark', { grass: 'lower', dark: 'upper', forest: 'upper' });
addTileset('ground_water', { grass: 'upper', water: 'lower' });
addTileset('cliff_tall', { grass: 'lower', upper: 'upper', wall: 'transition' });
addTileset('ground_farm_soil', { grass: 'lower', soil: 'upper' });

function gidFor(corners: TileCorners, x: number, y: number): number {
  const terrains: Terrain[] = Object.values(corners);
  const tileset = tilesets.find((candidate) => terrains.every((terrain) => candidate.sides[terrain]));
  if (!tileset) {
    throw new Error(`${[...new Set(terrains)].join(' and ')} touch at tile ${x},${y}; keep plain grass between them`);
  }
  const side = (terrain: Terrain): Side => tileset.sides[terrain] as Side;
  const matches = tileset.tiles.filter(
    ({ corners: c }) =>
      c.NW === side(corners.NW) && c.NE === side(corners.NE) && c.SW === side(corners.SW) && c.SE === side(corners.SE),
  );
  // บางมุมมีสองแบบ แบบที่ไม่ได้ระบุเพื่อนบ้านคือแบบทั่วไป
  const tile = matches.find((match) => !match.hinted) ?? matches[0];
  if (!tile) throw new Error(`no tile matches ${JSON.stringify(corners)} in ${tileset.name}`);
  return tileset.firstGid + tile.index;
}

const corners = buildCorners(layout);
const ground: number[] = [];
for (let y = 0; y < layout.heightTiles; y += 1) {
  for (let x = 0; x < layout.widthTiles; x += 1) {
    ground.push(gidFor(tileCorners(corners, x, y), x, y));
  }
}

const toPixels = (tile: number): number => Math.round(tile * TILE_SIZE);
const rectToPixels = (rect: Rect): Rect => ({
  x: toPixels(rect.x),
  y: toPixels(rect.y),
  width: toPixels(rect.width),
  height: toPixels(rect.height),
});

const clearAreas = [...layout.openings, ...layout.walkableOverWater].map(rectToPixels);
const collision: Rect[] = [...blockedRects(corners, TILE_SIZE, clearAreas), ...layout.blockers.map(rectToPixels)];

interface PointObject {
  name: string;
  x: number;
  y: number;
  properties?: { name: string; type: string; value: number | boolean }[];
}

const objects: PointObject[] = layout.objects.map((object) => {
  const entry = registry[object.id];
  if (!entry || entry.type === 'not_used') throw new Error(`layout uses ${object.id}, which is not usable`);
  if (entry.type === 'local' && entry.lazy) throw new Error(`layout uses ${object.id}, which does not load at boot`);
  const x = toPixels(object.x);
  const y = toPixels(object.y);
  const footprint = layout.footprints[object.id];
  if (footprint) collision.push(footprintRect(footprint, x, y));
  const properties: NonNullable<PointObject['properties']> = [];
  if (layout.flat.includes(object.id)) properties.push({ name: 'flat', type: 'bool', value: true });
  if (object.submerged) properties.push({ name: 'submerged', type: 'float', value: object.submerged });
  if (object.plot !== undefined) properties.push({ name: 'plot', type: 'int', value: object.plot });
  return { name: object.id, x, y, ...(properties.length > 0 ? { properties } : {}) };
});

const spawns: PointObject[] = Object.entries(layout.spawns).map(([name, point]) => ({
  name,
  x: toPixels(point.x),
  y: toPixels(point.y),
}));

/** ดอกไม้แบน: ความหนาแน่นนับต่อหนึ่งจอ โรยเฉพาะช่องที่เป็นหญ้าล้วน */
function scatterFlowers(): PointObject[] {
  const { seed, screenTiles, smallPerScreen, bigPerScreen, minSpacing, stoneClearance, keepOut } = layout.flowers;
  const rng = createRng(seed);
  const pick = <T>(list: T[]): T => list[Math.floor(rng.between(0, list.length))] as T;
  const smallIds = Object.keys(registry).filter((id) => /^petal_\d+$/.test(id));
  const bigIds = Object.keys(registry).filter((id) => /^petal_big_\d+$/.test(id));
  const stones = layout.objects.filter((object) => object.id.startsWith('path_stone'));

  const open: { x: number; y: number }[] = [];
  for (let y = 0; y < layout.heightTiles; y += 1) {
    for (let x = 0; x < layout.widthTiles; x += 1) {
      const terrains = Object.values(tileCorners(corners, x, y));
      const onGrass = terrains.every((terrain) => terrain === 'grass' || terrain === 'dark');
      if (onGrass) open.push({ x, y });
    }
  }

  const placed: PointObject[] = [];
  const canPlace = (x: number, y: number): boolean =>
    !keepOut.some(
      (area) =>
        x >= toPixels(area.x) &&
        x < toPixels(area.x + area.width) &&
        y >= toPixels(area.y) &&
        y < toPixels(area.y + area.height),
    ) &&
    !stones.some((stone) => Math.hypot(toPixels(stone.x) - x, toPixels(stone.y) - y) < stoneClearance) &&
    !placed.some((flower) => Math.hypot(flower.x - x, flower.y - y) < minSpacing);

  const sprinkle = (ids: string[], count: number): void => {
    for (let index = 0, attempts = 0; index < count && attempts < count * 40; attempts += 1) {
      const tile = pick(open);
      const x = Math.floor((tile.x + rng.between(0, 1)) * TILE_SIZE);
      const y = Math.floor((tile.y + rng.between(0, 1)) * TILE_SIZE);
      if (!canPlace(x, y)) continue;
      placed.push({ name: pick(ids), x, y });
      index += 1;
    }
  };
  const screens = open.length / screenTiles;
  sprinkle(bigIds, Math.round(bigPerScreen * screens));
  sprinkle(smallIds, Math.round(smallPerScreen * screens));
  return placed;
}

const flowers = scatterFlowers();

let nextObjectId = 1;
const rectObject = (name: string, rect: Rect): object => ({
  id: nextObjectId++,
  name,
  type: '',
  rotation: 0,
  visible: true,
  ...rect,
});
const rectObjects = collision.map((rect) => rectObject('', rect));
const pointObject = (point: PointObject): object => ({
  id: nextObjectId++,
  type: '',
  rotation: 0,
  visible: true,
  point: true,
  width: 0,
  height: 0,
  ...point,
});
const pointObjects = objects.map(pointObject);
const flowerObjects = flowers.map(pointObject);
const spawnObjects = spawns.map(pointObject);
const effects = layout.effects.map((effect) => ({
  name: effect.name,
  x: toPixels(effect.x) - effect.width / 2,
  y: toPixels(effect.y) - effect.height / 2,
  width: effect.width,
  height: effect.height,
}));
const effectObjects = effects.map(({ name, ...rect }) => rectObject(name, rect));

const objectGroup = (id: number, name: string, list: object[]): object => ({
  id,
  name,
  type: 'objectgroup',
  draworder: 'topdown',
  opacity: 1,
  visible: true,
  x: 0,
  y: 0,
  objects: list,
});

const tiledJson = {
  type: 'map',
  version: '1.10',
  tiledversion: '1.11.0',
  orientation: 'orthogonal',
  renderorder: 'right-down',
  infinite: false,
  compressionlevel: -1,
  width: layout.widthTiles,
  height: layout.heightTiles,
  tilewidth: TILE_SIZE,
  tileheight: TILE_SIZE,
  nextlayerid: 7,
  nextobjectid: nextObjectId,
  layers: [
    {
      id: 1,
      name: 'ground',
      type: 'tilelayer',
      width: layout.widthTiles,
      height: layout.heightTiles,
      opacity: 1,
      visible: true,
      x: 0,
      y: 0,
      data: ground,
    },
    objectGroup(2, 'collision', rectObjects),
    objectGroup(3, 'objects', pointObjects),
    objectGroup(4, 'flowers', flowerObjects),
    objectGroup(5, 'effects', effectObjects),
    objectGroup(6, 'spawns', spawnObjects),
  ],
  tilesets: tilesets.map((tileset) => ({
    firstgid: tileset.firstGid,
    name: tileset.name,
    image: `../${tileset.file}`,
    imagewidth: TILE_SIZE * tileset.columns,
    imageheight: TILE_SIZE * tileset.rows,
    tilewidth: TILE_SIZE,
    tileheight: TILE_SIZE,
    tilecount: tileset.columns * tileset.rows,
    columns: tileset.columns,
    margin: 0,
    spacing: 0,
  })),
};
writeFileSync(join(projectRoot, 'public/assets/maps/base.json'), `${JSON.stringify(tiledJson)}\n`);

function tmxObjects(list: (Partial<PointObject> & { x: number; y: number; width?: number; height?: number })[]): string {
  return list
    .map((object, index) => {
      const size = object.width ? ` width="${object.width}" height="${object.height}"` : '';
      const name = object.name ? ` name="${object.name}"` : '';
      const properties = object.properties
        ? `<properties>${object.properties
            .map((property) => `<property name="${property.name}" type="${property.type}" value="${property.value}"/>`)
            .join('')}</properties>`
        : '';
      const point = object.width ? '' : '<point/>';
      const body = properties + point;
      return `  <object id="${index + 1}"${name} x="${object.x}" y="${object.y}"${size}${body ? `>${body}</object>` : '/>'}`;
    })
    .join('\n');
}

const csv: string[] = [];
for (let y = 0; y < layout.heightTiles; y += 1) {
  csv.push(ground.slice(y * layout.widthTiles, (y + 1) * layout.widthTiles).join(','));
}

const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.11.0" orientation="orthogonal" renderorder="right-down" width="${layout.widthTiles}" height="${layout.heightTiles}" tilewidth="${TILE_SIZE}" tileheight="${TILE_SIZE}" infinite="0" nextlayerid="7" nextobjectid="${nextObjectId}">
${tilesets
  .map(
    (tileset) => ` <tileset firstgid="${tileset.firstGid}" name="${tileset.name}" tilewidth="${TILE_SIZE}" tileheight="${TILE_SIZE}" tilecount="${tileset.columns * tileset.rows}" columns="${tileset.columns}">
  <image source="../../public/assets/${tileset.file}" width="${TILE_SIZE * tileset.columns}" height="${TILE_SIZE * tileset.rows}"/>
 </tileset>`,
  )
  .join('\n')}
 <layer id="1" name="ground" width="${layout.widthTiles}" height="${layout.heightTiles}">
  <data encoding="csv">
${csv.join(',\n')}
</data>
 </layer>
 <objectgroup id="2" name="collision">
${tmxObjects(collision)}
 </objectgroup>
 <objectgroup id="3" name="objects">
${tmxObjects(objects)}
 </objectgroup>
 <objectgroup id="4" name="flowers">
${tmxObjects(flowers)}
 </objectgroup>
 <objectgroup id="5" name="effects">
${tmxObjects(effects)}
 </objectgroup>
 <objectgroup id="6" name="spawns">
${tmxObjects(spawns)}
 </objectgroup>
</map>
`;
writeFileSync(join(projectRoot, 'assets-src/maps/base.tmx'), tmx);

console.log(
  `base map: ${ground.length} tiles, ${collision.length} collision boxes, ${objects.length} objects, ${flowers.length} flowers`,
);
