import { footY } from '../core/assets';
import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState, type World } from '../core/state';
import gatesJson from '../data/gates.json';
import type { GatesData } from '../data/schema';
import { affectionPercent, barOwner, floorOpen, monsterTable } from '../systems/monsters';
import { at, bookArrow, bookNote, createBook, pageArt } from './book';
import { artUrl } from './pixelArt';
import { uiSound } from './sound';

const data = gatesJson as GatesData;
const WINDOW = 'gate-book';
const PIECES = { cloth: 'book_gate_cloth', frame: 'book_gate_frame_9slice', ribbon: 'book_gate_ribbon' };
const TAPE = 'book_gate_tape';
const FLOORS = 10;
const ZONES = 10;
const OPEN_ZONES = 1;
/** ภาพหอคอย 170×208 ชั้น 1 อยู่ล่างสุด แต่ละชั้นสูง 20 พิกเซล เริ่มที่แถว 6 ของภาพ (gate_parts.py) */
const TOWER_X = 64;
const TOWER_Y = 46;
const TOWER_TOP = 6;
const FLOOR_PX = 20;
/** หน้าขวา: มอนสเตอร์ประจำชั้นยืนบนกระดาษ ไม่มีกรอบฉาก (art update 2026-11-07b) กลางที่ x 148 เท้าที่ y 118 */
const OWNER_X = 148;
const OWNER_FEET_Y = 118;
/** ชั้นที่ยังไม่เปิด: กุญแจอย่างเดียวในที่เดียวกัน ขยาย 2 เท่า */
const LOCK_SCALE = 2;
const LOCK_CENTRE_Y = 76;
const LABEL_X = 92;
const DOT_X = 210;

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const ownerOf = (floor: number): string | null =>
  Object.entries(monsterTable).find(([, monster]) => monster.floor === floor && !monster.twinOf)?.[0] ?? null;

/** ประตูชั้นนี้เปิดแล้ว (มอนสเตอร์ประจำชั้นชอบครบ 100%) */
const opened = (world: World, floor: number): boolean => {
  const owner = ownerOf(floor);
  return owner !== null && floorOpen(world, owner);
};

const met = (world: World, id: string): boolean =>
  world.monsters.affection[id] !== undefined || world.monsters.arrivals.some((arrival) => arrival.monster === id && arrival.done);

/** แผนที่หอคอย (สมุดม่วงลาเวนเดอร์สองหน้า) ดูข้อมูลอย่างเดียว เข้าเกตที่ลานเกต */
export function createGateBook(uiRoot: HTMLElement): void {
  const shell = createBook(uiRoot, 'gate-book', 'gate', WINDOW, PIECES);
  let zone = 1;
  let floor = 1;

  const labelTop = (index: number): number => TOWER_Y + TOWER_TOP + (FLOORS - 1 - index) * FLOOR_PX + 4;

  function renderLeft(world: World): void {
    const first = (zone - 1) * FLOORS + 1;
    const title = element('div', 'gt-tt');
    title.append(
      bookArrow('gate-zone-prev', 'book_gate_arrow_left', t('book.prev'), () => turn(-1), zone <= 1),
      element('span', '', `${t('gate.tower')} · ${t('album.zone')} ${zone}`),
      bookArrow('gate-zone-next', 'book_gate_arrow_right', t('book.next'), () => turn(1), zone >= ZONES),
    );
    const parts: HTMLElement[] = [title];
    if (zone > OPEN_ZONES) {
      parts.push(element('div', 'gt-ts', `??? · ${t('stuck.floor')} ${first}–${first + FLOORS - 1}`), pageArt('gate_tower_locked', TOWER_X, TOWER_Y, 'gt-tower'));
      for (let index = 0; index < FLOORS; index += 1) parts.push(at(element('span', 'gt-fl dk', `${t('stuck.floor')} ${first + index}`), LABEL_X, labelTop(index)));
      shell.left.replaceChildren(...parts);
      return;
    }
    const openCount = Array.from({ length: FLOORS }, (_, index) => opened(world, first + index)).filter(Boolean).length;
    const summary = element('div', 'gt-ts');
    const weather = data.zones.find((entry) => entry.zone === zone)?.weather ?? 'ui_weather_sun';
    summary.append(`${t(`gate.zone_${zone}` as TextKey)} · ${t('gate.opened')} ${openCount}/${FLOORS} · `);
    summary.append(element('span', 'gt-gold', '●'), ` ${t('gate.forage_left')}`);
    parts.push(summary, pageArt(weather, 26, 52, 'gt-weather die-page'), pageArt('gate_tower_locked', TOWER_X, TOWER_Y, 'gt-tower'));
    for (let index = 0; index < FLOORS; index += 1) {
      const number = first + index;
      const open = opened(world, number);
      // ชั้นที่เปิดแล้ว: ตัดแถวชั้นนั้นจากภาพหอคอยที่วาดเปิดไว้ครบ 10 ชั้น
      if (open) {
        const strip = at(element('i', 'gt-open'), TOWER_X, TOWER_Y + TOWER_TOP + (FLOORS - 1 - index) * FLOOR_PX);
        strip.style.backgroundImage = `url("${artUrl('gate_tower_zone1')}")`;
        strip.style.backgroundPosition = `0 ${-(TOWER_TOP + (FLOORS - 1 - index) * FLOOR_PX)}px`;
        parts.push(strip);
      }
      const label = at(element('button', `gt-fl${open ? '' : ' dk'}`, `${t('stuck.floor')} ${number}`), LABEL_X, labelTop(index));
      label.type = 'button';
      label.dataset.floor = String(number);
      label.addEventListener('click', () => {
        floor = number;
        render();
      });
      parts.push(label);
      // ของป่าเก็บได้ทุกวัน: ระบบเข้าเกตยังไม่มา จึงยังไม่เคยเก็บ จุดทองเสมอ
      if (open) parts.push(at(element('i', 'gt-dot'), DOT_X, labelTop(index) + 4));
    }
    parts.push(at(element('i', 'gt-sel'), TOWER_X + 4, labelTop(floor - first) - 6));
    shell.left.replaceChildren(...parts);
  }

  function renderRight(world: World): void {
    if (zone > OPEN_ZONES) {
      shell.right.replaceChildren(
        pageArt('book_gate_padlock', 126, 62, 'bk-lockbig', '', 4),
        element('div', 'bk-lockmsg', t('album.zone_locked')),
        element('div', 'bk-locksub', t('album.zone_locked_sub')),
      );
      return;
    }
    const gate = data.gates.find((entry) => entry.floor === floor)!;
    const owner = ownerOf(floor);
    const open = opened(world, floor);
    // ภาพฉากเกต (gate.scene) พักไว้ ไม่แสดงตอนนี้ (ผู้ใช้ตัดสิน) ไฟล์ยังอยู่
    void gate;
    const picture = open && owner ? ownerStand(owner) : padlock();
    const name = at(element('div', 'gt-nmrow', `${t('stuck.floor')} ${floor}`), 24, 128);
    name.append(element('b', '', open ? t(`gate.${floor}.name` as TextKey) : '???'));
    const row = (top: number, label: TextKey, ...content: (Node | string)[]): HTMLElement => {
      const line = at(element('div', 'gt-row'), 24, top);
      line.append(element('span', 'gt-lab', t(label)), ...content);
      return line;
    };
    const ownerKnown = owner !== null && met(world, owner);
    const ownerName = owner && ownerKnown ? t(`monster.${owner}.name` as TextKey) : '???';
    const percent = owner && ownerKnown ? Math.floor(affectionPercent(world, barOwner(world, owner))) : null;
    const ownerRow = row(164, 'gate.owner', `${ownerName} `);
    if (percent !== null) ownerRow.append(element('span', percent >= 100 ? 'gt-ok' : 'gt-soft', `♥ ${percent}%`));
    // รางวัลครั้งแรกได้ตอนเข้าเกตครั้งแรก ระบบเข้าเกตยังไม่มา จึงยังเป็น ???
    const reward = row(182, 'gate.reward', element('span', 'gt-soft', '???'));
    const forage = row(202, 'gate.forage', open ? `${t(`gate.${floor}.forage` as TextKey)} ` : '???');
    if (open) forage.append(element('span', 'gt-gold-text', `● ${t('gate.forage_ready')}`));
    const note = open ? `${t('gate.note')} ${data.stayHours} ${t('gate.note_hours')}` : t('gate.note_shut');
    shell.right.replaceChildren(picture, name, ownerRow, reward, forage, bookNote('gt-note', note, TAPE, 22, 222));
  }

  /** เฟรมแรก (หันหน้าลง) ของท่ายืนตอนหวาน ขนาดจริง ชั้น 5 เป็นแฝดพี่ */
  function ownerStand(owner: string): HTMLElement {
    const art = monsterTable[owner]!.art!;
    const sheet = `${art.sheet}_sweet_stand`;
    const line = art.feetRow !== undefined ? art.feetRow + 1 : footY(sheet);
    const frame = at(element('i', 'gt-owner'), OWNER_X - art.frame / 2, OWNER_FEET_Y - line);
    frame.dataset.art = sheet;
    frame.style.width = `${art.frame}px`;
    frame.style.height = `${art.frame}px`;
    frame.style.backgroundImage = `url("${artUrl(sheet)}")`;
    frame.style.backgroundSize = `${art.frame * 4}px ${art.frame}px`;
    return frame;
  }

  function padlock(): HTMLElement {
    const lock = pageArt('book_gate_padlock', 0, 0, 'gt-lock', '', LOCK_SCALE);
    return at(lock, OWNER_X - (11 * LOCK_SCALE) / 2, LOCK_CENTRE_Y - (13 * LOCK_SCALE) / 2);
  }

  function turn(step: number): void {
    const next = Math.min(ZONES, Math.max(1, zone + step));
    if (next === zone) return;
    uiSound('ui_page');
    zone = next;
    floor = (zone - 1) * FLOORS + 1;
    render();
  }

  function render(): void {
    if (!gameState.started) return;
    renderLeft(gameState.world);
    renderRight(gameState.world);
  }

  eventBus.on('app-open', (app) => {
    if (app !== 'gate') return;
    render();
    shell.show();
  });
}
