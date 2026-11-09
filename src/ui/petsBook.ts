import { registry } from '../core/assets';
import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState } from '../core/state';
import petsJson from '../data/pets.json';
import type { PetsData } from '../data/schema';
import { formatMoney } from '../systems/economy';
import { bondLevel, daysToHeal, missingForTreat, pets, petInfo, treatedToday } from '../systems/pets';
import { at, bookNote, createBook, pageArt } from './book';
import { itemName } from './inventory';

const data = petsJson as PetsData;
const WINDOW = 'pets-book';
const PIECES = { cloth: 'book_pet_cloth', frame: 'book_pet_frame_9slice', ribbon: 'book_pet_ribbon' };
const TAPE = 'book_pet_tape';
const CARD_X = 18;
const CARD_STEP = 53;
const CARD_ROWS = [62, 124, 186];
const PER_ROW = 5;

/** ฉากบ้าน 253×100 บนสุดของหน้าขวา แถวข้อมูลเริ่มที่ y นี้ ห่างกันแถวละ ROW_STEP */
const SCENE_X = 22;
const SCENE_Y = 16;
const INFO_TOP = 146;
const ROW_STEP = 17;
const INFO_X = 24;
const HEARTS = 5;
/** สถานะบนการ์ดกับป้ายหน้าขวา: อยู่ด้วย (เขียว) · รักษา (เหลือง) · รอบ้าน (ชมพู) */
const PILL: Record<string, { css: string; label: TextKey }> = {
  living: { css: 'ok', label: 'pets.living_pill' },
  treating: { css: 'heal', label: 'pets.treating' },
  needs_home: { css: 'hurt', label: 'pets.needs_home' },
};

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** สัตว์ที่ผู้เล่นเจอแล้ว (พากลับบ้านจากเกตแล้ว) เรียงตามลำดับในไฟล์ */
function metPets(): PetsData['pets'] {
  return data.pets.filter((pet) => gameState.world.pets[pet.id] !== undefined);
}

/** ชื่อของที่ใช้รักษา (`dish:<สูตร>` คืออาหารสูตรนั้น) */
const needName = (item: string): string => (item.startsWith('dish:') ? t(`dish.${item.slice('dish:'.length)}.name` as TextKey) : itemName(item));

/** สมุดดูแลสัตว์ (สมุดมินต์สองหน้า) หน้าซ้ายสัตว์ที่เจอแล้ว หน้าขวาฉากบ้านกับรายละเอียด */
export function createPetsBook(uiRoot: HTMLElement): void {
  const shell = createBook(uiRoot, 'pets-book', 'pets', WINDOW, PIECES);
  let picked = data.pets[0]!.id;

  function render(): void {
    if (!gameState.started) return;
    // แสดงเฉพาะสัตว์ที่เจอแล้ว ไม่บอกว่ามีกี่ตัวหรือเจอหลังเกตไหน (แก้จากการเล่นจริง 9 พ.ย. 2026 ข้อ A8)
    // ระบบเจอสัตว์มาใน M8b ตอนนี้จึงยังไม่มีตัวไหนเจอ หน้าซ้ายมีแค่ชื่อสมุดกับประโยคเดียว
    const met = metPets();
    if (met.length === 0) {
      shell.left.replaceChildren(element('div', 'pt-tt', t('pets.title')), element('div', 'pt-tc', t('pets.none_yet')));
      shell.right.replaceChildren(bookNote('pt-note', t('pets.none_note'), TAPE, 22, 190));
      return;
    }
    const world = gameState.world;
    const living = met.filter((pet) => world.pets[pet.id]?.stage === 'living').length;
    const cards = met.map((pet, index) => {
      const stage = world.pets[pet.id]!.stage;
      const x = CARD_X + (index % PER_ROW) * CARD_STEP;
      const y = CARD_ROWS[Math.floor(index / PER_ROW)]!;
      const card = at(element('button', `pt-cd is-${stage}${pet.id === picked ? ' is-on' : ''}`), x, y);
      card.type = 'button';
      card.dataset.pet = pet.id;
      card.dataset.state = stage;
      card.append(pageArt(stage === 'living' ? `pets_card_${pet.id}` : `pets_card_${pet.id}_sick`, 2, 2, 'pt-pic'));
      card.append(element('span', `pt-st ${PILL[stage]!.css}`, t(PILL[stage]!.label)));
      card.addEventListener('click', () => {
        picked = pet.id;
        render();
      });
      return card;
    });
    shell.left.replaceChildren(
      element('div', 'pt-tt', t('pets.title')),
      element('div', 'pt-tc', `${t('pets.living')} ${living} ${t('pets.unit')}`),
      ...cards,
    );

    const pet = met.find((entry) => entry.id === picked) ?? met[0]!;
    shell.right.replaceChildren(...details(pet));
  }

  /**
   * หน้าขวาของสัตว์ที่เจอแล้ว: ฉากบ้าน ชื่อกับสถานะ แล้วแถวข้อมูล
   * รักษาอยู่: อาการ ของที่ใช้ (มี/ต้องใช้) วันที่รักษาแล้ว วันนี้ทำแล้วหรือยัง · รอบ้าน: บ้านที่ต้องซื้อกับราคา
   * อยู่ด้วย: หัวใจผูกพัน 1–5 กับแต้ม วันนี้ให้อาหารและลูบแล้วหรือยัง ผลผลิต
   */
  function details(pet: PetsData['pets'][number]): HTMLElement[] {
    const world = gameState.world;
    const state = world.pets[pet.id]!;
    const care = petInfo(pet.id)?.care;
    const nodes: HTMLElement[] = [];
    const scene = registry[`pets_scene_${pet.id}`]?.type === 'local' ? `pets_scene_${pet.id}` : null;
    if (scene) nodes.push(pageArt(scene, SCENE_X, SCENE_Y, 'pt-scene'));
    const nameRow = at(element('div', 'pt-nmrow'), INFO_X, INFO_TOP - 22);
    nameRow.append(element('span', 'pt-nm', t(`pet.${pet.id}.name` as TextKey)));
    const pill = PILL[state.stage]!;
    nameRow.append(element('span', `pt-pill ${pill.css}`, t(pill.label)));
    nodes.push(nameRow);
    const rows: [string, string][] = [];
    if (state.stage === 'treating') {
      rows.push([t('pets.symptom'), t(`pet.${pet.id}.symptom` as TextKey)]);
      if (care?.bath) rows.push([t('pets.treat_with'), t('pets.bath_treat')]);
      else {
        const missing = new Map(missingForTreat(world, pet.id).map((row) => [row.item, row.have]));
        const parts = Object.entries(care?.treat ?? {}).map(([item, need]) => `${needName(item)} ${Math.min(need, missing.get(item) ?? need)}/${need}`);
        rows.push([t('pets.treat_with'), `${parts.join(' · ')} (${t('pets.once_a_day')})`]);
      }
      rows.push([t('pets.days_label'), `${state.treatedDays}/${daysToHeal(pet.id, state)} ${t('pets.days')}`]);
      rows.push([t('pets.today'), t(treatedToday(world, pet.id) ? 'pets.today_done' : 'pets.today_todo')]);
      if (care?.home && pet.homePrice !== null) rows.push([t('pets.home_need'), `${itemName(care.home)} ${formatMoney(pet.homePrice)}`]);
    } else if (state.stage === 'needs_home' && care?.home) {
      rows.push([t('pets.home_need'), `${itemName(care.home)} ${formatMoney(pet.homePrice ?? 0)}`]);
    } else {
      const level = bondLevel(state.bond);
      const next = pets.bondLevels[level - 1];
      rows.push([t('pets.bond'), `${'♥'.repeat(level)}${'♡'.repeat(HEARTS - level)} ${state.bond}${next !== undefined ? `/${next}` : ''}`]);
      const fed = state.fedDay === world.day ? '✓' : '·';
      const petted = state.pettedDay === world.day ? '✓' : '·';
      rows.push([t('pets.today'), `${t('pets.fed')} ${fed}  ${t('pets.petted')} ${petted}`]);
      if (care?.produce) rows.push([t('pets.produce'), `${itemName(care.produce)} ${pets.produceByLevel[level - 1] ?? 1} ${t('pets.per_day')}`]);
      else rows.push([t('pets.produce'), t(`pet.${pet.id}.helps` as TextKey)]);
    }
    rows.forEach(([label, value], index) => {
      const row = at(element('div', 'pt-row'), INFO_X, INFO_TOP + index * ROW_STEP);
      row.dataset.row = String(index);
      row.append(element('span', 'pt-lab2', label), element('span', '', value));
      nodes.push(row);
    });
    return nodes;
  }

  eventBus.on('app-open', (app) => {
    if (app !== 'pets') return;
    render();
    shell.show();
  });
}
