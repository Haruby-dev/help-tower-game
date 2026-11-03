import { registry } from '../core/assets';
import { eventBus } from '../core/events';
import { t } from '../core/i18n';
import { createRng } from '../core/rng';
import { gameState } from '../core/state';
import { cosmeticTable, openChest, type Reward } from '../systems/chests';
import { itemImage, itemName } from './inventory';
import { artUrl } from './pixelArt';

const WINDOW = 'chest';
const SHAKE_MS = 400;
const BURST_FRAMES = 6;
const BURST_FPS = 12;
const BURST_SIZE = 44;
const ITEM_GAP_MS = 260;
/** ภาพเคสและวอลเปเปอร์ใหญ่กว่าช่อง จึงแสดงเป็นชื่อแทน ห้ามย่อ */
const MAX_ICON_PX = 40;

const rng = createRng(Date.now());

function rewardImage(reward: Exclude<Reward, { kind: 'coins' }>): HTMLElement {
  if (reward.kind !== 'cosmetic') return itemImage(reward.item, false);
  const art = cosmeticTable[reward.item]?.art;
  const entry = art ? registry[art] : undefined;
  if (!art || entry?.type !== 'local' || entry.width > MAX_ICON_PX) {
    const box = document.createElement('i');
    box.className = 'item-missing';
    box.textContent = itemName(reward.item);
    return box;
  }
  const image = document.createElement('img');
  image.className = 'pixel-img';
  image.alt = '';
  image.src = artUrl(art);
  image.style.width = `calc(var(--px) * ${entry.width})`;
  image.style.height = `calc(var(--px) * ${entry.height})`;
  return image;
}

function rewardRow(reward: Reward): HTMLElement {
  const row = document.createElement('li');
  row.className = 'chest-reward';
  if (reward.kind === 'coins') {
    row.dataset.reward = 'coins';
    row.append(Object.assign(document.createElement('b'), { textContent: `+${reward.amount} ${t('chest.coins')}` }));
    return row;
  }
  row.dataset.reward = reward.item;
  const text = reward.count > 1 ? `${itemName(reward.item)} ×${reward.count}` : itemName(reward.item);
  row.append(rewardImage(reward), Object.assign(document.createElement('span'), { textContent: text }));
  if (reward.duplicateStars > 0) {
    row.append(Object.assign(document.createElement('small'), { textContent: `${t('chest.duplicate')} +${reward.duplicateStars}` }));
  }
  return row;
}

/** เปิดหีบจากกระเป๋า หีบสั่น ±1 พิกเซล แล้วประกายแตกออก แล้วของเด้งออกมาทีละชิ้น ไม่มีภาพฝาเปิด */
export function createChestWindow(uiRoot: HTMLElement): void {
  const backdrop = document.createElement('div');
  backdrop.id = 'chest-window';
  backdrop.hidden = true;
  const panel = document.createElement('div');
  panel.className = 'seed-picker__panel chest-panel';
  const stage = document.createElement('div');
  stage.className = 'chest-stage';
  const chest = document.createElement('img');
  chest.className = 'pixel-img chest-box';
  chest.alt = '';
  const burst = document.createElement('i');
  burst.className = 'chest-burst';
  burst.style.backgroundImage = `url("${artUrl('fx_chest_burst')}")`;
  burst.style.setProperty('--burst-ms', `${(BURST_FRAMES / BURST_FPS) * 1000}ms`);
  burst.style.setProperty('--burst-sheet', String(BURST_SIZE * BURST_FRAMES));
  stage.append(chest, burst);
  const list = document.createElement('ul');
  list.className = 'chest-rewards';
  const take = document.createElement('button');
  take.id = 'chest-take';
  take.type = 'button';
  take.className = 'phone-tool';
  take.textContent = t('chest.take');
  panel.append(stage, list, take);
  backdrop.append(panel);
  uiRoot.append(backdrop);

  let timers: number[] = [];
  const later = (ms: number, run: () => void): void => {
    timers.push(window.setTimeout(run, ms));
  };
  const close = (): void => {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers = [];
    backdrop.hidden = true;
    gameState.setWindowOpen(WINDOW, false);
  };
  take.addEventListener('click', close);

  eventBus.on('chest-open', (item) => {
    const result = openChest(gameState.world, item, rng);
    if (!result) {
      eventBus.emit('player-says', 'bagFull');
      return;
    }
    gameState.setWorld(result.world);
    chest.src = artUrl(item);
    chest.style.width = 'calc(var(--px) * 32)';
    chest.style.height = 'calc(var(--px) * 32)';
    list.replaceChildren();
    burst.classList.remove('is-playing');
    chest.classList.add('is-shaking');
    backdrop.hidden = false;
    gameState.setWindowOpen(WINDOW, true);
    later(SHAKE_MS, () => {
      chest.classList.remove('is-shaking');
      burst.classList.add('is-playing');
    });
    const burstMs = (BURST_FRAMES / BURST_FPS) * 1000;
    result.rewards.forEach((reward, index) => {
      later(SHAKE_MS + burstMs + index * ITEM_GAP_MS, () => list.append(rewardRow(reward)));
    });
  });
}
