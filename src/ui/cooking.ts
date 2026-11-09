import { registry } from '../core/assets';
import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { createRng } from '../core/rng';
import { gameState } from '../core/state';
import balance from '../data/balance.json';
import type { Recipe } from '../data/schema';
import {
  baseDishStars,
  batchIngredients,
  batchMinutes,
  canCook,
  canUseCampfire,
  cookMethodOf,
  hasCupFor,
  haveFor,
  maxBatch,
  pickedStars,
  recipes,
  startCooking,
  stockFitting,
  type StarPicks,
} from '../systems/cooking';
import { carriesStars, starLevels } from '../systems/stars';
import { itemName, starBadge } from './inventory';
import { sizedArt } from './pixelArt';
import { revealWhenReady } from './preload';
import { createSetArranger } from './setArrange';
import { TRAY_SIZES, isSet, setTable } from '../systems/sets';
import { hadWovenTray } from '../systems/crafting';

/**
 * หน้าต่างทำอาหาร K2 "หม้อกลางกองไฟ" (docs/cook_ui_k2_2026-11-08.md ภาพตัวอย่าง art-src/cook_ui_1108/k2_mock_v3.png)
 * ทุกขนาดเป็นพิกเซลของภาพตัวอย่าง (จอ 2796×1290) แล้วย่อขยายทั้งก้อนด้วย --pz เหมือนโทรศัพท์ · ตำแหน่งส่วนใหญ่อยู่ใน cooking.css
 */
const WINDOW = 'cooking';
type Tab = Recipe['category'] | 'set';
/** แท็บที่ 4 "จัดชุด" แทนแท็บทดลองผสมที่เอาออก (งานอาหารโซน 1 ขั้นที่ 6 ระบบอยู่ใน setArrange.ts) */
const TABS: { id: Tab; label: TextKey }[] = [
  { id: 'savory', label: 'recipe.tab_savory' },
  { id: 'sweet', label: 'recipe.tab_sweet' },
  { id: 'drink', label: 'recipe.tab_drink' },
  { id: 'set', label: 'set.tab' },
];

const hasWovenTray = (): boolean => {
  const trays = TRAY_SIZES.map((size) => setTable.trays[size].item);
  return gameState.world.bag.some((stack) => trays.includes(stack.item));
};

/**
 * แท็บเครื่องดื่มต้องมีแก้วไม้ไผ่ (อยู่ในกระเป๋าตลอดเมื่อทำแล้ว)
 * แท็บจัดชุดขึ้นเมื่อเคยมีถาดสาน (หรือมีชุดในกระเป๋า หรือเคยจัดชุดลับแล้ว) ก่อนนั้นไม่แสดงเลย (ข้อ A11)
 */
function tabUnlocked(id: Tab): boolean {
  const world = gameState.world;
  if (id === 'drink') return world.bag.some((stack) => stack.item === balance.cooking.drinkNeeds);
  if (id === 'set') return hadWovenTray(world) || hasWovenTray() || world.bag.some((stack) => isSet(stack.item)) || world.sets.combos.length > 0;
  return true;
}

/** แท็บที่ขึ้นแล้วแต่ตอนนี้ใช้ไม่ได้: จัดชุดเมื่อไม่มีถาดสานเหลือในกระเป๋า เป็นสีเทา กดไม่ได้ (ผู้ใช้ตัดสิน 10 พ.ย. 2026) */
const tabUsable = (id: Tab): boolean => id !== 'set' || hasWovenTray();

/** ช่องวัตถุดิบรอบกองไฟ (พิกเซลภาพตัวอย่าง นับจากมุมซ้ายบนของฉาก) แถวละ 3 ช่อง */
const SLOT = { left: 360, top: 35, stepX: 92, stepY: 112, size: 66, perRow: 3 } as const;
/** กองไฟในฉาก ขยาย 2 เท่าของพิกเซลภาพ (6 จุดภาพตัวอย่างต่อพิกเซล) */
const FIRE = { left: 286, top: 308, scale: 2 } as const;
/** จุดที่วัตถุดิบตกลงภาชนะ นับเป็นพิกเซลภาพจากขอบบนซ้ายของภาพกองไฟ (ภาพตัวอย่าง cook_start_v2: ตกกลางกระทะ) ไอน้ำลอยจากเหนือขอบบนภาชนะ */
const LAND = { x: 20, below: 6, grillY: 11, steamAbove: 2, grillSteamY: 4 } as const;
/** จุดภาพตัวอย่างต่อพิกเซลภาพ (--px ในหน้าต่างนี้) */
const MOCK_PER_ART = 3;
/** วัตถุดิบลอยเป็นโค้งขึ้นเหนือจุดที่สูงกว่า 26 พิกเซลภาพ เหมือนภาพตัวอย่าง */
const ARC_LIFT = 26 * MOCK_PER_ART;
const ARC_STEPS = 10;
/** แก้วไม้ไผ่ข้างกองไฟในแท็บเครื่องดื่ม (ภาพตัวอย่างวาด 4 จุดต่อพิกเซล ภาพมีขอบใส ซ้าย 6 บน 12 พิกเซล) */
const CUP = { art: 'bamboo_cup_48', left: 532, top: 360, labelX: 624, labelY: 550 } as const;
/** ชื่อยาวลดขนาดตัวหนังสือตามภาพตัวอย่าง */
const NAME_LONG = 10;
/** ชื่อยาวกว่านี้ตัดเป็นสองบรรทัด */
const NAME_WRAP = 18;
const NAME_MEDIUM = 7;
const BAR_TEXT_LONG = 16;
const SUB_TEXT_LONG = 20;

interface Point {
  x: number;
  y: number;
}

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const hasArt = (id: string | null | undefined): id is string => !!id && registry[id]?.type === 'local';

export const ingredientText = (items: Record<string, number>): string =>
  Object.entries(items)
    .map(([item, count]) => (count > 1 ? `${itemName(item)} ×${count}` : itemName(item)))
    .join(' · ');

const dishName = (id: string): string => t(`dish.${id}.name` as TextKey);

/** ภาพเล็กของวัตถุดิบ กลุ่มวัตถุดิบ (ปลาชนิดไหนก็ได้ ลูกชิ้น) แสดงของที่มีในกระเป๋า ถ้ายังไม่มีใช้ภาพของกลุ่ม */
function ingredientMini(item: string): string | null {
  const owned = gameState.started ? stockFitting(gameState.world.bag, item).find((stock) => stock !== item) : undefined;
  const id = `ing_mini_${(owned ?? item).toLowerCase()}`;
  return hasArt(id) ? id : null;
}

/** หน้าต่างที่กองไฟ เลือกเมนูทางซ้าย ฉากกองไฟกับวัตถุดิบทางขวา แถบล่างเลือกจำนวนและเริ่มทำ นาฬิกาเกมหยุดระหว่างเปิด */
export function createCookingWindow(uiRoot: HTMLElement): void {
  const backdrop = document.createElement('div');
  backdrop.id = 'cook-window';
  backdrop.hidden = true;
  const panel = element('div', 'ck cook-panel');
  const tabs = element('div', 'ck-tabs');
  const close = element('button', 'ck-button ck-close', '×');
  close.id = 'cook-close';
  close.type = 'button';
  close.setAttribute('aria-label', t('ui.close'));
  const grid = element('div', 'ck-grid');
  const hint = element('p', 'ck-hint', t('cook.scroll_hint'));
  const scene = element('div', 'ck-scene');
  const bar = element('div', 'ck-bar');
  panel.append(tabs, close, grid, hint, scene, bar);
  backdrop.append(panel);
  uiRoot.append(backdrop);

  let tab: Tab = 'savory';
  let selected: string | null = null;
  /** จำนวนจานของเมนูที่เลือก กลับเป็น 1 ทุกครั้งที่เปลี่ยนเมนูหรือเปิดหน้าต่างใหม่ */
  let batch = 1;
  /** ดาวผักที่เลือกต่อวัตถุดิบ ล้างทุกครั้งที่เปลี่ยนเมนู (ค่าเริ่มคือดาวต่ำสุดที่มีพอ ผักดีจะได้ไม่ถูกใช้โดยไม่ตั้งใจ) */
  let picks: StarPicks = {};
  /** วัตถุดิบกำลังลอยลงภาชนะ กดอะไรในหน้าต่างไม่ได้จนหน้าต่างปิดเอง */
  let busy = false;
  const rng = createRng(Date.now());

  const hide = (): void => {
    if (busy) return;
    backdrop.hidden = true;
    gameState.setWindowOpen(WINDOW, false);
  };

  const knownIn = (category: Tab): string[] =>
    gameState.world.recipes.known.filter((id) => recipes[id]?.category === category && canUseCampfire(recipes[id]!));

  const recipeCard = (id: string, ready: boolean): HTMLElement => {
    const card = element('button', `ck-card${id === selected ? ' is-selected' : ''}${ready ? '' : ' is-missing'}`);
    card.type = 'button';
    card.dataset.recipe = id;
    const recipe = recipes[id]!;
    const name = dishName(id);
    card.setAttribute('aria-label', `${name} ${t(ready ? 'cook.ready' : 'cook.missing')}`);
    if (hasArt(recipe.icon)) card.append(sizedArt(recipe.icon, 'ck-card__art', '--px2'));
    else card.append(element('i', 'ck-card__art ck-card__art--none'));
    const label = element('span', 'ck-card__name', name);
    label.dataset.size = name.length > NAME_WRAP ? 'xs' : name.length > NAME_LONG ? 's' : name.length > NAME_MEDIUM ? 'm' : 'l';
    card.append(label);
    if (ready) card.append(element('i', 'ck-card__dot'));
    card.addEventListener('click', () => {
      if (busy) return;
      if (selected !== id) {
        batch = 1;
        picks = {};
      }
      selected = id;
      render();
    });
    return card;
  };

  /** ฟองความคิดของเมนูที่เลือก: ภาพอาหาร ชื่อ เวลาครั้งเดียว และภาชนะ ดาวของจานที่มุมขวาบน */
  const bubble = (id: string, recipe: Recipe): HTMLElement => {
    const box = element('div', 'ck-bubble');
    if (hasArt(recipe.icon)) box.append(sizedArt(recipe.icon, 'ck-bubble__art'));
    else box.append(element('i', 'ck-bubble__art ck-bubble__art--none'));
    const sub = element('small', 'ck-bubble__sub', `${batchMinutes(recipe, batch)} ${t('cook.minutes')} · ${t(`cook.method.${recipe.method}` as TextKey)}`);
    sub.dataset.size = (sub.textContent ?? '').length > SUB_TEXT_LONG ? 's' : 'l';
    box.append(element('b', 'ck-bubble__name', dishName(id)), sub);
    const stars = element('span', 'ck-bubble__stars');
    stars.id = 'cook-dish-stars';
    const dishStars = baseDishStars(gameState.world.bag, recipe, picks);
    stars.dataset.stars = String(dishStars);
    stars.append(starBadge(dishStars));
    box.append(stars, element('i', 'ck-bubble__tail ck-bubble__tail--big'), element('i', 'ck-bubble__tail ck-bubble__tail--small'));
    return box;
  };

  /** ช่องวัตถุดิบวงกลม ขอบเขียวของพอ แดงไม่พอ ใต้ช่องบอก มี/ต้องใช้ ผักที่มีหลายดาวแตะเพื่อเปลี่ยนดาว */
  const ingredientSlot = (recipe: Recipe, item: string, need: number, index: number): { slot: HTMLElement; choosing: boolean } => {
    const { bag } = gameState.world;
    const have = haveFor(bag, item, picks, recipe.ingredients[item]!);
    const short = have < need;
    const levels = carriesStars(item) ? starLevels(bag, item) : [];
    const choosing = levels.length > 1;
    const slot = element(choosing ? 'button' : 'span', `ck-slot cook-plate${short ? ' is-short' : ''}`);
    slot.dataset.plate = item;
    slot.style.left = `${SLOT.left + (index % SLOT.perRow) * SLOT.stepX}px`;
    slot.style.top = `${SLOT.top + Math.floor(index / SLOT.perRow) * SLOT.stepY}px`;
    slot.setAttribute('aria-label', `${itemName(item)} ${have}/${need}`);
    const ring = element('i', 'ck-slot__ring');
    const mini = ingredientMini(item);
    if (mini) ring.append(sizedArt(mini, 'ck-slot__art'));
    else ring.append(element('small', 'ck-slot__name', itemName(item)));
    slot.append(ring, element('b', 'ck-slot__count', `${have}/${need}`));
    if (carriesStars(item)) {
      // ผักมีดาว: ป้ายดาวที่ใช้อยู่มุมซ้ายล่างของวง
      const chosen = pickedStars(bag, item, recipe.ingredients[item]!, picks);
      const badge = starBadge(chosen);
      badge.classList.add('ck-slot__stars');
      ring.append(badge);
      if (choosing && slot instanceof HTMLButtonElement) {
        slot.type = 'button';
        slot.classList.add('cook-star-pick');
        slot.dataset.starPick = item;
        slot.dataset.stars = String(chosen);
        slot.setAttribute('aria-label', `${t('cook.star_pick')} ${itemName(item)} ${have}/${need}`);
        slot.addEventListener('click', () => {
          if (busy) return;
          const at = levels.findIndex((level) => level.stars === chosen);
          picks = { ...picks, [item]: levels[(at + 1) % levels.length]!.stars };
          render();
        });
      }
    }
    return { slot, choosing };
  };

  /** กองไฟเปล่า (ย่างใช้ภาพกองไฟกับตะแกรง) แสงเรืองนุ่มด้านหลัง และภาชนะตามวิธีทำวางกลางกองไฟ */
  const campfire = (id: string): { fire: HTMLElement; land: Point; steam: Point } => {
    const method = cookMethodOf(id);
    const fire = element('div', 'ck-fire');
    fire.style.left = `${FIRE.left}px`;
    fire.style.top = `${FIRE.top}px`;
    fire.append(element('i', 'ck-fire__glow'));
    const fireArt = method?.fire && hasArt(method.fire) ? method.fire : 'cook_fire_plain';
    fire.append(sizedArt(fireArt, 'ck-fire__art', '--px', FIRE.scale));
    const fireEntry = registry[fireArt];
    const fireWidth = fireEntry?.type === 'local' ? fireEntry.width : 0;
    let landY: number = LAND.grillY;
    let steamY: number = LAND.grillSteamY;
    if (method?.vessel && hasArt(method.vessel)) {
      const vessel = sizedArt(method.vessel, 'ck-fire__vessel', '--px', FIRE.scale);
      const entry = registry[method.vessel];
      const width = entry?.type === 'local' ? entry.width : 0;
      const top = method.vesselY ?? 0;
      vessel.style.left = `calc(var(--px) * ${FIRE.scale * Math.floor((fireWidth - width) / 2)})`;
      vessel.style.top = `calc(var(--px) * ${FIRE.scale * top})`;
      fire.append(vessel);
      landY = top + LAND.below;
      steamY = top - LAND.steamAbove;
    }
    const unit = MOCK_PER_ART * FIRE.scale;
    const x = FIRE.left + LAND.x * unit;
    return { fire, land: { x, y: FIRE.top + landY * unit }, steam: { x, y: FIRE.top + steamY * unit } };
  };

  /** แถบล่าง: − n + · ของที่ใช้กับเวลาครั้งเดียว (หรือของที่ขาด) · เริ่มทำ */
  const bottomBar = (recipe: Recipe, most: number, ready: boolean, onStart: () => void): HTMLElement[] => {
    const step = (text: string, label: TextKey, buttonId: string, delta: number, disabled: boolean): HTMLButtonElement => {
      const button = element('button', 'ck-button ck-step', text);
      button.id = buttonId;
      button.type = 'button';
      button.disabled = disabled;
      button.setAttribute('aria-label', t(label));
      button.addEventListener('click', () => {
        if (busy) return;
        batch = Math.min(Math.max(1, batch + delta), most);
        render();
      });
      return button;
    };
    const count = element('b', 'ck-count', String(batch));
    count.id = 'cook-count';
    const { bag } = gameState.world;
    let text: string;
    if (ready) {
      text = `${t('cook.batch_total')} ${ingredientText(batchIngredients(recipe, batch))} · ${batchMinutes(recipe, batch)} ${t('cook.minutes')}`;
    } else {
      const lacking = Object.entries(recipe.ingredients)
        .map(([item, need]) => [item, need - haveFor(bag, item, picks, need)] as const)
        .filter(([, short]) => short > 0)
        .map(([item, short]) => `${itemName(item)} ${short}`);
      if (!hasCupFor(bag, recipe)) lacking.unshift(itemName(balance.cooking.drinkNeeds));
      text = `${t('cook.lack')} ${lacking.join(' · ')}`;
    }
    const total = element('p', `ck-need${ready ? '' : ' is-short'}`, text);
    total.id = 'cook-batch-total';
    total.dataset.size = text.length > BAR_TEXT_LONG ? 's' : 'l';
    const go = element('button', 'ck-go cook-go', t('cook.start'));
    go.id = 'cook-go';
    go.type = 'button';
    go.disabled = !ready;
    go.addEventListener('click', onStart);
    return [step('−', 'cook.batch_less', 'cook-less', -1, !ready || batch <= 1), count, step('+', 'cook.batch_more', 'cook-more', 1, !ready || batch >= most), total, go];
  };

  /**
   * กดเริ่มทำ: วัตถุดิบลอยเป็นโค้งจากช่องลงภาชนะทีละชิ้น แล้วไอน้ำลอย จึงหยิบของจากกระเป๋าและปิดหน้าต่าง
   * (ตัวเอกเล่นท่าทำอาหารต่อในลาน) ผู้เล่นที่ปิดการเคลื่อนไหวในเครื่องได้ผลทันที
   */
  const startWith = (id: string, land: Point, steamAt: Point): void => {
    if (busy || !canCook(gameState.world, id, picks)) return;
    const cook = (): void => {
      busy = false;
      panel.classList.remove('is-busy');
      const next = startCooking(gameState.world, id, batch, picks, rng);
      if (!next) return;
      gameState.setWorld(next);
      hide();
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cook();
      return;
    }
    busy = true;
    panel.classList.add('is-busy');
    const { itemMs, gapMs, steamMs } = balance.cooking.float;
    const slots = [...scene.querySelectorAll<HTMLElement>('.ck-slot')];
    slots.forEach((slot, index) => {
      const art = slot.querySelector<HTMLElement>('.ck-slot__art');
      if (!art) return;
      const flyer = art.cloneNode(true) as HTMLElement;
      flyer.classList.add('ck-flyer');
      scene.append(flyer);
      const fromX = parseFloat(slot.style.left) + SLOT.size / 2;
      const fromY = parseFloat(slot.style.top) + SLOT.size / 2;
      const control = { x: (fromX + land.x) / 2, y: Math.min(fromY, land.y) - ARC_LIFT };
      const frames: Keyframe[] = [];
      for (let step = 0; step <= ARC_STEPS; step += 1) {
        const at = step / ARC_STEPS;
        const x = (1 - at) ** 2 * fromX + 2 * (1 - at) * at * control.x + at ** 2 * land.x;
        const y = (1 - at) ** 2 * fromY + 2 * (1 - at) * at * control.y + at ** 2 * land.y;
        frames.push({ offset: at, transform: `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%)`, opacity: at < 0.85 ? 1 : 0 });
      }
      const delay = index * gapMs;
      flyer.animate(frames, { duration: itemMs, delay, easing: 'linear', fill: 'both' });
      window.setTimeout(() => slot.classList.add('is-gone'), delay);
    });
    const landed = Math.max(0, slots.length - 1) * gapMs + itemMs;
    window.setTimeout(() => {
      const steam = element('div', 'ck-steam');
      steam.style.left = `${steamAt.x}px`;
      steam.style.top = `${steamAt.y}px`;
      steam.style.setProperty('--steam-ms', `${steamMs}ms`);
      steam.append(element('i', ''), element('i', ''), element('i', ''));
      scene.append(steam);
    }, landed);
    window.setTimeout(cook, landed + steamMs);
  };

  /** เครื่องดื่มเทใส่แก้วไม้ไผ่: แก้วเปล่าข้างกองไฟ มีแล้วป้ายเขียว ยังไม่มีแก้วเป็นสีเทาป้ายแดง (ภาพตัวอย่าง drink_k2_mock_v2) */
  const cupBeside = (have: boolean): HTMLElement[] => {
    if (!hasArt(CUP.art)) return [];
    const cup = sizedArt(CUP.art, `ck-cup${have ? '' : ' is-missing'}`, '--px4');
    cup.style.left = `${CUP.left}px`;
    cup.style.top = `${CUP.top}px`;
    const label = element('small', `ck-cup__label${have ? '' : ' is-missing'}`, t(have ? 'cook.have_cup' : 'cook.need_cup'));
    label.style.left = `${CUP.labelX}px`;
    label.style.top = `${CUP.labelY}px`;
    return [cup, label];
  };

  const renderScene = (id: string): void => {
    const recipe = recipes[id]!;
    const { bag } = gameState.world;
    // ทำได้มากสุดเท่าชุดวัตถุดิบครบในกระเป๋า (ผักนับเฉพาะดาวที่เลือก) ของไม่ครบยังแสดง 1 จาน
    const most = Math.max(1, maxBatch(bag, recipe, picks));
    batch = Math.min(Math.max(1, batch), most);
    const ready = canCook(gameState.world, id, picks);
    const { fire, land, steam } = campfire(id);
    let choosing = false;
    const slots = Object.entries(batchIngredients(recipe, batch)).map(([item, need], index) => {
      const made = ingredientSlot(recipe, item, need, index);
      choosing ||= made.choosing;
      return made.slot;
    });
    scene.replaceChildren(fire, bubble(id, recipe), ...slots);
    if (recipe.category === 'drink') scene.append(...cupBeside(hasCupFor(bag, recipe)));
    if (choosing) scene.append(element('small', 'ck-tip', t('cook.star_rule')));
    // ไม่บอกตัวเลขโอกาสได้ดาวเพิ่มตอนอารมณ์ดี กติกายังทำงานเหมือนเดิม (ข้อ A5)
    bar.replaceChildren(...bottomBar(recipe, most, ready, () => startWith(id, land, steam)));
  };

  function render(): void {
    // แท็บเครื่องดื่มขึ้นเมื่อมีแก้วไม้ไผ่ใบแรก แท็บจัดชุดขึ้นเมื่อมีถาดสาน (หรือเคยจัดชุดแล้ว) ก่อนนั้นไม่แสดงเลย (ข้อ A11)
    const shown = TABS.filter(({ id }) => tabUnlocked(id));
    if (!shown.some(({ id }) => id === tab && tabUsable(id))) {
      tab = shown.find(({ id }) => tabUsable(id))?.id ?? 'savory';
      batch = 1;
      picks = {};
    }
    panel.dataset.tab = tab;
    panel.dataset.theme = tab;
    tabs.replaceChildren(
      ...shown.map(({ id, label }) => {
        const button = element('button', `ck-button ck-tab${id === tab ? ' is-active' : ''}${tabUsable(id) ? '' : ' is-off'}`, t(label));
        button.type = 'button';
        button.dataset.cookTab = id;
        button.disabled = !tabUsable(id);
        button.addEventListener('click', () => {
          if (busy || tab === id) return;
          tab = id;
          batch = 1;
          picks = {};
          render();
        });
        return button;
      }),
    );
    if (tab === 'set') {
      setArranger.render();
      return;
    }
    const ids = knownIn(tab);
    // ทำได้ขึ้นก่อน แล้วตามลำดับที่รู้สูตร
    const ready = new Map(ids.map((id) => [id, canCook(gameState.world, id, id === selected ? picks : {})]));
    const sorted = [...ids].sort((a, b) => Number(ready.get(b)) - Number(ready.get(a)));
    if (!selected || !ids.includes(selected)) selected = sorted[0] ?? null;
    grid.replaceChildren(...sorted.map((id) => recipeCard(id, ready.get(id)!)));
    if (ids.length === 0) grid.append(element('p', 'ck-empty cook-empty', t('cook.none')));
    hint.hidden = ids.length <= SLOT.perRow * 3;
    if (selected) renderScene(selected);
    else {
      scene.replaceChildren();
      bar.replaceChildren();
    }
  }

  const setArranger = createSetArranger(grid, hint, scene, bar);

  close.addEventListener('click', hide);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) hide();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !backdrop.hidden) hide();
  });
  eventBus.on('cook-open', () => {
    batch = 1;
    picks = {};
    setArranger.reset();
    busy = false;
    panel.classList.remove('is-busy');
    render();
    grid.scrollTop = 0;
    backdrop.hidden = false;
    revealWhenReady(backdrop);
    gameState.setWindowOpen(WINDOW, true);
  });
}
