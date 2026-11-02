import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState, type Tool } from '../core/state';
import { countOf, cropOfItem, isSeed, seedItem } from '../systems/farm';
import { itemImage, itemName } from './inventory';
import { artUrl } from './pixelArt';

const TOOLS: { id: Tool; icon: string; name: TextKey }[] = [
  { id: 'hoe', icon: 'tool_hoe', name: 'tool.hoe' },
  { id: 'can', icon: 'tool_watering_can', name: 'tool.can' },
  { id: 'sickle', icon: 'tool_sickle', name: 'tool.sickle' },
  { id: 'seeds', icon: 'tool_seed_bag', name: 'tool.seeds' },
];
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

/** แถบเครื่องมือกลางล่าง ปุ่ม 1–4 บนคอม แตะได้บนมือถือ ถุงเมล็ดเปิดหน้าเลือกเมล็ด */
export function createToolbar(uiRoot: HTMLElement): void {
  const bar = document.createElement('div');
  bar.id = 'toolbar';
  const openPicker = createSeedPicker(uiRoot);
  createDigConfirm(uiRoot);

  let seedIcon: HTMLImageElement | null = null;
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
    icon.src = artUrl(tool.icon);
    const badge = document.createElement('span');
    badge.className = 'tool-slot__key';
    badge.textContent = String(index + 1);
    button.append(icon, badge);
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
    gameState.setSelectedTool(tool);
    if (tool === 'seeds' && (again || gameState.selectedSeed === null)) openPicker();
  }

  /** ช่องเมล็ดแสดงถุงของเมล็ดที่เลือกพร้อมจำนวน */
  const showSeed = (): void => {
    const seed = gameState.selectedSeed;
    if (seedIcon) seedIcon.src = artUrl(seed ? `seed_${seed}` : 'tool_seed_bag');
    pill.hidden = seed === null || !gameState.started;
    if (seed && gameState.started) pill.textContent = String(countOf(gameState.world.bag, seedItem(seed)));
  };
  const show = (): void => {
    buttons.forEach((button, index) => button.classList.toggle('is-selected', TOOLS[index]!.id === gameState.selectedTool));
    showSeed();
  };
  eventBus.on('tool-changed', show);
  let shownBag: unknown = null;
  eventBus.on('world-changed', ({ bag }) => {
    if (bag === shownBag) return;
    shownBag = bag;
    showSeed();
  });
  show();

  document.addEventListener('keydown', (event) => {
    const tool = TOOLS[Number(event.key) - 1];
    if (tool && gameState.clockRunning) choose(tool.id);
  });
}
