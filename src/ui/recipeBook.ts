import { registry } from '../core/assets';
import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState } from '../core/state';
import recipeSteps from '../data/recipe_steps.json';
import type { Recipe } from '../data/schema';
import { recipes } from '../systems/cooking';
import { at, bookArrow, bookNote, bookTab, createBook, pageArt, type BookPieces } from './book';
import { itemName } from './inventory';
import { artUrl, sizedArt } from './pixelArt';
import { setTable } from '../systems/sets';
import { uiSound } from './sound';

type Category = Recipe['category'];
const TABS: { id: Category; label: TextKey }[] = [
  { id: 'savory', label: 'recipe.tab_savory' },
  { id: 'sweet', label: 'recipe.tab_sweet' },
  { id: 'drink', label: 'recipe.tab_drink' },
];
const WINDOW = 'recipe-book';
const NOTES: Partial<Record<string, TextKey>> = { home_kaprao: 'book.kaprao_note' };
/** อาหารร้อนมีไอลอย ของหวานกับเครื่องดื่มเย็นไม่มี */
const HOT_DRINKS = new Set(['warm_honey_milk', 'basil_tea']);
const STAR_SLOTS = 3;
const DOT_WINDOW = 8;
const PAGE_WIDTH = 297;
const SLOT_PX = 22;
const SLOT_GAP = 5;
const steps = recipeSteps as Record<string, string[]>;
/** หน้าชุดที่เคยจัด (ขั้นที่ 6) ใช้สีของหมวดคาว · ซ้าย 8 ชุดแรก ขวาที่เหลือ แถวละ 19 พิกเซล */
const SETS_PAGE = '@sets';
const SETS_THEME: Category = 'savory';
const SETS_LEFT = 8;
const SET_ROW_PX = 19;
const ORDER = Object.keys(recipes);

const book = (name: string): string => `ui_book_${name}`;
const themed = (name: string, theme: Category): string => book(`${name}_${theme}`);
const piecesFor = (theme: Category): BookPieces => ({ cloth: themed('book_cloth', theme), frame: book(`book_frame_${theme}_9slice`), ribbon: themed('book_ribbon', theme) });

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** แผ่นภาพหลายเฟรมเรียงแนวนอน เล่นด้วย steps() ใน CSS */
function sheet(className: string, id: string, frames: number, x: number, y: number): HTMLElement {
  const entry = registry[book(id)];
  if (entry?.type !== 'local') throw new Error(`${id} is not registered`);
  const node = at(element('i', `rb-sheet ${className}`), x, y);
  node.style.backgroundImage = `url("${artUrl(book(id))}")`;
  node.style.width = `${entry.width / frames}px`;
  node.style.height = `${entry.height}px`;
  node.style.setProperty('--sheet', `${entry.width}px`);
  return node;
}

const dishIcon = (recipe: Recipe): string | null => (recipe.icon && registry[recipe.icon] ? recipe.icon : null);

/**
 * สมุดสูตรเก่าแบบสองหน้า (recipe_book_spread2) ไม่มีชื่อเจ้าของจนกว่าจะถึงบทที่ 9
 * หน้าซ้าย: แท็บ ชื่อเมนู ภาพอาหาร ดาว วัตถุดิบ · หน้าขวา: เลขสูตร วิธีทำ โน้ต ลูกศรเปลี่ยนหน้า
 */
export function createRecipeBook(uiRoot: HTMLElement): void {
  const shell = createBook(uiRoot, 'recipe-book', 'recipe', WINDOW, piecesFor('savory'));
  const [leftPage] = shell.pages;
  leftPage.classList.add('book-page');

  let current = 'home_kaprao';

  const pageOf = (id: string): { list: string[]; index: number } => {
    const list = ORDER.filter((candidate) => recipes[candidate]?.category === recipes[id]?.category);
    return { list, index: list.indexOf(id) };
  };

  const go = (id: string): void => {
    if (id !== current) uiSound('ui_page');
    current = id;
    render();
  };

  const turn = (step: number): void => {
    if (current === SETS_PAGE) return;
    const { list, index } = pageOf(current);
    go(list[(index + step + list.length) % list.length]!);
  };

  function dish(recipe: Recipe, id: string, known: boolean, theme: Category): HTMLElement[] {
    const halo = pageArt(themed('book_dish_halo', theme), 112, 74, 'rb-halo');
    const sparkles = ([
      [118, 84],
      [172, 94],
      [164, 128],
    ] as const).map(([x, y], index) => sheet(`book-sparkle book-sparkle--${index}`, 'book_dish_sparkle_8f', 8, x, y));
    const icon = dishIcon(recipe);
    if (!known) {
      const silhouette = at(element('i', 'rb-silhouette'), 124, 86);
      if (icon) silhouette.style.setProperty('--icon', `url("${artUrl(icon)}")`);
      return [halo, silhouette, at(element('b', 'rb-question', '?'), 124, 86), ...sparkles];
    }
    const shadow = sheet('book-shadow', 'book_dish_shadow_8f', 8, 128, 128);
    const float = element('div', 'book-float');
    if (icon) float.append(pageArt(icon, 124, 86, 'rb-dish'));
    else float.append(at(element('i', 'rb-dish item-missing', t(`dish.${id}.name` as TextKey)), 124, 86));
    if (recipe.category === 'savory' || HOT_DRINKS.has(id)) float.append(sheet('book-steam', 'book_dish_steam_8f', 8, 142, 74));
    return [halo, shadow, float, ...sparkles];
  }

  function ingredients(recipe: Recipe, known: boolean, theme: Category): HTMLElement {
    const row = at(element('div', 'rb-slots'), 0, 204);
    const items = Object.entries(recipe.ingredients);
    const start = Math.round((PAGE_WIDTH - (items.length * (SLOT_PX + SLOT_GAP) - SLOT_GAP)) / 2);
    items.forEach(([item, count], index) => {
      const slot = pageArt(themed(known ? 'book_ing_slot' : 'book_ing_slot_locked', theme), start + index * (SLOT_PX + SLOT_GAP), 0, 'rb-slot');
      const holder = at(element('span', 'rb-slot-holder'), start + index * (SLOT_PX + SLOT_GAP), 0);
      holder.dataset.ingredient = item;
      if (known) {
        const miniId = `ing_mini_${item.toLowerCase()}`;
        const mini = registry[miniId];
        if (mini?.type === 'local') holder.append(pageArt(miniId, 11 - Math.floor(mini.width / 2), 10 - Math.floor(mini.height / 2), 'rb-ing'));
        else holder.append(element('small', 'rb-ing-label', itemName(item)));
        if (count > 1) {
          const badge = pageArt(themed('book_count_badge', theme), 13, 15, 'rb-badge');
          const number = at(element('b', 'rb-badge-n', String(count)), 13, 15);
          holder.append(badge, number);
        }
      }
      row.append(slot, holder);
    });
    return row;
  }

  /** แถบแท็บ คาว หวาน เครื่องดื่ม ชุด (แท็บชุดใช้สีของหมวดคาว) */
  function tabRow(theme: Category): HTMLElement {
    const tabs = element('div', 'bk-tabs');
    for (const { id, label } of TABS) {
      const tab = bookTab(t(label), current !== SETS_PAGE && id === theme, themed('book_tab', theme), themed('book_tab_active', theme));
      tab.dataset.bookTab = id;
      tab.addEventListener('click', () => go(ORDER.find((candidate) => recipes[candidate]?.category === id)!));
      tabs.append(tab);
    }
    const sets = bookTab(t('book.sets_tab'), current === SETS_PAGE, themed('book_tab', theme), themed('book_tab_active', theme));
    sets.dataset.bookTab = 'set';
    sets.addEventListener('click', () => go(SETS_PAGE));
    tabs.append(sets);
    return tabs;
  }

  /** แถวชุดหนึ่งแถว: ถาดสานจิ๋ว ชื่อชุด (ยังไม่เคยจัดเป็น ? ? ?) ขนาดถาดกับจำนวนชิ้น */
  function setRow(combo: string, y: number): HTMLElement {
    const info = setTable.combos[combo]!;
    const tray = setTable.trays[info.tray];
    const found = gameState.world.sets.combos.includes(combo);
    const row = at(element('div', `rb-set${found ? ' is-found' : ''}`), 22, y);
    row.dataset.combo = combo;
    const mini = `ing_mini_${tray.item}`;
    const hold = element('span', 'rb-set__hold');
    if (registry[mini]?.type === 'local') hold.append(sizedArt(mini, 'rb-set__tray'));
    row.append(hold);
    row.append(
      element('b', 'rb-set__name', found ? t(`combo.${combo}.name` as TextKey) : '? ? ?'),
      element('small', 'rb-set__size', `${t(`set.tray_name.${info.tray}` as TextKey)} · ${tray.pieces}`),
    );
    return row;
  }

  function renderSets(): void {
    const theme = SETS_THEME;
    const combos = Object.keys(setTable.combos);
    const found = combos.filter((combo) => gameState.world.sets.combos.includes(combo)).length;
    shell.setPieces(piecesFor(theme));
    leftPage.dataset.theme = theme;
    leftPage.dataset.recipe = SETS_PAGE;
    shell.root.querySelector('.bk')!.setAttribute('data-recipe-theme', theme);
    shell.left.replaceChildren(
      pageArt(themed('book_apron', theme), 259, 12, 'rb-apron', 'scaleX(-1)'),
      tabRow(theme),
      element('div', 'rb-dname book-title rb-sets-title', t('book.sets_title')),
      at(element('div', 'rb-lab rb-sets-count', `${t('book.sets_count')} ${found}/${combos.length}`), 22, 72),
      ...combos.slice(0, SETS_LEFT).map((combo, index) => setRow(combo, 90 + index * SET_ROW_PX)),
    );
    const note = bookNote('rb-note book-note rb-sets-note', t('book.sets_note'), book('book_tape'), 30, 168);
    shell.right.replaceChildren(
      pageArt(themed('book_corner_plant', theme), 5, 219, 'rb-plant'),
      ...combos.slice(SETS_LEFT).map((combo, index) => setRow(combo, 16 + index * SET_ROW_PX)),
      note,
    );
  }

  function render(): void {
    if (!gameState.started) return;
    if (current === SETS_PAGE) {
      renderSets();
      return;
    }
    const recipe = recipes[current]!;
    const theme = recipe.category;
    const world = gameState.world.recipes;
    const known = world.known.includes(current);
    const best = world.bestStars[current] ?? 0;
    shell.setPieces(piecesFor(theme));
    leftPage.dataset.theme = theme;
    leftPage.dataset.recipe = current;
    shell.root.querySelector('.bk')!.setAttribute('data-recipe-theme', theme);

    // หน้าซ้าย
    const tabs = tabRow(theme);
    const title = element('div', 'rb-dname book-title', known ? t(`dish.${current}.name` as TextKey) : '? ? ?');
    const decos = ([
      [44, 90],
      [226, 118],
      [250, 178],
    ] as const).map(([x, y], index) => {
      const deco = sheet(`book-deco book-deco--${index + 1}`, `book_deco_${theme}_${index + 1}_8f`, 8, x, y);
      deco.style.setProperty('--still', `url("${artUrl(book(`book_deco_${theme}_${index + 1}`))}")`);
      return deco;
    });
    const stars = element('div', 'rb-stars book-stars');
    stars.dataset.stars = String(best);
    for (let slot = 0; slot < STAR_SLOTS; slot += 1) stars.append(pageArt(book(slot < best ? 'book_star_on' : 'book_star_off'), 0, 0, 'rb-star'));
    const divider = (y: number, className: string): HTMLElement => {
      const line = at(element('i', `rb-div ${className}`), 20, y);
      line.style.backgroundImage = `url("${artUrl(themed('book_divider', theme))}")`;
      return line;
    };
    shell.left.replaceChildren(
      pageArt(themed('book_apron', theme), 259, 12, 'rb-apron', 'scaleX(-1)'),
      tabs,
      title,
      ...decos,
      ...dish(recipe, current, known, theme),
      stars,
      divider(172, 'rb-div--a'),
      at(element('div', 'rb-lab', t('book.ingredients')), 22, 180),
      ingredients(recipe, known, theme),
      pageArt(themed('book_corner_plant', theme), 248, 219, 'rb-plant', 'scaleX(-1)'),
    );

    // หน้าขวา
    const stepList = at(element('div', 'rb-steps'), 22, 60);
    (steps[current] ?? []).forEach((text, index) => {
      const row = element('div', 'rb-step');
      const bullet = element('span', 'rb-bul', String(index + 1));
      bullet.style.backgroundImage = `url("${artUrl(themed('book_step_bullet', theme))}")`;
      row.append(bullet, element('p', known ? 'book-step' : 'book-step is-hidden', known ? text : '· · ·'));
      stepList.append(row);
    });
    const parts: HTMLElement[] = [
      pageArt(themed('book_corner_plant', theme), 5, 219, 'rb-plant'),
      at(element('div', 'rb-no book-number', `No.${String(ORDER.indexOf(current) + 1).padStart(2, '0')}`), 22, 16),
      at(element('div', 'rb-lab', t('book.steps')), 22, 36),
      stepList,
      divider(150, 'rb-div--b'),
    ];
    const noteKey = known ? NOTES[current] : undefined;
    if (noteKey || !known) {
      const text = noteKey ? t(noteKey) : `${t('book.hint_kinds')} ${Object.keys(recipe.ingredients).length} ${t('book.hint_kinds_end')}`;
      const note = bookNote(`rb-note book-note${known ? '' : ' book-note--hint'}`, text, book('book_tape'), 30, 168);
      note.dataset.bookNote = '';
      parts.push(note);
    }
    const { list, index } = pageOf(current);
    const nav = at(element('div', 'rb-nav'), 0, 236);
    const shown = Math.min(DOT_WINDOW, list.length);
    const first = Math.max(0, Math.min(index - Math.floor(shown / 2), list.length - shown));
    const dots = element('span', 'rb-dots');
    for (let dot = first; dot < first + shown; dot += 1) dots.append(pageArt(themed(dot === index ? 'book_page_dot_on' : 'book_page_dot_off', theme), 0, 0, 'rb-dot'));
    nav.append(bookArrow('book-prev', themed('book_arrow_left', theme), t('book.prev'), () => turn(-1)), dots, bookArrow('book-next', themed('book_arrow_right', theme), t('book.next'), () => turn(1)));
    parts.push(nav);
    shell.right.replaceChildren(...parts);
  }

  document.addEventListener('keydown', (event) => {
    if (!shell.isOpen()) return;
    if (event.key === 'ArrowLeft') turn(-1);
    if (event.key === 'ArrowRight') turn(1);
  });
  eventBus.on('book-open', () => {
    render();
    shell.show();
  });
  // หน้าที่เปิดอยู่เปลี่ยนตามความจริง เช่น ได้ดาวใหม่
  let shownBook: unknown = null;
  let shownSets: unknown = null;
  eventBus.on('world-changed', ({ recipes: now, sets }) => {
    if (!shell.isOpen() || (now === shownBook && sets === shownSets)) return;
    shownBook = now;
    shownSets = sets;
    render();
  });
}
