import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState, type Tool } from '../core/state';
import { registry } from '../core/assets';
import { cosmeticTable } from '../systems/chests';
import { countOf, cropOfItem, isSeed, seedItem } from '../systems/farm';
import { baits, chosenBait } from '../systems/fishing';
import { itemImage, itemName } from './inventory';
import { artUrl } from './pixelArt';

const TOOLS: { id: Tool; icon: string; name: TextKey }[] = [
  { id: 'hoe', icon: 'tool_hoe', name: 'tool.hoe' },
  { id: 'can', icon: 'tool_watering_can', name: 'tool.can' },
  { id: 'sickle', icon: 'tool_sickle', name: 'tool.sickle' },
  { id: 'seeds', icon: 'tool_seed_bag', name: 'tool.seeds' },
  { id: 'rod', icon: 'tool_rod', name: 'tool.rod' },
];
const BAIT_KEY = 'bait-choice';

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
    const seeds = gameState.world.bag.filter((stack) => isSeed(stack.item));
    if (seeds.length === 0) {
      panel.append(Object.assign(document.createElement('p'), { textContent: t('bag.no_seeds') }));
    }
    for (const stack of seeds) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'seed-choice';
      button.dataset.seed = cropOfItem(stack.item);
      button.append(itemImage(stack.item, false), Object.assign(document.createElement('small'), { textContent: `${itemName(stack.item)} ×${stack.count}` }));
      button.addEventListener('click', () => {
        gameState.setSelectedSeed(cropOfItem(stack.item));
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

/** แถบเครื่องมือกลางล่าง ปุ่ม 1–5 บนคอม แตะได้บนมือถือ ถุงเมล็ดเปิดหน้าเลือกเมล็ด คันเบ็ดเปิดแถบเหยื่อ */
export function createToolbar(uiRoot: HTMLElement): void {
  const bar = document.createElement('div');
  bar.id = 'toolbar';
  const openPicker = createSeedPicker(uiRoot);
  createDigConfirm(uiRoot);
  const baitStrip = createBaitStrip(uiRoot);
  let stripOpen = false;

  let seedIcon: HTMLImageElement | null = null;
  let canIcon: HTMLImageElement | null = null;
  const pill = document.createElement('span');
  pill.className = 'tool-slot__count';
  pill.hidden = true;

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
  uiRoot.append(bar);

  function choose(tool: Tool): void {
    const again = gameState.selectedTool === tool;
    stripOpen = tool === 'rod' && !(again && stripOpen);
    gameState.setSelectedTool(tool);
    if (tool === 'seeds' && (again || gameState.selectedSeed === null)) openPicker();
  }

  /** ช่องเมล็ดแสดงถุงของเมล็ดที่เลือกพร้อมจำนวน */
  const showSeed = (): void => {
    const seed = gameState.selectedSeed;
    if (seedIcon) setNativeIcon(seedIcon, seed ? `seed_${seed}` : 'tool_seed_bag');
    pill.hidden = seed === null || !gameState.started;
    if (seed && gameState.started) pill.textContent = String(countOf(gameState.world.bag, seedItem(seed)));
  };
  const show = (): void => {
    baitStrip.refresh();
    buttons.forEach((button, index) => button.classList.toggle('is-selected', TOOLS[index]!.id === gameState.selectedTool));
    if (gameState.selectedTool !== 'rod') stripOpen = false;
    baitStrip.show(stripOpen);
    showSeed();
  };
  eventBus.on('tool-changed', show);
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
  });
  show();

  document.addEventListener('keydown', (event) => {
    const tool = TOOLS[Number(event.key) - 1];
    if (tool && gameState.clockRunning) choose(tool.id);
  });
}
