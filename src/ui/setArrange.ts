import { registry } from '../core/assets';
import { t, type TextKey } from '../core/i18n';
import { gameState } from '../core/state';
import type { TraySize } from '../data/schema';
import { parseDish, recipes } from '../systems/cooking';
import { countOf } from '../systems/farm';
import { TRAY_SIZES, comboOf, parseSet, isYuckPiece, makeSet, pieceKind, setCandidates, setTable, type PieceKind } from '../systems/sets';
import { itemName, setImage } from './inventory';
import { sizedArt } from './pixelArt';

/**
 * แท็บ "จัดชุด" ในหน้าต่างทำอาหาร (งานอาหารโซน 1 ขั้นที่ 6 · ภาพตัวอย่าง art-src/cook_ui_1108/set_1108/set_free_mock.png set_combo.gif)
 * ซ้ายอาหารที่ทำแล้วในกระเป๋า (กับข้าวขึ้นก่อน) ขวาถาดที่เลือกพร้อมช่องว่าง แตะอาหารลงช่อง แตะช่องเอาคืน
 * เตือนหน้าจะอ้วกเฉพาะตอนจัดครบถาดแล้วไม่ตรงชุดลับและมีของหวานหรือเครื่องดื่ม (ผู้ใช้ตัดสิน 9 พ.ย. 2026 ชุดลับหลายชุดต้องใช้ของหวานกับเครื่องดื่ม)
 * ครบถาดแล้วตรงสูตรลับ ชื่อชุดเด้งขึ้น กด "จัดชุด" ได้ชุดหนึ่งชิ้น ถาดใช้แล้วหมด · ขนาดเป็นพิกเซลภาพตัวอย่างเหมือนหน้าต่างทำอาหาร
 */
const KIND_ORDER: PieceKind[] = ['rice', 'side', 'sweet', 'drink', 'other'];
const TAG_TEXT: Record<PieceKind, TextKey> = { rice: 'set.tag_rice', side: 'set.tag_side', sweet: 'set.tag_sweet', drink: 'set.tag_drink', other: 'set.tag_other' };
/** ถาดในฉากขยาย 4 เท่าของพิกเซลภาพ (12 จุดภาพตัวอย่าง) กลางที่ y 302 ของฉาก */
const TRAY_SCALE = 4;
const TRAY_CENTER_Y = 302;
const NAME_LONG = 9;
const MADE_SHOW_MS = 1300;
const MIN_PIECES = 2;

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const dishArt = (dish: string, className: string): HTMLElement => {
  const icon = recipes[parseDish(dish).recipe]?.icon;
  return icon && registry[icon]?.type === 'local' ? sizedArt(icon, className, '--px2') : element('i', `${className} ck-card__art--none`);
};

export interface SetArranger {
  render(): void;
  reset(): void;
}

export function createSetArranger(grid: HTMLElement, hint: HTMLElement, scene: HTMLElement, bar: HTMLElement): SetArranger {
  let size: TraySize = 'small';
  let pieces: string[] = [];
  let made: { item: string; name: string; until: number } | null = null;

  const trayCount = (tray: TraySize): number => countOf(gameState.world.bag, setTable.trays[tray].item);
  const left = (dish: string): number => countOf(gameState.world.bag, dish) - pieces.filter((piece) => piece === dish).length;

  const card = (dish: string): HTMLElement => {
    const kind = pieceKind(dish);
    const remaining = left(dish);
    const box = element('button', `ck-card sx-card${remaining > 0 ? '' : ' is-missing'}`);
    box.type = 'button';
    box.dataset.setDish = dish;
    box.append(dishArt(dish, 'ck-card__art sx-card__art'));
    const name = itemName(dish);
    const label = element('span', 'ck-card__name sx-card__name', name);
    label.dataset.size = name.length > NAME_LONG ? 's' : 'l';
    box.append(label, element('b', 'sx-tag', t(TAG_TEXT[kind])), element('b', 'sx-count', String(remaining)));
    box.setAttribute('aria-label', `${name} ${t(TAG_TEXT[kind])} ${remaining}`);
    box.addEventListener('click', () => {
      if (remaining < 1 || pieces.length >= setTable.trays[size].pieces) return;
      pieces = [...pieces, dish];
      made = null;
      render();
      scene.querySelector<HTMLElement>(`.sx-slot[data-slot="${pieces.length - 1}"] .sx-slot__art`)?.animate(
        [{ transform: 'translateY(-36px)' }, { transform: 'translateY(4px)', offset: 0.7 }, { transform: 'translateY(0)' }],
        { duration: 260, easing: 'steps(6, end)' },
      );
    });
    return box;
  };

  const renderGrid = (): void => {
    const dishes = setCandidates(gameState.world.bag)
      .map((stack) => stack.item)
      .sort((a, b) => KIND_ORDER.indexOf(pieceKind(a)) - KIND_ORDER.indexOf(pieceKind(b)));
    grid.replaceChildren(...dishes.map(card));
    if (dishes.length === 0) grid.append(element('p', 'ck-empty', t('set.none')));
    hint.hidden = dishes.length <= 9;
  };

  const renderScene = (): void => {
    const tray = setTable.trays[size];
    const chips = element('div', 'sx-chips');
    for (const option of TRAY_SIZES) {
      const chip = element('button', `ck-button sx-chip${option === size ? ' is-active' : ''}`);
      chip.type = 'button';
      chip.dataset.traySize = option;
      chip.append(element('b', '', `${t(`set.tray.${option}` as TextKey)} · ${setTable.trays[option].pieces}`), element('small', 'sx-chip__have', `${t('set.have')} ${trayCount(option)} ${t('set.pieces_unit')}`));
      chip.addEventListener('click', () => {
        if (size === option) return;
        size = option;
        pieces = pieces.slice(0, setTable.trays[option].pieces);
        made = null;
        render();
      });
      chips.append(chip);
    }
    const note = element('small', 'sx-note', t('set.big_table_note'));
    const trayEntry = registry[tray.item];
    const trayHeight = trayEntry?.type === 'local' ? trayEntry.height : 32;
    const trayWidth = trayEntry?.type === 'local' ? trayEntry.width : 32;
    const trayArt = sizedArt(tray.item, 'sx-tray', '--px', TRAY_SCALE);
    trayArt.style.top = `${TRAY_CENTER_Y - (trayHeight * TRAY_SCALE * 3) / 2}px`;
    trayArt.style.left = `calc(50% - ${(trayWidth * TRAY_SCALE * 3) / 2}px)`;
    const full = pieces.length === tray.pieces;
    const combo = full ? comboOf(size, pieces) : null;
    const yuck = full && !combo && pieces.some(isYuckPiece);
    const slots = tray.ui.map(([dx, dy], index) => {
      const dish = pieces[index];
      const yuckDish = yuck && dish !== undefined && isYuckPiece(dish);
      const slot = element('button', `sx-slot${dish ? ' is-filled' : ''}${combo ? ' is-combo' : ''}${yuckDish ? ' is-yuck' : ''}`);
      slot.type = 'button';
      slot.dataset.slot = String(index);
      slot.style.left = `calc(50% + ${dx}px - 66px)`;
      slot.style.top = `${TRAY_CENTER_Y + dy - 66}px`;
      if (dish) {
        slot.append(dishArt(dish, 'sx-slot__art'));
        if (yuckDish && registry.emote_yuck?.type === 'local') slot.append(sizedArt('emote_yuck', 'sx-yuck', '--px2'));
        slot.setAttribute('aria-label', itemName(dish));
        slot.addEventListener('click', () => {
          pieces = pieces.filter((_, at) => at !== index);
          made = null;
          render();
        });
      } else slot.append(element('b', 'sx-slot__plus', '+'));
      return slot;
    });
    // จัดเสร็จ: ถาดหายไป เหลือภาพชุดที่ได้กับ "+1 ชื่อชุด" (ภาพตัวอย่าง set_combo_keys.png เฟรมสุดท้าย)
    if (made && performance.now() < made.until) {
      // ภาพชุดขนาดเท่าถาดที่เพิ่งจัด กลางที่เดียวกัน ตัวหนังสืออยู่ใต้ภาพ
      const madeTray = registry[setTable.trays[parseSet(made.item)?.size ?? size].item];
      const madeHeight = (madeTray?.type === 'local' ? madeTray.height : 32) * TRAY_SCALE * 3;
      const icon = setImage(made.item, 'sx-made__art', '--px', TRAY_SCALE);
      icon.style.top = `${TRAY_CENTER_Y}px`;
      const text = element('b', 'sx-made', `+1 ${made.name}`);
      text.style.top = `${TRAY_CENTER_Y + madeHeight / 2 + 40}px`;
      scene.replaceChildren(chips, note, icon, text);
      return;
    }
    scene.replaceChildren(chips, note, trayArt, ...slots);
    const traySize = trayHeight * TRAY_SCALE * 3;
    if (combo) {
      const pill = element('b', 'sx-combo', t(`combo.${combo}.name` as TextKey));
      pill.style.top = `${TRAY_CENTER_Y - traySize / 2 - 30}px`;
      pill.dataset.combo = combo;
      scene.append(pill);
      const known = gameState.world.sets.combos.includes(combo);
      const line = element('small', 'sx-progress is-combo', t(known ? 'set.known' : 'set.new'));
      line.style.top = `${TRAY_CENTER_Y + traySize / 2 + 34}px`;
      scene.append(line);
      return;
    }
    const line = element('small', `sx-progress${yuck ? ' is-yuck' : ''}`, yuck ? t('set.yuck_warn') : `${pieces.length}/${tray.pieces} ${t('set.progress')}`);
    line.style.top = `${TRAY_CENTER_Y + traySize / 2 + 34}px`;
    line.id = 'set-progress';
    scene.append(line);
  };

  const renderBar = (): void => {
    const tray = setTable.trays[size];
    const have = trayCount(size);
    const box = element('div', 'sx-use');
    if (registry[tray.item]?.type === 'local') box.append(sizedArt(tray.item, 'sx-use__art', '--px2'));
    box.append(
      element('b', 'sx-use__name', `${t('set.use')}${t(`set.tray_name.${size}` as TextKey)} 1`),
      element('small', `sx-use__have${have > 0 ? '' : ' is-short'}`, have > 0 ? `${t('set.owned')} ${have} ${t('set.pieces_unit')}` : t('set.no_tray')),
    );
    const go = element('button', 'ck-go sx-go', t('set.go'));
    go.id = 'set-go';
    go.type = 'button';
    go.disabled = have < 1 || pieces.length < MIN_PIECES;
    go.addEventListener('click', () => {
      const done = makeSet(gameState.world, size, pieces);
      if (!done) return;
      gameState.setWorld(done.world);
      made = { item: done.item, name: itemName(done.item), until: performance.now() + MADE_SHOW_MS };
      pieces = [];
      render();
      window.setTimeout(() => {
        if (made && performance.now() >= made.until) render();
      }, MADE_SHOW_MS + 30);
    });
    bar.replaceChildren(box, go);
  };

  function render(): void {
    renderGrid();
    renderScene();
    renderBar();
  }

  return {
    render,
    reset: () => {
      pieces = [];
      made = null;
      size = TRAY_SIZES.find((option) => trayCount(option) > 0) ?? 'small';
    },
  };
}
