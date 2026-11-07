import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState, type Tool } from '../core/state';
import { registry } from '../core/assets';
import { cosmeticTable } from '../systems/chests';
import { countOf, cropOfItem, isFertilizer, isSeed, sowItem } from '../systems/farm';
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
const PICKER_WINDOW = 'seed-picker';
const CONFIRM_WINDOW = 'dig-confirm';
const FERTILIZE_WINDOW = 'fertilize-confirm';

function createSeedPicker(uiRoot: HTMLElement): () => void {
  const backdrop = document.createElement('div');
  backdrop.id = 'seed-picker';
  backdrop.hidden = true;
  const panel = document.createElement('div');
  panel.className = 'seed-picker__panel';
  backdrop.append(panel);
  uiRoot.append(backdrop);

  const close = (): void => {
    backdrop.hidden = true;
    gameState.setWindowOpen(PICKER_WINDOW, false);
  };
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });

  return () => {
    panel.replaceChildren();
    // ปุ๋ยเลือกจากหน้าเดียวกับเมล็ด ใส่แปลงด้วยช่องถุงเมล็ด
    const seeds = gameState.world.bag.filter((stack) => isSeed(stack.item) || isFertilizer(stack.item));
    if (seeds.length === 0) {
      panel.append(Object.assign(document.createElement('p'), { textContent: t('bag.no_seeds') }));
    }
    for (const stack of seeds) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'seed-choice';
      const choice = isFertilizer(stack.item) ? stack.item : cropOfItem(stack.item);
      button.dataset.seed = choice;
      button.append(itemImage(stack.item, false), Object.assign(document.createElement('small'), { textContent: `${itemName(stack.item)} ×${stack.count}` }));
      button.addEventListener('click', () => {
        gameState.setSelectedSeed(choice);
        close();
      });
      panel.append(button);
    }
    backdrop.hidden = false;
    gameState.setWindowOpen(PICKER_WINDOW, true);
  };
}

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

/**
 * แถบเครื่องมือกลางล่าง ปุ่ม 1–5 บนคอม แตะได้บนมือถือ ถุงเมล็ดเปิดหน้าเลือกเมล็ด คันเบ็ดเปิดแถบเหยื่อ
 * ปุ่มกลมทางซ้ายสลับทั้งแถบเป็นแถบอาหาร (ผู้ใช้เลือกแบบ B 7 พ.ย. 2026): 5 ช่องคืออาหารในกระเป๋า แถบ › ทางขวาเปลี่ยนหน้า
 * เลือกอาหารแล้วปุ่มกระทำเป็น "กิน"
 */
export function createToolbar(uiRoot: HTMLElement): void {
  const bar = document.createElement('div');
  bar.id = 'toolbar';
  const openPicker = createSeedPicker(uiRoot);
  createDigConfirm(uiRoot);
  createFertilizeConfirm(uiRoot);
  const baitStrip = createBaitStrip(uiRoot);
  let stripOpen = false;
  let foodMode = false;
  let foodPage = 0;

  let seedIcon: HTMLImageElement | null = null;
  let canIcon: HTMLImageElement | null = null;
  const pill = document.createElement('span');
  pill.className = 'tool-slot__count';
  pill.hidden = true;

  // ปุ่มสลับ: โหมดเครื่องมือแสดงช้อนส้อม · โหมดอาหารแสดงจอบ · ไอคอนอย่างเดียว ไม่มีป้ายตัวหนังสือ (ผู้ใช้ตัดสิน) ชื่ออยู่ใน aria-label
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
  pageTab.setAttribute('aria-label', t('food.next_page'));
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
  // ช่องอาหาร 5 ช่องอยู่ที่เดียวกับช่องเครื่องมือ สลับกันแสดง
  const foodSlots = Array.from({ length: SLOTS }, (_, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'food-slot';
    button.hidden = true;
    const badge = document.createElement('span');
    badge.className = 'food-slot__key';
    badge.textContent = String(index + 1);
    button.append(badge);
    button.addEventListener('click', () => pickFood(index));
    bar.append(button);
    return button;
  });
  bar.append(modeButton, pageTab, bagButton);
  uiRoot.append(bar);

  function choose(tool: Tool): void {
    const again = gameState.selectedTool === tool;
    stripOpen = tool === 'rod' && !(again && stripOpen);
    gameState.setSelectedTool(tool);
    if (tool === 'seeds' && (again || gameState.selectedSeed === null)) openPicker();
  }

  const foods = (): BagStack[] => (gameState.started ? edibleStacks(gameState.world.bag) : []);

  function pickFood(index: number): void {
    const stack = foods()[foodPage * SLOTS + index];
    if (stack) gameState.setSelectedFood(stack.item);
  }

  /** ช่องอาหาร: ภาพในกระเป๋าขนาดจริง จำนวนมุมขวาล่าง ป้ายดาวมุมซ้ายล่าง */
  const renderFood = (): void => {
    const list = foods();
    const pages = Math.max(1, Math.ceil(list.length / SLOTS));
    foodPage = Math.min(foodPage, pages - 1);
    // อาหารที่เลือกหมดแล้ว เลือกชิ้นแรกที่ยังมีแทน
    let chosen = gameState.selectedFood;
    if (foodMode && (!chosen || !list.some((stack) => stack.item === chosen))) {
      chosen = list[foodPage * SLOTS]?.item ?? list[0]?.item ?? null;
      gameState.setSelectedFood(chosen);
    }
    foodSlots.forEach((button, index) => {
      const stack = list[foodPage * SLOTS + index];
      button.querySelectorAll('img, .item-missing, .food-slot__count').forEach((node) => node.remove());
      button.classList.toggle('is-selected', Boolean(stack && stack.item === chosen));
      button.classList.toggle('is-empty', !stack);
      button.disabled = !stack;
      delete button.dataset.food;
      button.setAttribute('aria-label', stack ? itemName(stack.item) : t('food.empty'));
      if (!stack) return;
      button.dataset.food = stack.item;
      const art = bagArtId(stack.item);
      if (art) {
        const icon = document.createElement('img');
        icon.className = 'pixel-img';
        icon.alt = '';
        setNativeIcon(icon, art);
        button.prepend(icon);
      } else button.prepend(itemImage(stack.item, false));
      const count = document.createElement('span');
      count.className = 'food-slot__count';
      count.textContent = '×' + String(stack.count);
      button.append(count);
      cornerBadge(button, stack.item);
    });
    pageTab.hidden = !foodMode || list.length <= SLOTS;
    bar.classList.toggle('has-page-tab', !pageTab.hidden);
  };

  const showMode = (): void => {
    bar.dataset.mode = foodMode ? 'food' : 'tools';
    setNativeIcon(modeIcon, foodMode ? 'tool_hoe' : 'ui_icon_spoon_fork');
    modeButton.setAttribute('aria-label', t(foodMode ? 'food.switch_to_tools' : 'food.switch_to_food'));
    for (const button of buttons) button.hidden = foodMode;
    for (const button of foodSlots) button.hidden = !foodMode;
    if (foodMode) {
      stripOpen = false;
      baitStrip.show(false);
    } else gameState.setSelectedFood(null);
    renderFood();
  };
  modeButton.addEventListener('click', () => {
    foodMode = !foodMode;
    foodPage = 0;
    showMode();
  });
  pageTab.addEventListener('click', () => {
    const pages = Math.max(1, Math.ceil(foods().length / SLOTS));
    foodPage = (foodPage + 1) % pages;
    gameState.setSelectedFood(foods()[foodPage * SLOTS]?.item ?? null);
    renderFood();
  });

  /** ช่องเมล็ดแสดงถุงของเมล็ดที่เลือกพร้อมจำนวน */
  const showSeed = (): void => {
    const seed = gameState.selectedSeed;
    if (seedIcon) setNativeIcon(seedIcon, seed ? sowItem(seed) : 'tool_seed_bag');
    pill.hidden = seed === null || !gameState.started;
    if (seed && gameState.started) pill.textContent = String(countOf(gameState.world.bag, sowItem(seed)));
  };
  const show = (): void => {
    baitStrip.refresh();
    buttons.forEach((button, index) => button.classList.toggle('is-selected', TOOLS[index]!.id === gameState.selectedTool));
    if (gameState.selectedTool !== 'rod' || foodMode) stripOpen = false;
    baitStrip.show(stripOpen);
    showSeed();
  };
  eventBus.on('tool-changed', show);
  eventBus.on('food-changed', renderFood);
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
    renderFood();
  });
  show();
  showMode();

  document.addEventListener('keydown', (event) => {
    const index = Number(event.key) - 1;
    if (!gameState.clockRunning || !Number.isInteger(index) || index < 0 || index >= SLOTS) return;
    if (foodMode) pickFood(index);
    else choose(TOOLS[index]!.id);
  });
}
