import { registry } from '../core/assets';
import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState } from '../core/state';
import balance from '../data/balance.json';
import type { Recipe } from '../data/schema';
import { parseDish, plainDish, recipes } from '../systems/cooking';
import { decorateDishes, toppingBlock, toppingStock, toppingTable, type ToppingBlock } from '../systems/toppings';
import { bagArtId, itemName } from './inventory';
import { sizedArt } from './pixelArt';
import { revealWhenReady } from './preload';

/**
 * หน้าแต่งจาน (งานอาหารโซน 1 ขั้นที่ 3 · ภาพตัวอย่าง art-src/cook_ui_1108/decorate_mock_v2.png)
 * อาหารออกจากกองไฟแล้วเด้งหน้านี้ แตะท็อปปิ้งหนึ่งครั้ง ร่วงลงจาน 1 ชิ้น ทุกจานที่ทำพร้อมกันได้ชิ้นเดียวกัน ใช้ของจานละ 1 ชิ้น
 * ของถูกหยิบตอนกด "เสร็จแล้ว" เท่านั้น ข้ามหรือปิดคือไม่แต่ง · ขนาดเป็นพิกเซลภาพตัวอย่าง ย่อขยายด้วย --pz เหมือนหน้าต่างทำอาหาร
 */
const WINDOW = 'decorate';
/** จุดภาพตัวอย่างต่อพิกเซลภาพบนจาน (จานขยาย 2 เท่าของ --px) */
const DISH_UNIT = 6;
const MAX_STARS = 3;
const BLOCK_TEXT: Record<ToppingBlock, TextKey> = {
  full: 'decorate.full',
  soupOnly: 'decorate.soup_only',
  oneSpoon: 'decorate.one_spoon',
  notEnough: 'decorate.not_enough',
};
/** ละอองผงสีทองตอนโรย (ภาพตัวอย่าง drop3_gif_v2) */
const SPECK_COLORS = ['#fae296', '#e8bc68', '#fff2c4'];
const SPECKS = 8;
/** ชื่อท็อปปิ้งยาวกว่านี้ใช้ตัวหนังสือเล็กลงให้พอดีการ์ด */
const LONG_NAME = 9;
const SPECK_SPREAD = 6;
const SPLASH = [
  [-2, 6],
  [-3, 5],
  [9, 6],
  [10, 5],
];
const SPLASH_MS = 220;
/** ประกายนิ่ง 1 ดวงต่อการโรยผง เยื้องจากกลางภาพผง (พิกเซลภาพ) */
const SPARKLE_OFFSET = { x: 4, y: -2 };

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

// ---------- ประกายผงนัวกะพริบวน (umami_twinkle_1109.gif) วาดด้วยกล่องพิกเซล ----------
const GOLD_LIGHT = '#fff0b4';
const shapePixels = (shape: string): [number, number, string][] => {
  const twinkle = balance.toppings.twinkle;
  const [ax, ay] = twinkle.at;
  switch (shape) {
    case 'dot':
      return [[0, 0, GOLD_LIGHT]];
    case 'plus':
      return [[0, 0, '#ffffff'], [1, 0, GOLD_LIGHT], [-1, 0, GOLD_LIGHT], [0, 1, GOLD_LIGHT], [0, -1, GOLD_LIGHT]];
    case 'big':
      return [
        [0, 0, '#ffffff'],
        [1, 0, GOLD_LIGHT],
        [-1, 0, GOLD_LIGHT],
        [0, 1, GOLD_LIGHT],
        [0, -1, GOLD_LIGHT],
        [2, 0, GOLD_LIGHT],
        [-2, 0, GOLD_LIGHT],
        [0, 2, GOLD_LIGHT],
        [0, -2, GOLD_LIGHT],
      ];
    case 'glintLeft':
      return [[twinkle.glints[0][0] - ax, twinkle.glints[0][1] - ay, '#ffffff']];
    case 'glintRight':
      return [[twinkle.glints[1][0] - ax, twinkle.glints[1][1] - ay, '#ffffff']];
    default:
      return [];
  }
};

/** box-shadow ของรูปประกาย แต่ละจุดกว้าง 1 พิกเซลภาพบนจาน */
const sparkleShadow = (shape: string): string => {
  const pixels = shapePixels(shape);
  return pixels.length === 0 ? 'none' : pixels.map(([x, y, color]) => `${x * DISH_UNIT}px ${y * DISH_UNIT}px 0 ${color}`).join(', ');
};

let twinkleStyleAdded = false;
/** สร้าง keyframes ของประกายผงนัวจากเวลาเฟรมในข้อมูลครั้งเดียว */
function ensureTwinkleStyle(): void {
  if (twinkleStyleAdded) return;
  twinkleStyleAdded = true;
  const frames = balance.toppings.twinkle.frames;
  const total = frames.reduce((sum, frame) => sum + frame.ms, 0);
  let at = 0;
  const steps = frames.map((frame) => {
    const percent = ((at / total) * 100).toFixed(3);
    at += frame.ms;
    return `${percent}% { box-shadow: ${sparkleShadow(frame.shape)}; }`;
  });
  const style = document.createElement('style');
  style.textContent = `@keyframes dk-twinkle { ${steps.join(' ')} 100% { box-shadow: ${sparkleShadow(frames[frames.length - 1]!.shape)}; } }
.dk-twinkle { animation: dk-twinkle ${total}ms steps(1, end) infinite; }`;
  document.head.append(style);
}

const spotsFor = (recipe: Recipe): number[][] => (recipe.category === 'drink' ? balance.toppings.spots.drink : balance.toppings.spots.food);

/** ภาพท็อปปิ้งชิ้นที่ index บนจาน 48 พิกเซล วางกลางที่จุดของชิ้นนั้น (ขนาดจริง × 2 เท่ากับจาน) */
function pieceArt(recipe: Recipe, topping: string, index: number): HTMLElement | null {
  const info = toppingTable[topping];
  const entry = info ? registry[info.art] : undefined;
  if (!info || entry?.type !== 'local') return null;
  const spots = spotsFor(recipe);
  const [cx, cy] = spots[index % spots.length]!;
  const piece = sizedArt(info.art, `dk-piece dk-piece--${info.kind}`, '--dpx');
  piece.dataset.piece = topping;
  piece.style.left = `${(cx! - Math.floor(entry.width / 2)) * DISH_UNIT}px`;
  piece.style.top = `${(cy! - Math.floor(entry.height / 2)) * DISH_UNIT}px`;
  return piece;
}

/** ประกายของผง: ผงนัวกะพริบวนค้าง ผงอื่นประกายนิ่ง */
function powderSparkle(recipe: Recipe, topping: string, index: number): HTMLElement | null {
  const info = toppingTable[topping];
  if (!info || info.kind !== 'powder') return null;
  const spots = spotsFor(recipe);
  const [cx, cy] = spots[index % spots.length]!;
  const sparkle = element('i', 'dk-sparkle');
  if (info.twinkle) {
    ensureTwinkleStyle();
    const [ax, ay] = balance.toppings.twinkle.at;
    sparkle.classList.add('dk-twinkle');
    sparkle.style.left = `${(cx! + ax) * DISH_UNIT}px`;
    sparkle.style.top = `${(cy! + ay) * DISH_UNIT}px`;
  } else {
    sparkle.style.boxShadow = sparkleShadow('plus');
    sparkle.style.left = `${(cx! + SPARKLE_OFFSET.x) * DISH_UNIT}px`;
    sparkle.style.top = `${(cy! + SPARKLE_OFFSET.y) * DISH_UNIT}px`;
  }
  return sparkle;
}

/** ร่วงลงจากด้านบนทีละพิกเซลภาพ เด้งขึ้น 1 พิกเซลแล้วลงที่เดิม (ไม่ย่อขยายภาพ) */
function dropIn(node: HTMLElement): void {
  const { dropMs, dropPx } = balance.toppings;
  const path = [-dropPx, -Math.round(dropPx * 0.7), -Math.round(dropPx * 0.4), -Math.round(dropPx * 0.15), 0, -1, 0];
  node.animate(
    path.map((y, index) => ({ transform: `translateY(${y * DISH_UNIT}px)`, offset: index / (path.length - 1), easing: 'steps(1, end)' })),
    { duration: dropMs, fill: 'backwards' },
  );
}

/** หน้าต่างแต่งจาน นาฬิกาเกมหยุดระหว่างเปิด */
export function createDecorateWindow(uiRoot: HTMLElement): void {
  const backdrop = document.createElement('div');
  backdrop.id = 'decorate-window';
  backdrop.hidden = true;
  const panel = element('div', 'ck dk');
  const title = element('h2', 'dk-title', t('decorate.title'));
  const dishName = element('span', 'dk-name');
  const close = element('button', 'ck-button ck-close', '×');
  close.id = 'decorate-close';
  close.type = 'button';
  close.setAttribute('aria-label', t('decorate.skip'));
  const stage = element('div', 'dk-stage');
  const shadow = element('i', 'dk-shadow');
  const plate = element('div', 'dk-dish');
  plate.id = 'decorate-dish';
  const stars = element('div', 'dk-stars');
  // ตัวเลขเล็ก "n/3" ใต้ดาวแทนขวดความเยอะ (ผู้ใช้ตัดสิน 9 พ.ย. 2026 02:44)
  const counter = element('b', 'dk-counter');
  counter.id = 'decorate-count';
  stage.append(shadow, plate, stars, counter);
  const tray = element('div', 'dk-tray');
  const trayHint = element('p', 'dk-tray__hint', t('decorate.hint'));
  const list = element('div', 'dk-list');
  tray.append(trayHint, list);
  const skip = element('button', 'ck-button dk-skip', t('decorate.skip'));
  skip.id = 'decorate-skip';
  skip.type = 'button';
  const done = element('button', 'ck-go dk-done', t('decorate.done'));
  done.id = 'decorate-done';
  done.type = 'button';
  panel.append(title, dishName, close, stage, tray, skip, done);
  backdrop.append(panel);
  uiRoot.append(backdrop);

  let item = '';
  let count = 1;
  let recipe: Recipe | null = null;
  let placed: string[] = [];

  const hide = (): void => {
    backdrop.hidden = true;
    gameState.setWindowOpen(WINDOW, false);
  };

  /** นับทุกชิ้นบนจาน รวมชิ้นผิดประเภท ครบแล้วท็อปปิ้งที่เหลือเป็นสีเทา */
  const renderCount = (): void => {
    const { maxPieces } = balance.toppings;
    counter.textContent = `${placed.length}/${maxPieces}`;
    counter.classList.toggle('is-full', placed.length >= maxPieces);
  };

  const toppingCard = (topping: string): HTMLElement => {
    const info = toppingTable[topping]!;
    const { bag } = gameState.world;
    const block = recipe ? toppingBlock(bag, recipe, placed, topping, count) : 'notEnough';
    // ไม่บอกว่าท็อปปิ้งไหนผิดประเภททุกทาง (ไม่มีหน้าจะอ้วก สีชมพู ข้อความ หรือการเรียงเอาที่เข้ากันขึ้นก่อน) ผู้เล่นรู้เองตอนมอนสเตอร์กิน (ข้อ A3)
    // การ์ดสีเทาเหลือแค่เรื่องจำนวน (ของไม่พอ หรือใส่ครบ 3 ชิ้นแล้ว)
    const card = element('button', `dk-card${block ? ' is-blocked' : ''}`);
    card.type = 'button';
    card.dataset.topping = topping;
    card.disabled = block !== null;
    const left = toppingStock(bag, topping) - placed.filter((id) => id === topping).length * count;
    const art = bagArtId(info.item);
    if (art && registry[art]?.type === 'local') card.append(sizedArt(art, 'dk-card__art', '--px2'));
    else card.append(element('i', 'dk-card__art dk-card__art--none'));
    const name = itemName(info.item);
    const label = element('span', 'dk-card__name', `${name} ×${Math.max(0, left)}`);
    if (name.length > LONG_NAME) label.dataset.size = 's';
    card.append(label);
    if (block) {
      card.append(element('small', 'dk-card__block', t(BLOCK_TEXT[block])));
      card.dataset.block = block;
    }
    card.setAttribute('aria-label', `${name} ${block ? t(BLOCK_TEXT[block]) : ''}`.trim());
    card.addEventListener('click', () => addPiece(topping));
    return card;
  };

  const renderTray = (): void => {
    const { bag } = gameState.world;
    // เรียงตามลำดับในกระเป๋า ไม่เอาที่เข้ากับเมนูขึ้นก่อน (ข้อ A3)
    const bagOrder = (id: string): number => bag.findIndex((stack) => stack.item === toppingTable[id]!.item);
    const owned = Object.keys(toppingTable)
      .filter((id) => toppingStock(bag, id) > 0)
      .sort((a, b) => bagOrder(a) - bagOrder(b));
    list.replaceChildren(...owned.map(toppingCard));
    if (owned.length === 0) list.append(element('p', 'dk-empty', t('decorate.none')));
  };

  function addPiece(topping: string): void {
    if (!recipe || toppingBlock(gameState.world.bag, recipe, placed, topping, count)) return;
    const index = placed.length;
    placed = [...placed, topping];
    const piece = pieceArt(recipe, topping, index);
    const info = toppingTable[topping]!;
    if (piece) {
      plate.append(piece);
      dropIn(piece);
      if (info.kind === 'powder') puff(piece);
      if (info.kind === 'ball' && recipe.soup) window.setTimeout(() => splash(piece), balance.toppings.dropMs);
    }
    const sparkle = powderSparkle(recipe, topping, index);
    if (sparkle) {
      sparkle.style.visibility = 'hidden';
      plate.append(sparkle);
      window.setTimeout(() => (sparkle.style.visibility = ''), balance.toppings.dropMs);
    }
    renderCount();
    renderTray();
  }

  /** ผงฟุ้งเป็นละอองลงมาพร้อมภาพผง */
  const puff = (piece: HTMLElement): void => {
    const left = parseFloat(piece.style.left);
    const top = parseFloat(piece.style.top);
    for (let index = 0; index < SPECKS; index += 1) {
      const speck = element('i', 'dk-speck');
      speck.style.background = SPECK_COLORS[index % SPECK_COLORS.length]!;
      const dx = ((index * 5) % (SPECK_SPREAD * 2 + 1)) - SPECK_SPREAD + 6;
      speck.style.left = `${left + dx * DISH_UNIT}px`;
      speck.style.top = `${top + (index % 3) * DISH_UNIT}px`;
      plate.append(speck);
      const animation = speck.animate(
        [
          { transform: `translateY(${-balance.toppings.dropPx * DISH_UNIT}px)`, opacity: 1 },
          { transform: 'translateY(0)', opacity: 1, offset: 0.8 },
          { transform: 'translateY(0)', opacity: 0 },
        ],
        { duration: balance.toppings.dropMs + index * 20, easing: 'steps(5, end)' },
      );
      animation.onfinish = () => speck.remove();
    }
  };

  /** ลูกชิ้นตกลงซุปมีน้ำกระเซ็นสองข้าง */
  const splash = (piece: HTMLElement): void => {
    const left = parseFloat(piece.style.left);
    const top = parseFloat(piece.style.top);
    for (const [dx, dy] of SPLASH) {
      const drop = element('i', 'dk-speck dk-speck--splash');
      drop.style.left = `${left + dx! * DISH_UNIT}px`;
      drop.style.top = `${top + dy! * DISH_UNIT}px`;
      plate.append(drop);
      window.setTimeout(() => drop.remove(), SPLASH_MS);
    }
  };

  const renderDish = (stars: number): void => {
    if (!recipe) return;
    plate.replaceChildren();
    if (recipe.icon && registry[recipe.icon]?.type === 'local') plate.append(sizedArt(recipe.icon, 'dk-dish__art', '--dpx'));
    renderStars(stars);
  };

  const renderStars = (dishStars: number): void => {
    stars.replaceChildren();
    stars.dataset.stars = String(dishStars);
    for (let index = 0; index < MAX_STARS; index += 1) stars.append(sizedArt(index < dishStars ? 'ui_book_book_star_on' : 'ui_book_book_star_off', 'dk-star', '--dpx'));
  };

  const finish = (): void => {
    if (placed.length === 0) {
      hide();
      return;
    }
    const next = decorateDishes(gameState.world, item, count, placed);
    if (!next) {
      eventBus.emit('player-says', 'bagFull');
      return;
    }
    gameState.setWorld(next);
    hide();
  };

  close.addEventListener('click', hide);
  skip.addEventListener('click', hide);
  done.addEventListener('click', finish);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !backdrop.hidden) hide();
  });
  eventBus.on('decorate-open', (request) => {
    const { recipe: id, stars: dishStars } = parseDish(request.item);
    const found = recipes[id];
    if (!found) return;
    item = plainDish(request.item);
    count = Math.max(1, request.count);
    recipe = found;
    placed = [];
    dishName.textContent = `· ${t(`dish.${id}.name` as TextKey)}${count > 1 ? ` ×${count}` : ''}`;
    renderDish(dishStars);
    renderCount();
    renderTray();
    backdrop.hidden = false;
    revealWhenReady(backdrop);
    gameState.setWindowOpen(WINDOW, true);
  });
}

