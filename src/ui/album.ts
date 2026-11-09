import { registry } from '../core/assets';
import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState, type World } from '../core/state';
import shopJson from '../data/shop.json';
import type { ShopData } from '../data/schema';
import { affectionPercent, barOwner, floorOpen, hasMet, isCleared, monsterTable, tasteKnown, twinA, twinB } from '../systems/monsters';
import { tasteOfTreat } from '../systems/shop';
import { at, bookArrow, bookNote, bookTab, createBook, pageArt } from './book';
import { artUrl } from './pixelArt';
import { uiSound } from './sound';

const shop = shopJson as ShopData;
const WINDOW = 'album';
const PIECES = { cloth: 'book_album_cloth', frame: 'book_album_frame_9slice', ribbon: 'book_album_ribbon' };
const TAB = 'book_album_tab';
const TAB_ON = 'book_album_tab_active';
const TAPE = 'book_album_tape';
/** ตำแหน่งรูปจีโอสี่รสบนหน้าซ้าย เยื้องกันเล็กน้อย ไม่หมุน (album_book) */
const POLAROID_SPOTS: [number, number][] = [
  [64, 78],
  [170, 84],
  [64, 164],
  [170, 170],
];
const FLOORS_PER_ZONE = 10;
const ZONES = 10;
/** โซนที่เปิดในเกมตอนนี้ ชั้น 11–100 ล็อกไว้ก่อน */
const OPEN_ZONES = 1;
const SLOT_X = 18;
const SLOT_STEP = 53;
const SLOT_ROWS = [80, 152];
const TASTE_SLOTS = 3;
const TIP_MS = 1800;

type Tab = 'gio' | 'monsters';

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const flavourOf = (item: string): string => item.slice('treat_'.length);

/** มอนสเตอร์ประจำชั้น (แฝดชั้น 5 ใช้ช่องเดียว รหัสของพี่) */
const ownerOfFloor = (floor: number): string | null =>
  Object.entries(monsterTable).find(([, monster]) => monster.floor === floor && !monster.twinOf)?.[0] ?? null;

/** เคยมาเยี่ยมแล้ว: มีความชอบ เคยได้กินหรืองอน หรือเคยโผล่มาแล้ว · แฝดนับรวมทั้งสองตัว */
function visited(world: World, id: string): boolean {
  const ids = id === twinA ? [twinA, twinB] : [id];
  return ids.some((one) => hasMet(world, one));
}

type SlotState = 'friend' | 'met' | 'unknown' | 'locked';

function slotState(world: World, id: string | null, zone: number): SlotState {
  if (zone > OPEN_ZONES || !id) return 'locked';
  if (isCleared(world, id)) return 'friend';
  return visited(world, id) ? 'met' : 'unknown';
}

/** รูปช่องเล็ก · แฝดหลังเฉลยเป็นรูปเซลฟี่สองตัว */
function smallPhoto(world: World, id: string, state: SlotState): string {
  if (state === 'locked') return 'album_mpol_s_locked';
  if (state === 'unknown') return 'album_mpol_s_unknown';
  if (id === twinA && world.monsters.twins.revealed) return 'album_mpol_s_selfie';
  return state === 'friend' ? `album_mpol_s_${id}` : `album_mpol_s_${id}_met`;
}

/** อัลบั้มจีโอ (สมุดชมพูสองหน้า) แท็บ จีโอ กับ มอนสเตอร์ · แท็บมอนสเตอร์คือสมุดมอนสเตอร์ ไม่มีแอปแยก */
export function createAlbum(uiRoot: HTMLElement): void {
  const shell = createBook(uiRoot, 'album-book', 'album', WINDOW, PIECES);
  let tab: Tab = 'gio';
  let flavour: string = shop.treats[0]!.item;
  let zone = 1;
  let floor = 1;
  let twinFur: 'a' | 'b' = 'a';
  let tipTimer = 0;

  const tabs = (): HTMLElement => {
    const row = element('div', 'bk-tabs');
    for (const [id, label] of [
      ['gio', 'album.tab_gio'],
      ['monsters', 'album.tab_monsters'],
    ] as const) {
      const button = bookTab(t(label), tab === id, TAB, TAB_ON);
      button.dataset.albumTab = id;
      button.addEventListener('click', () => {
        if (tab !== id) uiSound('ui_page');
        tab = id;
        render();
      });
      row.append(button);
    }
    return row;
  };

  // ---------------------------------------------------------------- แท็บจีโอ
  function renderGio(world: World): void {
    const seen = world.gio.album;
    const count = shop.treats.filter((treat) => seen.includes(treat.item)).length;
    const polaroids = shop.treats.map(({ item }, index) => {
      const [x, y] = POLAROID_SPOTS[index] ?? [64, 78];
      const open = seen.includes(item);
      const card = at(element('button', `al-pol${item === flavour ? ' is-on' : ''}${open ? '' : ' is-locked'}`), x, y);
      card.type = 'button';
      card.dataset.album = item;
      card.setAttribute('aria-label', open ? t(`album.flavour_${flavourOf(item)}` as TextKey) : t('album.locked'));
      card.append(pageArt(open ? `album_polaroid_treat_${flavourOf(item)}` : 'album_polaroid_locked', 0, 0, 'al-pol__photo'));
      if (!open) card.append(element('span', 'al-q', '?'));
      card.append(pageArt(TAPE, 24, -4), element('span', `al-cap${open ? '' : ' lk'}`, open ? t(`album.flavour_${flavourOf(item)}` as TextKey) : t('album.locked')));
      card.append(pageArt(item, 50, 50, 'al-pk'));
      card.addEventListener('click', () => {
        flavour = item;
        render();
      });
      return card;
    });
    shell.left.replaceChildren(
      tabs(),
      element('div', 'al-title', t('album.title')),
      element('div', 'al-count', t('album.count').replace('{n}', String(count)).replace('{total}', String(shop.treats.length))),
      ...polaroids,
    );

    const open = seen.includes(flavour);
    const big = at(element('div', 'al-big'), 22, 32);
    big.append(pageArt(open ? `album_polaroid_treat_${flavourOf(flavour)}` : 'album_polaroid_locked', 0, 0, 'al-big__photo', '', 2));
    if (!open) big.append(element('span', 'al-bq', '?'));
    big.append(pageArt('ui_gio_receipt_washi_tape', 38, -6), element('span', 'al-bcap', open ? t('album.hearts') : t('album.locked')));
    const side = at(element('div', 'al-side'), 166, 30);
    side.append(element('div', 'al-kind', t('album.kind_treat')), element('div', 'al-name', open ? t(`album.flavour_${flavourOf(flavour)}` as TextKey) : t('album.locked')));
    const taste = tasteOfTreat(flavour);
    if (open && taste) side.append(element('div', 'al-tag', t(`album.taste_${taste}` as TextKey)));
    const packet = element('div', 'al-pkrow');
    packet.append(pageArt(flavour, 0, 0, 'al-pk-static'), element('span', '', t('album.sold_daily')));
    side.append(packet);
    shell.right.replaceChildren(big, side, bookNote('al-note', open ? t(`album.note_${flavourOf(flavour)}` as TextKey) : t('album.note_locked'), TAPE, 22, 200));
  }

  // ---------------------------------------------------------------- แท็บมอนสเตอร์ (สมุดมอนสเตอร์)
  function renderMonsters(world: World): void {
    const firstFloor = (zone - 1) * FLOORS_PER_ZONE + 1;
    const owners = Array.from({ length: FLOORS_PER_ZONE }, (_, index) => ownerOfFloor(firstFloor + index));
    const friends = owners.filter((id) => id && zone <= OPEN_ZONES && floorOpen(world, id)).length;
    const slots = owners.map((id, index) => {
      const number = firstFloor + index;
      const state = slotState(world, id, zone);
      const x = SLOT_X + (index % 5) * SLOT_STEP;
      const y = SLOT_ROWS[Math.floor(index / 5)]!;
      const slot = at(element('button', `al-mp is-${state}${number === floor ? ' is-on' : ''}`), x, y);
      slot.type = 'button';
      slot.dataset.floor = String(number);
      slot.dataset.state = state;
      slot.append(pageArt(id ? smallPhoto(world, id, state) : 'album_mpol_s_locked', 0, 0, 'al-mp__photo'));
      if (state === 'unknown') slot.append(element('span', 'al-mq', '?'));
      slot.append(pageArt(TAPE, 17, -4), element('span', `al-mcap${state === 'friend' || state === 'met' ? '' : ' soft'}`, `${t('stuck.floor')} ${number}`));
      slot.addEventListener('click', () => {
        floor = number;
        render();
      });
      return slot;
    });
    const pager = element('div', 'al-pager');
    pager.append(
      bookArrow('album-zone-prev', 'book_album_arrow_left', t('book.prev'), () => turnZone(-1), zone <= 1),
      element('span', '', `${t('album.zone')} ${zone} / ${ZONES}`),
      bookArrow('album-zone-next', 'book_album_arrow_right', t('book.next'), () => turnZone(1), zone >= ZONES),
    );
    shell.left.replaceChildren(
      tabs(),
      element('div', 'al-title', zone <= OPEN_ZONES ? `${t('album.zone')} ${zone} · ${t(`album.zone_${zone}` as TextKey)}` : `${t('album.zone')} ${zone} · ???`),
      element('div', 'al-count', `${t('album.friends')} ${friends}/${FLOORS_PER_ZONE} ${t('album.friends_unit')}`),
      ...slots,
      pager,
    );

    const id = owners[(floor - firstFloor + FLOORS_PER_ZONE) % FLOORS_PER_ZONE] ?? null;
    const state = slotState(world, id, zone);
    if (state === 'locked' || !id) {
      shell.right.replaceChildren(
        pageArt('book_album_padlock', 126, 62, 'bk-lockbig', '', 4),
        element('div', 'bk-lockmsg', t('album.zone_locked')),
        element('div', 'bk-locksub', t('album.zone_locked_sub')),
      );
      return;
    }
    renderMonsterDetail(world, id, state);
  }

  function renderMonsterDetail(world: World, id: string, state: SlotState): void {
    const monster = monsterTable[id]!;
    const twins = id === twinA;
    const revealed = twins && world.monsters.twins.revealed;
    const big = at(element('div', 'al-big al-big--monster'), 22, 30);
    if (state === 'friend') big.append(pageArt(revealed ? 'album_mpol_b_selfie' : `album_mpol_b_${id}`, 0, 0, 'al-big__photo', '', 2));
    else if (state === 'met' && registry[`album_mpol_b_${id}_met`]) big.append(pageArt(`album_mpol_b_${id}_met`, 0, 0, 'al-big__photo', '', 2));
    else big.append(pageArt(state === 'met' ? `album_mpol_s_${id}_met` : 'album_mpol_s_unknown', 14, 18, 'al-big__photo', '', 2));
    if (state === 'unknown') big.append(element('span', 'al-bq al-bq--monster', '?'));
    const caption = state === 'friend' ? (revealed ? 'album.caption_twins' : twins ? 'album.caption_twins_before' : 'album.caption_friend') : state === 'met' ? 'album.caption_met' : 'album.caption_unknown';
    big.append(pageArt('ui_gio_receipt_washi_tape', 38, -6), element('span', 'al-bcap al-bcap--monster', t(caption)));

    const side = at(element('div', 'al-mside'), 162, revealed ? 22 : 28);
    const known = state !== 'unknown';
    side.append(element('div', 'al-nm', known ? t(`monster.${id}.name` as TextKey) : '???'));
    const kind = element('div', 'al-kd', `${t('stuck.floor')} ${monster.floor} · ${known ? t(`monster.${id}.kind` as TextKey) : '???'}`);
    kind.append(document.createElement('br'), known ? t(`monster.${id}.trait` as TextKey) : '???');
    side.append(kind);
    // หลังเฉลยมีปุ่มสลับดูรสนิยมของแฝดแต่ละตัว
    const tasteOwner = revealed && twinFur === 'b' ? twinB : id;
    if (revealed) {
      const toggle = element('div', 'al-tg');
      for (const [fur, label] of [
        ['a', 'album.twin_a'],
        ['b', 'album.twin_b'],
      ] as const) {
        const button = element('button', fur === twinFur ? 'is-on' : '', t(label));
        button.type = 'button';
        button.dataset.twin = fur;
        button.addEventListener('click', () => {
          twinFur = fur;
          render();
        });
        toggle.append(button);
      }
      side.append(toggle);
    }
    if (known) {
      const percent = Math.floor(affectionPercent(world, revealed ? tasteOwner : barOwner(world, id)));
      const bar = element('div', 'al-aff');
      const track = element('span', 'al-bar');
      const fill = element('i', '');
      fill.style.width = `${percent}%`;
      track.append(fill);
      bar.append(element('b', 'al-hrt', '♥'), track, `${percent}%`);
      side.append(bar);
      const owner = monsterTable[tasteOwner]!;
      const tip = element('div', 'al-tip');
      const row = (label: TextKey, recipesOf: string[]): HTMLElement => {
        const line = element('div', 'al-tr');
        line.append(element('span', 'al-tl', t(label)));
        for (const recipe of recipesOf.slice(0, TASTE_SLOTS)) {
          const slot = element('button', 'al-sl');
          slot.type = 'button';
          slot.style.backgroundImage = `url("${artUrl('book_album_slot')}")`;
          if (tasteKnown(world, tasteOwner, recipe)) {
            const entry = registry[`mini16_${recipe}`];
            const width = entry?.type === 'local' ? entry.width : 16;
            const height = entry?.type === 'local' ? entry.height : 16;
            slot.append(pageArt(`mini16_${recipe}`, Math.floor((22 - width) / 2), Math.floor((22 - height) / 2)));
            slot.dataset.recipe = recipe;
            slot.setAttribute('aria-label', t(`dish.${recipe}.name` as TextKey));
            slot.addEventListener('click', () => {
              tip.textContent = t(`dish.${recipe}.name` as TextKey);
              window.clearTimeout(tipTimer);
              tipTimer = window.setTimeout(() => {
                tip.textContent = '';
              }, TIP_MS);
            });
          } else {
            slot.append(element('b', 'al-qq', '?'));
            slot.setAttribute('aria-label', t('album.taste_unknown'));
          }
          line.append(slot);
        }
        return line;
      };
      side.append(row('album.favourite', [...owner.favourite, owner.favouriteDrink]), row('album.like', owner.likes), row('album.dislike', owner.dislikes), tip);
    }
    const noteText = (): string => {
      if (state === 'unknown') return t('album.note_unknown');
      if (state === 'met') return t('album.note_met');
      if (revealed) return t('album.note_twins');
      return t(`monster.${id}.clear` as TextKey);
    };
    const quote = state === 'friend' ? `“${noteText()}”` : noteText();
    shell.right.replaceChildren(big, side, bookNote('al-mnote', quote, TAPE, 22, 202));
  }

  function turnZone(step: number): void {
    const next = Math.min(ZONES, Math.max(1, zone + step));
    if (next === zone) return;
    uiSound('ui_page');
    zone = next;
    floor = (zone - 1) * FLOORS_PER_ZONE + 1;
    render();
  }

  function render(): void {
    if (!gameState.started) return;
    const world = gameState.world;
    if (tab === 'gio') renderGio(world);
    else renderMonsters(world);
  }

  eventBus.on('app-open', (app) => {
    if (app !== 'album') return;
    render();
    shell.show();
  });
  eventBus.on('world-changed', () => {
    if (shell.isOpen()) render();
  });
}
