import { registry } from '../core/assets';
import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState } from '../core/state';
import recipeSteps from '../data/recipe_steps.json';
import type { Recipe } from '../data/schema';
import { recipes } from '../systems/cooking';
import { itemName } from './inventory';
import { artUrl } from './pixelArt';

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
const DOT_WINDOW = 7;
const steps = recipeSteps as Record<string, string[]>;
const ORDER = Object.keys(recipes);

const book = (name: string): string => artUrl(`ui_book_${name}`);
const themed = (name: string, theme: Category): string => book(`${name}_${theme}`);

/** ทุกตำแหน่งนับเป็นพิกเซลของหน้า 201×300 แล้วคูณ --bpx */
const at = (node: HTMLElement, x: number, y: number): HTMLElement => {
  node.style.left = `calc(var(--bpx) * ${x})`;
  node.style.top = `calc(var(--bpx) * ${y})`;
  return node;
};

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function sprite(className: string, url: string, width: number, height: number): HTMLElement {
  const node = element('i', `book-sprite ${className}`);
  node.style.backgroundImage = `url("${url}")`;
  node.style.width = `calc(var(--bpx) * ${width})`;
  node.style.height = `calc(var(--bpx) * ${height})`;
  return node;
}

/** แผ่นภาพหลายเฟรมเรียงแนวนอน เล่นด้วย steps() ใน CSS */
function sheet(className: string, id: string, frames: number): HTMLElement {
  const entry = registry[`ui_book_${id}`];
  if (entry?.type !== 'local') throw new Error(`${id} is not registered`);
  const node = sprite(`book-sheet ${className}`, book(id), entry.width / frames, entry.height);
  node.style.setProperty('--sheet', `calc(var(--bpx) * ${entry.width})`);
  node.style.backgroundSize = `calc(var(--bpx) * ${entry.width}) calc(var(--bpx) * ${entry.height})`;
  return node;
}

const dishIcon = (recipe: Recipe): string | null => {
  const entry = recipe.icon ? registry[recipe.icon] : undefined;
  return recipe.icon && entry ? artUrl(recipe.icon) : null;
};

/** สมุดสูตรเก่า หน้าละหนึ่งสูตร ไม่มีชื่อเจ้าของจนกว่าจะถึงบทที่ 9 */
export function createRecipeBook(uiRoot: HTMLElement): void {
  const backdrop = element('div', '');
  backdrop.id = 'recipe-book';
  backdrop.hidden = true;
  const page = element('div', 'book-page');
  const close = element('button', 'phone-tool book-close', '×');
  close.id = 'book-close';
  close.type = 'button';
  close.setAttribute('aria-label', t('ui.close'));
  backdrop.append(page, close);
  uiRoot.append(backdrop);

  let current = 'home_kaprao';

  const pageOf = (id: string): { list: string[]; index: number } => {
    const list = ORDER.filter((candidate) => recipes[candidate]?.category === recipes[id]?.category);
    return { list, index: list.indexOf(id) };
  };

  const go = (id: string): void => {
    current = id;
    render();
  };

  const turn = (step: number): void => {
    const { list, index } = pageOf(current);
    go(list[(index + step + list.length) % list.length]!);
  };

  function background(theme: Category): HTMLElement[] {
    const cloth = element('i', 'book-layer book-cloth');
    cloth.style.backgroundImage = `url("${themed('book_cloth', theme)}")`;
    const light = sheet('book-light', 'book_light_16f', 16);
    // แสงวาดบนตาราง 67×100 แล้วขยาย 3 เท่าเต็มหน้า
    light.style.width = 'calc(var(--bpx) * 201)';
    light.style.height = 'calc(var(--bpx) * 300)';
    light.style.setProperty('--sheet', 'calc(var(--bpx) * 3216)');
    light.style.backgroundSize = 'calc(var(--bpx) * 3216) calc(var(--bpx) * 300)';
    const decos = ([
      [24, 44],
      [164, 146],
      [156, 92],
    ] as const).map(([x, y], index) => {
      const deco = sheet(`book-deco book-deco--${index + 1}`, `book_deco_${theme}_${index + 1}_8f`, 8);
      // ภาพนิ่งไว้ใช้ตอนผู้เล่นปิดการเคลื่อนไหว
      deco.style.setProperty('--still', `url("${book(`book_deco_${theme}_${index + 1}`)}")`);
      return at(deco, x, y - 2);
    });
    const plant = at(sprite('book-plant', themed('book_corner_plant', theme), 44, 44), 0, 256);
    const frame = element('i', 'book-layer book-frame');
    frame.style.borderImageSource = `url("${book(`book_frame_${theme}_9slice`)}")`;
    const ribbonTop = at(sprite('book-ribbon', themed('book_ribbon', theme), 44, 44), 157, 0);
    const ribbonBottom = at(sprite('book-ribbon book-ribbon--flip', themed('book_ribbon', theme), 44, 44), 157, 256);
    const apron = at(sprite('book-apron', themed('book_apron', theme), 26, 34), 4, 14);
    return [cloth, light, ...decos, plant, frame, ribbonTop, ribbonBottom, apron];
  }

  function dish(recipe: Recipe, id: string, known: boolean, theme: Category): HTMLElement[] {
    const halo = at(sprite('book-halo', themed('book_dish_halo', theme), 72, 72), 64, 50);
    const sparkles = ([
      [70, 60],
      [124, 70],
      [116, 104],
    ] as const).map(([x, y], index) => {
      const sparkle = at(sheet(`book-sparkle book-sparkle--${index}`, 'book_dish_sparkle_8f', 8), x, y);
      return sparkle;
    });
    const icon = dishIcon(recipe);
    if (!known) {
      const silhouette = at(element('i', 'book-silhouette'), 76, 62);
      if (icon) silhouette.style.setProperty('--icon', `url("${icon}")`);
      const mark = at(element('b', 'book-question', '?'), 76, 62);
      return [halo, silhouette, mark, ...sparkles];
    }
    const shadow = at(sheet('book-shadow', 'book_dish_shadow_8f', 8), 80, 104);
    const float = at(element('div', 'book-float'), 0, 0);
    if (icon) float.append(at(sprite('book-dish', icon, 48, 48), 76, 62));
    else float.append(at(element('i', 'book-dish item-missing', t(`dish.${id}.name` as TextKey)), 76, 62));
    if (recipe.category === 'savory' || HOT_DRINKS.has(id)) float.append(at(sheet('book-steam', 'book_dish_steam_8f', 8), 94, 50));
    return [halo, shadow, float, ...sparkles];
  }

  function ingredients(recipe: Recipe, known: boolean, theme: Category): HTMLElement {
    const row = element('div', 'book-ingredients');
    const items = Object.entries(recipe.ingredients);
    const start = Math.round((201 - (items.length * 26 - 4)) / 2);
    items.forEach(([item, count], index) => {
      const slot = at(sprite('book-ing', themed(known ? 'book_ing_slot' : 'book_ing_slot_locked', theme), 22, 22), start + index * 26, 168);
      slot.dataset.ingredient = item;
      if (known) {
        const mini = registry[`ing_mini_${item.toLowerCase()}`];
        if (mini?.type === 'local') {
          const icon = sprite('book-ing__icon', artUrl(`ing_mini_${item.toLowerCase()}`), mini.width, mini.height);
          icon.style.left = `calc(var(--bpx) * ${11 - Math.floor(mini.width / 2)})`;
          icon.style.top = `calc(var(--bpx) * ${10 - Math.floor(mini.height / 2)})`;
          slot.append(icon);
        } else {
          slot.append(element('small', 'book-ing__label', itemName(item)));
        }
        if (count > 1) {
          const badge = at(sprite('book-badge', themed('book_count_badge', theme), 12, 9), 13, 15);
          badge.textContent = String(count);
          slot.append(badge);
        }
      }
      row.append(slot);
    });
    return row;
  }

  function render(): void {
    const recipe = recipes[current]!;
    const theme = recipe.category;
    const world = gameState.world.recipes;
    const known = world.known.includes(current);
    const best = world.bestStars[current] ?? 0;
    page.dataset.theme = theme;
    page.dataset.recipe = current;
    page.classList.toggle('is-locked', !known);
    const parts: HTMLElement[] = [...background(theme)];

    const tabs = at(element('div', 'book-tabs'), 30, 10);
    for (const { id, label } of TABS) {
      const tab = element('button', 'book-tab', t(label));
      tab.type = 'button';
      tab.dataset.bookTab = id;
      tab.style.borderImageSource = `url("${themed(id === theme ? 'book_tab_active' : 'book_tab', theme)}")`;
      tab.classList.toggle('is-active', id === theme);
      tab.addEventListener('click', () => go(ORDER.find((candidate) => recipes[candidate]?.category === id)!));
      tabs.append(tab);
    }
    const number = element('b', 'book-number', `No.${String(ORDER.indexOf(current) + 1).padStart(2, '0')}`);
    number.style.top = 'calc(var(--bpx) * 17)';
    number.style.right = 'calc(var(--bpx) * 23)';
    const title = at(element('h2', 'book-title', known ? t(`dish.${current}.name` as TextKey) : '? ? ?'), 0, 38);
    parts.push(tabs, number, title, ...dish(recipe, current, known, theme));

    const stars = at(element('div', 'book-stars'), 80, 125);
    for (let slot = 0; slot < STAR_SLOTS; slot += 1) {
      stars.append(at(sprite('book-star', book(slot < best ? 'book_star_on' : 'book_star_off'), 13, 13), slot * 14, 0));
    }
    stars.dataset.stars = String(best);
    const divider = (y: number): HTMLElement => {
      const line = at(element('i', 'book-divider'), 14, y);
      line.style.backgroundImage = `url("${themed('book_divider', theme)}")`;
      return line;
    };
    parts.push(stars, divider(141), at(element('b', 'book-label', t('book.ingredients')), 14, 150), ingredients(recipe, known, theme));
    parts.push(divider(195), at(element('b', 'book-label', t('book.steps')), 14, 203));

    (steps[current] ?? []).forEach((text, index) => {
      const bullet = at(sprite('book-bullet', themed('book_step_bullet', theme), 11, 11), 16, 219 + index * 14);
      bullet.textContent = String(index + 1);
      const line = at(element('span', known ? 'book-step' : 'book-step is-hidden', known ? text : ''), 32, 218 + index * 14);
      parts.push(bullet, line);
    });

    const noteKey = known ? NOTES[current] : undefined;
    if (noteKey || !known) {
      const note = at(element('p', known ? 'book-note' : 'book-note book-note--hint'), 30, 262);
      note.textContent = noteKey
        ? t(noteKey)
        : `${t('book.hint_kinds')} ${Object.keys(recipe.ingredients).length} ${t('book.hint_kinds_end')}`;
      note.dataset.bookNote = '';
      if (noteKey) note.append(at(sprite('book-tape', book('book_tape'), 16, 7), -6, -3));
      parts.push(note);
    }

    const { list, index } = pageOf(current);
    const left = element('button', 'book-arrow');
    at(left, 52, 283);
    left.type = 'button';
    left.id = 'book-prev';
    left.setAttribute('aria-label', t('book.prev'));
    left.style.backgroundImage = `url("${themed('book_arrow_left', theme)}")`;
    left.addEventListener('click', () => turn(-1));
    const right = element('button', 'book-arrow');
    at(right, 138, 283);
    right.type = 'button';
    right.id = 'book-next';
    right.setAttribute('aria-label', t('book.next'));
    right.style.backgroundImage = `url("${themed('book_arrow_right', theme)}")`;
    right.addEventListener('click', () => turn(1));
    const shown = Math.min(DOT_WINDOW, list.length);
    const first = Math.max(0, Math.min(index - Math.floor(shown / 2), list.length - shown));
    const dots = element('div', 'book-dots');
    dots.style.top = 'calc(var(--bpx) * 285)';
    for (let dot = first; dot < first + shown; dot += 1) {
      dots.append(sprite('book-dot', themed(dot === index ? 'book_page_dot_on' : 'book_page_dot_off', theme), 5, 5));
    }
    parts.push(left, right, dots);
    page.replaceChildren(...parts);
  }

  const hide = (): void => {
    if (backdrop.hidden) return;
    backdrop.hidden = true;
    gameState.setWindowOpen(WINDOW, false);
  };
  close.addEventListener('click', hide);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) hide();
  });
  document.addEventListener('keydown', (event) => {
    if (backdrop.hidden) return;
    if (event.key === 'Escape') hide();
    if (event.key === 'ArrowLeft') turn(-1);
    if (event.key === 'ArrowRight') turn(1);
  });
  eventBus.on('book-open', () => {
    render();
    backdrop.hidden = false;
    gameState.setWindowOpen(WINDOW, true);
  });
  // หน้าที่เปิดอยู่เปลี่ยนตามความจริง เช่น ได้ดาวใหม่
  let shownBook: unknown = null;
  eventBus.on('world-changed', ({ recipes: current }) => {
    if (backdrop.hidden || current === shownBook) return;
    shownBook = current;
    render();
  });
}
