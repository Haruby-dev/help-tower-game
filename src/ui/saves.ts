import { eventBus } from '../core/events';
import { t } from '../core/i18n';
import { gameState } from '../core/state';
import { newWorld } from '../systems/gauges';
import { showTitle } from './title';
import type { SaveFile } from '../data/schema';
import { SLOT_COUNT, downloadSave, readSaveUpload, readSlot, toSaveFile, writeSaveFile, writeSlot } from '../systems/save';
import { withFirstGift } from '../systems/gio';

const slots = Array.from({ length: SLOT_COUNT }, (_, index) => index + 1);

/** เซฟอัตโนมัติทุกครั้งที่ขึ้นวันใหม่ */
function startAutoSave(): void {
  eventBus.on('rest-finished', () => {
    const { activeSlot } = gameState;
    if (activeSlot === null) return;
    void writeSlot(activeSlot, gameState.world).then((saved) => {
      if (!saved) eventBus.emit('notice', 'save.failed');
    });
  });
}

/** หน้าเริ่มเกม: เริ่มเกมเล่นต่อจากเซฟล่าสุด ถ้ายังไม่มีเซฟเริ่มใหม่ในช่อง 1 · โหลดเซฟเปิดหน้าเลือกช่อง */
export function showTitleScreen(uiRoot: HTMLElement): void {
  gameState.setWindowOpen('slots', true);
  const close = showTitle(uiRoot, {
    onStart: () => {
      void latestSlot().then(({ slot, world }) => {
        close();
        gameState.startGame(slot, world ?? withFirstGift(newWorld()));
        gameState.setWindowOpen('slots', false);
      });
    },
    onLoad: () => {
      void showSlotPicker(uiRoot, close);
    },
  });
}

async function latestSlot(): Promise<{ slot: number; world: SaveFile['world'] | null }> {
  let best: { slot: number; save: SaveFile } | null = null;
  for (const slot of slots) {
    const save = await readSlot(slot);
    if (save && (!best || save.savedAt > best.save.savedAt)) best = { slot, save };
  }
  return best ? { slot: best.slot, world: best.save.world } : { slot: slots[0]!, world: null };
}

/** หน้าเลือกช่องเซฟ เปิดจากปุ่มโหลดเซฟบนหน้าเริ่มเกม */
export async function showSlotPicker(uiRoot: HTMLElement, closeTitle: () => void = () => undefined): Promise<void> {
  if (document.getElementById('slot-picker')) return;
  const panel = document.createElement('div');
  panel.id = 'slot-picker';
  panel.className = 'panel';
  const title = document.createElement('h2');
  title.textContent = t('save.choose_slot');
  panel.append(title);
  gameState.setWindowOpen('slots', true);

  for (const slot of slots) {
    const save = await readSlot(slot);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'settings-button slot-button';
    button.dataset.slot = String(slot);
    button.textContent = save
      ? `${t('save.slot')} ${slot} · ${t('hud.day')} ${save.world.day}`
      : `${t('save.slot')} ${slot} · ${t('save.empty')}`;
    button.addEventListener('click', () => {
      closeTitle();
      gameState.startGame(slot, save?.world ?? withFirstGift(newWorld()));
      panel.remove();
      gameState.setWindowOpen('slots', false);
    });
    panel.append(button);
  }
  const back = document.createElement('button');
  back.type = 'button';
  back.id = 'slot-back';
  back.className = 'settings-button';
  back.textContent = t('save.back');
  back.addEventListener('click', () => panel.remove());
  panel.append(back);
  uiRoot.append(panel);
}

export function createSaveRow(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'settings-row';
  const label = document.createElement('span');
  label.textContent = t('save.file');
  const choices = document.createElement('div');
  choices.className = 'settings-choices';

  const exportButton = document.createElement('button');
  exportButton.id = 'save-export';
  exportButton.type = 'button';
  exportButton.className = 'settings-button';
  exportButton.textContent = t('save.export');
  exportButton.addEventListener('click', () => {
    if (gameState.activeSlot !== null) downloadSave(gameState.activeSlot, toSaveFile(gameState.world));
  });

  const input = document.createElement('input');
  input.id = 'save-import-file';
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.hidden = true;
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    void readSaveUpload(file).then(async (save) => {
      if (!save || gameState.activeSlot === null) {
        eventBus.emit('notice', 'save.import_failed');
        return;
      }
      await writeSaveFile(gameState.activeSlot, save);
      gameState.startGame(gameState.activeSlot, save.world);
      eventBus.emit('notice', 'save.imported');
    });
  });

  const importButton = document.createElement('button');
  importButton.id = 'save-import';
  importButton.type = 'button';
  importButton.className = 'settings-button';
  importButton.textContent = t('save.import');
  importButton.addEventListener('click', () => input.click());

  choices.append(exportButton, importButton, input);
  row.append(label, choices);
  return row;
}

export function createSaves(uiRoot: HTMLElement): void {
  startAutoSave();
  const notice = document.createElement('p');
  notice.id = 'notice';
  notice.className = 'panel';
  notice.hidden = true;
  uiRoot.append(notice);
  let timer = 0;
  eventBus.on('notice', (key) => {
    notice.textContent = t(key);
    notice.hidden = false;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      notice.hidden = true;
    }, 2500);
  });
}
