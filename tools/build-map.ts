import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tilesetMetaSchema, type TilesetMeta } from '../src/data/schema';
import { projectRoot } from './checks';
import {
  buildCorners,
  footprintRect,
  tileCorners,
  waterRects,
  type MapLayout,
  type Rect,
  type Terrain,
  type TileCorners,
} from './map-layout';

const TILE_SIZE = 32;
const SHEET_TILES = 16;
const SHEET_COLUMNS = 4;

const readJson = (path: string): unknown => JSON.parse(readFileSync(join(projectRoot, path), 'utf8'));

const layout = readJson('assets-src/maps/base-layout.json') as MapLayout;

interface MapTileset {
  name: string;
  lower: Terrain;
  firstGid: number;
  tiles: TilesetMeta;
}

const tilesets: MapTileset[] = [
  { name: 'tiles_grass_dirt', lower: 'dirt', firstGid: 1, tiles: [] },
  { name: 'tiles_grass_water', lower: 'water', firstGid: 1 + SHEET_TILES, tiles: [] },
];
for (const tileset of tilesets) {
  tileset.tiles = tilesetMetaSchema.parse(readJson(`assets-src/tiles/${tileset.name}.meta.json`));
}

function gidFor(corners: TileCorners, x: number, y: number): number {
  const terrains = new Set(Object.values(corners));
  if (terrains.has('dirt') && terrains.has('water')) {
    throw new Error(`dirt and water touch at tile ${x},${y}; keep a row of grass between them`);
  }
  const tileset = terrains.has('water') ? tilesets[1] : tilesets[0];
  if (!tileset) throw new Error('missing tileset');

  const side = (terrain: Terrain): 'lower' | 'upper' => (terrain === 'grass' ? 'upper' : 'lower');
  const tile = tileset.tiles.find(
    ({ corners: c }) =>
      c.NW === side(corners.NW) && c.NE === side(corners.NE) && c.SW === side(corners.SW) && c.SE === side(corners.SE),
  );
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
const collision: Rect[] = [...waterRects(corners, TILE_SIZE)];
const objects = layout.objects.map((object) => {
  const x = toPixels(object.x);
  const y = toPixels(object.y);
  const footprint = layout.footprints[object.id];
  if (footprint) collision.push(footprintRect(footprint, x, y));
  return { name: object.id, x, y };
});
const spawns = Object.entries(layout.spawns).map(([name, point]) => ({
  name,
  x: toPixels(point.x),
  y: toPixels(point.y),
}));

let nextObjectId = 1;
const rectObjects = collision.map((rect) => ({
  id: nextObjectId++,
  name: '',
  type: '',
  rotation: 0,
  visible: true,
  ...rect,
}));
const pointObject = (point: { name: string; x: number; y: number }): object => ({
  id: nextObjectId++,
  name: point.name,
  type: '',
  rotation: 0,
  visible: true,
  point: true,
  width: 0,
  height: 0,
  x: point.x,
  y: point.y,
});
const pointObjects = objects.map(pointObject);
const spawnObjects = spawns.map(pointObject);

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
  nextlayerid: 5,
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
    objectGroup(4, 'spawns', spawnObjects),
  ],
  tilesets: tilesets.map((tileset) => ({
    firstgid: tileset.firstGid,
    name: tileset.name,
    image: `../tiles/${tileset.name}.png`,
    imagewidth: TILE_SIZE * SHEET_COLUMNS,
    imageheight: TILE_SIZE * SHEET_COLUMNS,
    tilewidth: TILE_SIZE,
    tileheight: TILE_SIZE,
    tilecount: SHEET_TILES,
    columns: SHEET_COLUMNS,
    margin: 0,
    spacing: 0,
  })),
};
writeFileSync(join(projectRoot, 'public/assets/maps/base.json'), `${JSON.stringify(tiledJson)}\n`);

function tmxObjects(list: { x: number; y: number; name?: string; width?: number; height?: number }[]): string {
  return list
    .map((object, index) => {
      const size = object.width ? ` width="${object.width}" height="${object.height}"` : '';
      const name = object.name ? ` name="${object.name}"` : '';
      const point = object.width ? '/>' : '><point/></object>';
      return `  <object id="${index + 1}"${name} x="${object.x}" y="${object.y}"${size}${point}`;
    })
    .join('\n');
}

const csv: string[] = [];
for (let y = 0; y < layout.heightTiles; y += 1) {
  csv.push(ground.slice(y * layout.widthTiles, (y + 1) * layout.widthTiles).join(','));
}

const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.11.0" orientation="orthogonal" renderorder="right-down" width="${layout.widthTiles}" height="${layout.heightTiles}" tilewidth="${TILE_SIZE}" tileheight="${TILE_SIZE}" infinite="0" nextlayerid="5" nextobjectid="${nextObjectId}">
${tilesets
  .map(
    (tileset) => ` <tileset firstgid="${tileset.firstGid}" name="${tileset.name}" tilewidth="${TILE_SIZE}" tileheight="${TILE_SIZE}" tilecount="${SHEET_TILES}" columns="${SHEET_COLUMNS}">
  <image source="../../public/assets/tiles/${tileset.name}.png" width="${TILE_SIZE * SHEET_COLUMNS}" height="${TILE_SIZE * SHEET_COLUMNS}"/>
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
 <objectgroup id="4" name="spawns">
${tmxObjects(spawns)}
 </objectgroup>
</map>
`;
writeFileSync(join(projectRoot, 'assets-src/maps/base.tmx'), tmx);

console.log(`base map: ${ground.length} tiles, ${collision.length} collision boxes, ${objects.length} objects`);
