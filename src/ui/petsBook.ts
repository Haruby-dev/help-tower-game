import { registry } from '../core/assets';
import { eventBus } from '../core/events';
import { t } from '../core/i18n';
import { gameState } from '../core/state';
import petsJson from '../data/pets.json';
import type { PetsData } from '../data/schema';
import { at, bookNote, createBook, pageArt } from './book';

const data = petsJson as PetsData;
const WINDOW = 'pets-book';
const PIECES = { cloth: 'book_pet_cloth', frame: 'book_pet_frame_9slice', ribbon: 'book_pet_ribbon' };
const TAPE = 'book_pet_tape';
/** เกตในโซน 1 (ชั้น 1–10) สัตว์ที่เจอหลังเกตเกินนี้ล็อกไว้ก่อน */
const OPEN_GATES = 10;
const CARD_X = 18;
const CARD_STEP = 53;
const CARD_ROWS = [62, 124, 186];
const PER_ROW = 5;

type PetState = 'notmet' | 'unknown' | 'locked';

/**
 * ยังไม่เจอ: เงาบนกระดาษ ไม่มีกรอบทุ่ง (art update 2026-11-07b) กลางที่ x 148 เท้าที่ y 120
 * สัตว์ตัวเล็กขยาย 2 เท่า มูมู่เมฆตัวใหญ่ 1 เท่า บึ้มบึ้มลอยอยู่ เท้าที่ y 110 · "?" อยู่เหนือหัว 30 พิกเซล
 */
const SIL_X = 148;
const SIL_FEET_Y = 120;
const SIL_SCALE: Record<string, number> = { mumu: 1 };
const SIL_FEET: Record<string, number> = { boomboom: 110 };
const SIL_Q_GAP = 30;
const DEFAULT_SIL_SCALE = 2;

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/**
 * สถานะของสัตว์ ระบบสัตว์เลี้ยง (พบ รักษา ย้ายมาอยู่) ยังไม่มา จึงยังไม่มีตัวไหนอยู่ด้วยหรือกำลังรักษา
 * มีภาพแล้ว = ยังไม่เจอ (เงา + เกต N) · ยังไม่มีภาพ = "?" · เกตหลังโซน 1 = ล็อก
 */
function stateOf(pet: PetsData['pets'][number]): PetState {
  if (pet.gate > OPEN_GATES) return 'locked';
  return pet.art ? 'notmet' : 'unknown';
}

/** สมุดดูแลสัตว์ (สมุดมินต์สองหน้า) หน้าซ้ายสัตว์ 15 ตัวตามลำดับเกต หน้าขวาฉากบ้านกับรายละเอียด */
export function createPetsBook(uiRoot: HTMLElement): void {
  const shell = createBook(uiRoot, 'pets-book', 'pets', WINDOW, PIECES);
  let picked = data.pets[0]!.id;

  function render(): void {
    if (!gameState.started) return;
    const living = 0;
    const cards = data.pets.map((pet, index) => {
      const state = stateOf(pet);
      const x = CARD_X + (index % PER_ROW) * CARD_STEP;
      const y = CARD_ROWS[Math.floor(index / PER_ROW)]!;
      const card = at(element('button', `pt-cd is-${state}${pet.id === picked ? ' is-on' : ''}`), x, y);
      card.type = 'button';
      card.dataset.pet = pet.id;
      card.dataset.state = state;
      const picture = state === 'notmet' ? `pets_card_${pet.id}_sil` : state === 'unknown' ? 'pets_card_unknown' : 'pets_card_locked';
      card.append(pageArt(picture, 2, 2, 'pt-pic'));
      if (state === 'unknown') card.append(element('b', 'pt-q', '?'));
      card.append(element('span', `pt-st ${state === 'locked' ? 'lock' : 'no'}`, `${t('pets.gate')} ${pet.gate}`));
      card.addEventListener('click', () => {
        picked = pet.id;
        render();
      });
      return card;
    });
    shell.left.replaceChildren(
      element('div', 'pt-tt', t('pets.title')),
      element('div', 'pt-tc', `${t('pets.living')} ${living}/${data.pets.length} ${t('pets.unit')}`),
      ...cards,
    );

    const pet = data.pets.find((entry) => entry.id === picked)!;
    const state = stateOf(pet);
    if (state === 'locked') {
      shell.right.replaceChildren(
        pageArt('book_pet_padlock', 126, 62, 'bk-lockbig', '', 4),
        element('div', 'bk-lockmsg', t('pets.locked')),
        element('div', 'bk-locksub', `${t('pets.locked_sub')} ${OPEN_GATES + 2} ${t('pets.locked_sub_end')}`),
      );
      return;
    }
    const picture = silhouette(pet.id);
    const nameRow = at(element('div', 'pt-nmrow'), 24, 130);
    nameRow.append(element('span', 'pt-nm', '???'));
    const kind = element('span', 'pt-kd');
    kind.append(element('span', 'pt-pill no', t('pets.not_met')));
    nameRow.append(kind);
    const when = at(element('div', 'pt-row'), 24, 160);
    when.append(element('span', 'pt-lab2', t('pets.will_meet')), element('span', '', `${t('pets.after_gate')} ${pet.gate}`));
    shell.right.replaceChildren(...picture, nameRow, when, bookNote('pt-note', t(pet.art ? 'pets.wait_note' : 'pets.no_art_note'), TAPE, 22, 190));
  }

  /** เงาสัตว์บนกระดาษพร้อม "?" เหนือหัว · สัตว์ที่ยังไม่มีภาพ มีแค่ "?" ตัวใหญ่ */
  function silhouette(id: string): HTMLElement[] {
    const entry = registry[`pets_sil_${id}`];
    if (entry?.type !== 'local') return [element('b', 'pt-q-big', '?')];
    const scale = SIL_SCALE[id] ?? DEFAULT_SIL_SCALE;
    const feet = SIL_FEET[id] ?? SIL_FEET_Y;
    const height = entry.height * scale;
    const art = pageArt(`pets_sil_${id}`, SIL_X - (entry.width * scale) / 2, feet - height, 'pt-sil', '', scale);
    const question = at(element('b', 'pt-q-sil', '?'), 0, feet - height - SIL_Q_GAP);
    return [art, question];
  }

  eventBus.on('app-open', (app) => {
    if (app !== 'pets') return;
    render();
    shell.show();
  });
}
