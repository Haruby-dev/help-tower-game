import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState, type Tool } from '../core/state';
import { registry } from '../core/assets';
import { cosmeticTable } from '../systems/chests';
import { countOf, crops, cropOfItem, fertilizerItems, isFertilizer, seedItem, sowItem } from '../systems/farm';
import { baits, chosenBait } from '../systems/fishing';
import { bagArtId, cornerBadge, itemImage, itemName } from './inventory';
import { artUrl, pixelDisc, stickerIcon } from './pixelArt';
import { fullnessOf, isDish } from '../systems/cooking';
import type { BagStack } from '../core/state';

const TOOLS: { id: Tool; icon: string; name: TextKey }[] = [
  { id: 'hoe', icon: 'tool_hoe', name: 'tool.hoe' },
  { id: 'can', icon: 'tool_watering_can', name: 'tool.can' },
  { id: 'sickle', icon: 'tool_sickle', name: 'tool.sickle' },
  { id: 'seeds', icon: 'tool_seed_bag', name: 'tool.seeds' },
  { id: 'rod', icon: 'tool_rod', name: 'tool.rod' },
];
const BAIT_KEY = 'bait-choice';
const SLOTS = 5;
/** ปุ่มสลับแถบ วงกลมพิกเซลข้างซ้ายของถาด (ภาพตัวอย่าง eat_swap_B) */
const SWITCH_PX = 34;

/** ของที่กินได้ในกระเป๋า อาหารก่อน แล้วผักสด เรียงตามลำดับในกระเป๋า */
export function edibleStacks(bag: BagStack[]): BagStack[] {
  const edible = bag.filter((stack) => fullnessOf(stack.item) !== null);
  return [...edible.filter((stack) => isDish(stack.item)), ...edible.filter((stack) => !isDish(stack.item))];
}

/** ไอคอนแสดงขนาดจริงเสมอ ห้ามย่อให้พอดีช่อง */
export function setNativeIcon(icon: HTMLImageElement, id: string): void {
  const entry = registry[id];
  if (entry?.type !== 'local') return;
  icon.src = artUrl(id);
  icon.style.setProperty('--w', String(entry.width));
  icon.style.setProperty('--h', String(entry.height));
}

function readBait(): string | null {
  try {
    return window.localStorage.getItem(BAIT_KEY);
  } catch {
    return null;
  }
}

function storeBait(bait: string): void {
  try {
    window.localStorage.setItem(BAIT_KEY, bait);
  } catch {
    // ไม่เก็บค่าก็ไม่กระทบการเล่น
  }
}

/** แถบเหยื่อเหนือช่องคันเบ็ด ช่องละชนิด ภาพเหยื่อจริงพร้อมจำนวน เหยื่อที่หมดเป็นสีจาง */
function createBaitStrip(uiRoot: HTMLElement): { show(open: boolean): void; refresh(): void } {
  const strip = document.createElement('div');
  strip.id = 'bait-strip';
  strip.hidden = true;
  strip.setAttribute('aria-label', t('bait.strip'));
  const slots = Object.entries(baits).map(([id, bait]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bait-slot';
    button.dataset.bait = id;
    button.setAttribute('aria-label', itemName(bait.item));
    const icon = document.createElement('img');
    icon.alt = '';
    setNativeIcon(icon, bait.item);
    const count = document.createElement('b');
    button.append(icon, count);
    button.addEventListener('click', () => {
      gameState.setSelectedBait(id);
      storeBait(id);
    });
    strip.append(button);
    return { id, item: bait.item, button, count };
  });
  uiRoot.append(strip);
  const stored = readBait();
  if (stored && baits[stored]) gameState.setSelectedBait(stored);

  const refresh = (): void => {
    if (!gameState.started) return;
    const bag = gameState.world.bag;
    const using = chosenBait(bag, gameState.selectedBait);
    for (const slot of slots) {
      const owned = countOf(bag, slot.item);
      slot.count.textContent = `×${owned}`;
      slot.button.disabled = owned === 0;
      slot.button.classList.toggle('is-selected', using === slot.id);
    }
  };
  return {
    show(open) {
      strip.hidden = !open;
      if (open) refresh();
    },
    refresh,
  };
}
const CONFIRM_WINDOW = 'dig-confirm';
const FERTILIZE_WINDOW = 'fertilize-confirm';

function createDigConfirm(uiRoot: HTMLElement): void {
  const backdrop = document.createElement('div');
  backdrop.id = 'dig-confirm';
  backdrop.hidden = true;
  const panel = document.createElement('div');
  panel.className = 'dig-confirm__panel';
  const text = document.createElement('p');
  const yes = document.createElement('button');
  yes.id = 'dig-yes';
  yes.type = 'button';
  yes.className = 'phone-tool';
  yes.textContent = t('dig.yes');
  const no = document.createElement('button');
  no.id = 'dig-no';
  no.type = 'button';
  no.className = 'phone-tool';
  no.textContent = t('dig.no');
  panel.append(text, yes, no);
  backdrop.append(panel);
  uiRoot.append(backdrop);

  let target = -1;
  const close = (): void => {
    backdrop.hidden = true;
    gameState.setWindowOpen(CONFIRM_WINDOW, false);
  };
  eventBus.on('dig-requested', ({ plot, crop }) => {
    target = plot;
    text.textContent = `${t('dig.question')} ${t(`crop.${crop}.name` as TextKey)}${t('dig.question_end')}`;
    backdrop.hidden = false;
    gameState.setWindowOpen(CONFIRM_WINDOW, true);
  });
  yes.addEventListener('click', () => {
    close();
    eventBus.emit('dig-confirmed', target);
  });
  no.addEventListener('click', close);
}

/** ปุ๋ยระดับสูงกว่าจะแทนปุ๋ยเดิมในแปลง ถามก่อน ใช้หน้าตาเดียวกับหน้าถามขุดทิ้ง */
function createFertilizeConfirm(uiRoot: HTMLElement): void {
  const backdrop = document.createElement('div');
  backdrop.id = 'fertilize-confirm';
  backdrop.className = 'dig-confirm';
  backdrop.hidden = true;
  const panel = document.createElement('div');
  panel.className = 'dig-confirm__panel';
  const text = document.createElement('p');
  const yes = document.createElement('button');
  yes.id = 'fertilize-yes';
  yes.type = 'button';
  yes.className = 'phone-tool';
  yes.textContent = t('fertilize.yes');
  const no = document.createElement('button');
  no.id = 'fertilize-no';
  no.type = 'button';
  no.className = 'phone-tool';
  no.textContent = t('fertilize.no');
  panel.append(text, yes, no);
  backdrop.append(panel);
  uiRoot.append(backdrop);

  let target = -1;
  const close = (): void => {
    backdrop.hidden = true;
    gameState.setWindowOpen(FERTILIZE_WINDOW, false);
  };
  eventBus.on('fertilize-requested', ({ plot, item }) => {
    target = plot;
    text.textContent = `${t('fertilize.question')}${itemName(item)}${t('fertilize.question_end')}`;
    backdrop.hidden = false;
    gameState.setWindowOpen(FERTILIZE_WINDOW, true);
  });
  yes.addEventListener('click', () => {
    close();
    eventBus.emit('fertilize-confirmed', target);
  });
  no.addEventListener('click', close);
}

/** โหมดของแถบล่าง: เครื่องมือ · อาหาร (ปุ่มสลับซ้าย) · เมล็ด (แตะช่องถุงเมล็ด) */
type BarMode = 'tools' | 'food' | 'seeds';
/** ของในช่องแถบอาหารและแถบเมล็ด key คือค่าที่เลือก (อาหาร = รหัสของ · เมล็ด = ชนิดพืชหรือรหัสปุ๋ย) */
interface BarItem {
  item: string;
  count: number;
  key: string;
}

const seedChoice = (item: string): string => (isFertilizer(item) ? item : cropOfItem(item));

/** แถบเมล็ด: เมล็ดทุกชนิดในกระเป๋าตามลำดับใน crops.json แล้วต่อด้วยปุ๋ยระดับต่ำไปสูง */
function seedItems(bag: BagStack[]): BarItem[] {
  const seeds = Object.keys(crops).map(seedItem);
  return [...seeds, ...fertilizerItems()]
    .map((item) => ({ item, count: countOf(bag, item), key: seedChoice(item) }))
    .filter((entry) => entry.count > 0);
}

const foodItems = (bag: BagStack[]): BarItem[] => edibleStacks(bag).map((stack) => ({ item: stack.item, count: stack.count, key: stack.item }));

/**
 * แถบเครื่องมือกลางล่าง ปุ่ม 1–5 บนคอม แตะได้บนมือถือ คันเบ็ดเปิดแถบเหยื่อ
 * ปุ่มกลมทางซ้ายสลับทั้งแถบเป็นแถบอาหาร (ผู้ใช้เลือกแบบ B 7 พ.ย. 2026) · แตะถุงเมล็ด ทั้งแถบเป็นแถบเมล็ด (ผู้ใช้อนุมัติ 7 พ.ย. 2026)
 * แถบอาหารและแถบเมล็ดหน้าตาเดียวกัน 5 ช่อง แถบ › ทางขวาเปลี่ยนหน้า ปุ่ม 1–5 เลือก · ปุ่มบนแถบไม่มีตัวหนังสือ
 */
export function createToolbar(uiRoot: HTMLElement): void {
  const bar = document.createElement('div');
  bar.id = 'toolbar';
  createDigConfirm(uiRoot);
  createFertilizeConfirm(uiRoot);
  const baitStrip = createBaitStrip(uiRoot);
  let stripOpen = false;
  let mode: BarMode = 'tools';
  let page = 0;
  /** ตำแหน่งของเมล็ดที่เลือกในแถบเมล็ด เมล็ดหมดแล้วเลือกชิ้นที่เลื่อนมาแทนที่ (ชิ้นถัดไป) */
  let seedIndex = 0;

  let seedIcon: HTMLImageElement | null = null;
  let canIcon: HTMLImageElement | null = null;
  const pill = document.createElement('span');
  pill.className = 'tool-slot__count';
  pill.hidden = true;

  // ปุ่มสลับ: โหมดเครื่องมือแสดงช้อนส้อม · โหมดอาหารและโหมดเมล็ดแสดงจอบ · ไอคอนอย่างเดียว ไม่มีป้ายตัวหนังสือ (ผู้ใช้ตัดสิน) ชื่ออยู่ใน aria-label
  const modeButton = document.createElement('button');
  modeButton.type = 'button';
  modeButton.id = 'toolbar-mode';
  modeButton.className = 'toolbar-mode';
  const modeIcon = document.createElement('img');
  modeIcon.className = 'pixel-img toolbar-mode__icon';
  modeIcon.alt = '';
  const disc = pixelDisc(SWITCH_PX, '#FFF6F0', '#F8B4CC');
  disc.classList.add('toolbar-mode__disc');
  modeButton.append(disc, modeIcon);
  const pageTab = document.createElement('button');
  pageTab.type = 'button';
  pageTab.id = 'food-next';
  pageTab.className = 'toolbar-page';
  pageTab.textContent = '›';
  // ปุ่มกระเป๋าปลายขวาแถบ (ผู้ใช้เลือกจุด B 6 พ.ย. 2026) สติกเกอร์แบบเดียวกับปุ่มตั้งค่า อยู่ต่อจากแถบ › เมื่อแถบนั้นขึ้น
  const bagButton = document.createElement('button');
  bagButton.type = 'button';
  bagButton.id = 'bag-button';
  bagButton.setAttribute('aria-label', t('app.inventory'));
  bagButton.append(stickerIcon('ui_app_bag'));
  bagButton.addEventListener('click', () => {
    if (gameState.started) eventBus.emit('bag-open', undefined);
  });

  const buttons = TOOLS.map((tool, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tool-slot';
    button.dataset.tool = tool.id;
    button.setAttribute('aria-label', t(tool.name));
    const icon = document.createElement('img');
    icon.className = 'pixel-img';
    icon.alt = '';
    setNativeIcon(icon, tool.icon);
    const badge = document.createElement('span');
    badge.className = 'tool-slot__key';
    badge.textContent = String(index + 1);
    button.append(icon, badge);
    if (tool.id === 'can') canIcon = icon;
    if (tool.id === 'seeds') {
      seedIcon = icon;
      button.append(pill);
    }
    button.addEventListener('click', () => choose(tool.id));
    bar.append(button);
    return button;
  });
  // ช่องของ 5 ช่อง (อาหารหรือเมล็ด) อยู่ที่เดียวกับช่องเครื่องมือ สลับกันแสดง
  const itemSlots = Array.from({ length: SLOTS }, (_, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'food-slot';
    button.hidden = true;
    const badge = document.createElement('span');
    badge.className = 'food-slot__key';
    badge.textContent = String(index + 1);
    button.append(badge);
    button.addEventListener('click', () => pick(index));
    bar.append(button);
    return button;
  });
  bar.append(modeButton, pageTab, bagButton);
  uiRoot.append(bar);

  const items = (): BarItem[] => {
    if (!gameState.started || mode === 'tools') return [];
    return mode === 'food' ? foodItems(gameState.world.bag) : seedItems(gameState.world.bag);
  };
  const chosenKey = (): string | null => (mode === 'food' ? gameState.selectedFood : gameState.selectedSeed);
  const setChosen = (key: string | null): void => {
    if (mode === 'food') gameState.setSelectedFood(key);
    else gameState.setSelectedSeed(key);
  };
  /** เปิดหน้าที่มีของที่เลือกอยู่ */
  const pageOf = (list: BarItem[], key: string | null): number => Math.max(0, Math.floor(list.findIndex((entry) => entry.key === key) / SLOTS));

  function choose(tool: Tool): void {
    const again = gameState.selectedTool === tool;
    stripOpen = tool === 'rod' && !(again && stripOpen);
    gameState.setSelectedTool(tool);
    // แตะถุงเมล็ด: ทั้งแถบเป็นแถบเมล็ด เครื่องมือยังเป็นถุงเมล็ดตลอด ปุ่มกระทำจึงปลูกและใส่ปุ๋ยได้เหมือนเดิม
    if (tool === 'seeds') setMode('seeds');
  }

  function pick(index: number): void {
    const entry = items()[page * SLOTS + index];
    if (!entry) return;
    if (mode === 'seeds') seedIndex = page * SLOTS + index;
    setChosen(entry.key);
  }

  /** ช่องของ: ภาพในกระเป๋าขนาดจริง จำนวนมุมขวาล่าง ป้ายดาวมุมซ้ายล่างเฉพาะอาหารกับผักที่มีดาว */
  const renderItems = (): void => {
    const list = items();
    const pages = Math.max(1, Math.ceil(list.length / SLOTS));
    page = Math.min(page, pages - 1);
    let chosen = chosenKey();
    if (mode === 'food' && (!chosen || !list.some((entry) => entry.key === chosen))) {
      // อาหารที่เลือกหมดแล้ว เลือกชิ้นแรกของหน้านี้แทน
      chosen = list[page * SLOTS]?.key ?? list[0]?.key ?? null;
      if (chosen !== gameState.selectedFood) gameState.setSelectedFood(chosen);
    } else if (mode === 'seeds') {
      const at = list.findIndex((entry) => entry.key === chosen);
      if (at >= 0) seedIndex = at;
      else {
        // เมล็ดที่เลือกหมดแล้ว เลือกชิ้นถัดไปในแถบ ไม่เหลืออะไรเลยช่องว่างทั้งแถบ แถบยังเปิดอยู่จนกว่าจะแตะปุ่มสลับ
        chosen = list[Math.min(seedIndex, list.length - 1)]?.key ?? null;
        page = pageOf(list, chosen);
        // เปลี่ยนเฉพาะเมื่อต่างจากเดิม การเลือกส่ง tool-changed กลับมาที่นี่ ถ้าตั้งค่าเดิมซ้ำจะวนไม่จบ
        if (chosen !== gameState.selectedSeed) gameState.setSelectedSeed(chosen);
      }
    }
    itemSlots.forEach((button, index) => {
      const entry = list[page * SLOTS + index];
      button.querySelectorAll('img, .item-missing, .food-slot__count, .star-badge').forEach((node) => node.remove());
      button.classList.toggle('is-selected', Boolean(entry && entry.key === chosen));
      button.classList.toggle('is-empty', !entry);
      button.disabled = !entry;
      delete button.dataset.food;
      delete button.dataset.seed;
      button.setAttribute('aria-label', entry ? itemName(entry.item) : t('food.empty'));
      if (!entry) return;
      if (mode === 'food') button.dataset.food = entry.item;
      else button.dataset.seed = entry.key;
      const art = bagArtId(entry.item);
      if (art) {
        const icon = document.createElement('img');
        icon.className = 'pixel-img';
        icon.alt = '';
        setNativeIcon(icon, art);
        button.prepend(icon);
      } else button.prepend(itemImage(entry.item, false));
      const count = document.createElement('span');
      count.className = 'food-slot__count';
      count.textContent = '×' + String(entry.count);
      button.append(count);
      if (mode === 'food') cornerBadge(button, entry.item);
    });
    pageTab.hidden = mode === 'tools' || list.length <= SLOTS;
    pageTab.setAttribute('aria-label', t(mode === 'seeds' ? 'seedbar.next_page' : 'food.next_page'));
    bar.classList.toggle('has-page-tab', !pageTab.hidden);
  };

  function setMode(next: BarMode): void {
    mode = next;
    bar.dataset.mode = mode;
    setNativeIcon(modeIcon, mode === 'tools' ? 'ui_icon_spoon_fork' : 'tool_hoe');
    modeButton.setAttribute('aria-label', t(mode === 'tools' ? 'food.switch_to_food' : 'food.switch_to_tools'));
    for (const button of buttons) button.hidden = mode !== 'tools';
    for (const button of itemSlots) button.hidden = mode === 'tools';
    if (mode !== 'tools') {
      stripOpen = false;
      baitStrip.show(false);
    }
    if (mode !== 'food') gameState.setSelectedFood(null);
    page = mode === 'seeds' ? pageOf(items(), gameState.selectedSeed) : 0;
    renderItems();
  }

  // โหมดเครื่องมือ → แถบอาหาร · แถบอาหารหรือแถบเมล็ด → กลับแถบเครื่องมือ (ถุงเมล็ดยังเลือกอยู่)
  modeButton.addEventListener('click', () => setMode(mode === 'tools' ? 'food' : 'tools'));
  pageTab.addEventListener('click', () => {
    const list = items();
    const pages = Math.max(1, Math.ceil(list.length / SLOTS));
    page = (page + 1) % pages;
    // แถบอาหารเลือกชิ้นแรกของหน้าใหม่ แถบเมล็ดเปลี่ยนแค่หน้า เมล็ดที่เลือกไว้ยังเหมือนเดิม
    if (mode === 'food') gameState.setSelectedFood(list[page * SLOTS]?.key ?? null);
    renderItems();
  });

  /** ช่องเมล็ดในแถบเครื่องมือแสดงถุงของเมล็ดที่เลือกพร้อมจำนวน */
  const showSeed = (): void => {
    const seed = gameState.selectedSeed;
    if (seedIcon) setNativeIcon(seedIcon, seed ? sowItem(seed) : 'tool_seed_bag');
    pill.hidden = seed === null || !gameState.started;
    if (seed && gameState.started) pill.textContent = String(countOf(gameState.world.bag, sowItem(seed)));
  };
  const show = (): void => {
    baitStrip.refresh();
    buttons.forEach((button, index) => button.classList.toggle('is-selected', TOOLS[index]!.id === gameState.selectedTool));
    if (gameState.selectedTool !== 'rod' || mode !== 'tools') stripOpen = false;
    baitStrip.show(stripOpen);
    showSeed();
    if (mode === 'seeds') {
      // เครื่องมือเปลี่ยนจากที่อื่น (ไม่ใช่ถุงเมล็ดแล้ว) แถบกลับเป็นแถบเครื่องมือ
      if (gameState.selectedTool !== 'seeds') setMode('tools');
      else renderItems();
    }
  };
  eventBus.on('tool-changed', show);
  eventBus.on('food-changed', () => {
    if (mode === 'food') renderItems();
  });
  let shownBag: unknown = null;
  let shownSkin = '';
  eventBus.on('world-changed', ({ bag, cosmetics }) => {
    const skin = cosmetics.equipped.canSkin;
    if (skin !== shownSkin && canIcon) {
      shownSkin = skin;
      setNativeIcon(canIcon, cosmeticTable[skin]?.art ?? 'tool_watering_can');
    }
    if (bag === shownBag) return;
    shownBag = bag;
    showSeed();
    baitStrip.refresh();
    renderItems();
  });
  show();
  setMode('tools');

  document.addEventListener('keydown', (event) => {
    const index = Number(event.key) - 1;
    if (!gameState.clockRunning || !Number.isInteger(index) || index < 0 || index >= SLOTS) return;
    if (mode === 'tools') choose(TOOLS[index]!.id);
    else pick(index);
  });
}
