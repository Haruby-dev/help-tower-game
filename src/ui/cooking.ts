import { registry } from '../core/assets';
import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState, type BagStack } from '../core/state';
import balance from '../data/balance.json';
import type { Recipe } from '../data/schema';
import { canCook, canUseCampfire, haveFor, isIngredient, isRawProduce, minutesFor, recipes, starsFor, startCooking, startExperiment } from '../systems/cooking';
import { fishGroupOf, isFish } from '../systems/fishing';
import { itemImage, itemName } from './inventory';
import { artUrl } from './pixelArt';
import { revealWhenReady } from './preload';

const WINDOW = 'cooking';
type Theme = Recipe['category'];
type Tab = Theme | 'mix';
const TABS: { id: Tab; label: TextKey }[] = [
  { id: 'savory', label: 'recipe.tab_savory' },
  { id: 'sweet', label: 'recipe.tab_sweet' },
  { id: 'drink', label: 'recipe.tab_drink' },
  { id: 'mix', label: 'cook.tab_mix' },
];
/** แท็บทดลองผสมใช้ธีมครีมส้มเหมือนหมวดคาว */
const MIX_THEME: Theme = 'savory';
const STAR = '★';
/** กลางจานรองวัตถุดิบขนาด 22×22 */
const PLATE_CENTER = { x: 11, y: 10 };

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const bookArt = (name: string): string => `url("${artUrl(`ui_book_${name}`)}")`;

export const ingredientText = (items: Record<string, number>): string =>
  Object.entries(items)
    .map(([item, count]) => (count > 1 ? `${itemName(item)} ×${count}` : itemName(item)))
    .join(' · ');

/** จานรองวัตถุดิบแบบสมุดสูตร มีไอคอนเล็กตรงกลาง ถ้ายังไม่มีภาพใช้ชื่อแทน */
function ingredientPlate(item: string, theme: Theme, label: string, short: boolean): HTMLElement {
  const plate = element('span', `cook-plate${short ? ' is-short' : ''}`);
  plate.dataset.plate = item;
  plate.style.backgroundImage = bookArt(`book_ing_slot_${theme}`);
  // สูตรที่ใช้ปลาแรงก์ F แสดงปลาที่มีในกระเป๋า ถ้ายังไม่มีใช้ภาพปลารวม
  const owned = gameState.started ? gameState.world.bag.find((stack) => fishGroupOf(stack.item) === item)?.item : undefined;
  const miniId = `ing_mini_${(owned ?? item).toLowerCase()}`;
  const mini = registry[miniId];
  if (mini?.type === 'local') {
    const icon = element('i', 'cook-plate__icon');
    icon.style.backgroundImage = `url("${artUrl(miniId)}")`;
    icon.style.width = `calc(var(--px) * ${mini.width})`;
    icon.style.height = `calc(var(--px) * ${mini.height})`;
    // ภาพเล็กถูกตัดขอบมาแล้ว จึงวางกลางช่องด้วยจำนวนเต็ม ไม่ให้ตกครึ่งพิกเซล
    icon.style.left = `calc(var(--px) * ${PLATE_CENTER.x - Math.floor(mini.width / 2)})`;
    icon.style.top = `calc(var(--px) * ${PLATE_CENTER.y - Math.floor(mini.height / 2)})`;
    icon.style.transform = 'none';
    plate.append(icon);
  } else {
    plate.append(element('small', 'cook-plate__name', itemName(item)));
  }
  plate.append(element('b', 'cook-plate__count', label));
  plate.setAttribute('aria-label', `${itemName(item)} ${label}`);
  return plate;
}

function dishPicture(recipe: Recipe | null, id: string | null, theme: Theme): HTMLElement {
  const holder = element('div', 'cook-dish');
  holder.style.backgroundImage = bookArt(`book_dish_halo_${theme}`);
  const icon = recipe?.icon ? registry[recipe.icon] : undefined;
  if (recipe?.icon && icon?.type === 'local') {
    const picture = element('i', 'cook-dish__icon');
    picture.style.backgroundImage = `url("${artUrl(recipe.icon)}")`;
    holder.append(picture);
  } else {
    holder.append(element('b', 'cook-dish__unknown', id ? t(`dish.${id}.name` as TextKey) : '?'));
  }
  return holder;
}

/** หน้าต่างที่กองไฟ เลือกเมนูทางซ้าย ดูวัตถุดิบและเริ่มทำทางขวา หรือทดลองผสมเอง นาฬิกาเกมหยุดระหว่างเปิด */
export function createCookingWindow(uiRoot: HTMLElement): void {
  const backdrop = document.createElement('div');
  backdrop.id = 'cook-window';
  backdrop.hidden = true;
  const panel = element('div', 'cook-panel');
  const frame = element('i', 'cook-frame');
  const close = element('button', 'phone-tool', '×');
  close.id = 'cook-close';
  close.type = 'button';
  close.setAttribute('aria-label', t('ui.close'));
  const tabs = element('div', 'cook-tabs');
  const body = element('div', 'cook-body');
  panel.append(tabs, body, frame, close);
  backdrop.append(panel);
  uiRoot.append(backdrop);

  let tab: Tab = 'savory';
  let selected: string | null = null;
  let mix: Record<string, number> = {};

  const hide = (): void => {
    backdrop.hidden = true;
    gameState.setWindowOpen(WINDOW, false);
  };

  const apply = (next: ReturnType<typeof startCooking>): void => {
    if (!next) return;
    gameState.setWorld(next);
    hide();
  };

  const knownIn = (category: Theme): string[] =>
    gameState.world.recipes.known.filter((id) => recipes[id]?.category === category && canUseCampfire(recipes[id]!));

  const recipeCard = (id: string): HTMLElement => {
    const card = element('button', `cook-card${id === selected ? ' is-selected' : ''}`);
    card.type = 'button';
    card.dataset.recipe = id;
    const ready = canCook(gameState.world, id);
    card.classList.toggle('is-missing', !ready);
    const recipe = recipes[id]!;
    const art = recipe.bagIcon ? registry[recipe.bagIcon] : undefined;
    const icon = element('i', 'cook-card__icon');
    if (recipe.bagIcon && art?.type === 'local') {
      icon.style.backgroundImage = `url("${artUrl(recipe.bagIcon)}")`;
      icon.style.width = `calc(var(--px) * ${art.width})`;
      icon.style.height = `calc(var(--px) * ${art.height})`;
    }
    const text = element('span', 'cook-card__text');
    text.append(element('b', '', t(`dish.${id}.name` as TextKey)), element('small', '', t(ready ? 'cook.ready' : 'cook.missing')));
    card.append(icon, text);
    card.addEventListener('click', () => {
      selected = id;
      render();
    });
    return card;
  };

  const recipeDetail = (id: string, theme: Theme): HTMLElement => {
    const recipe = recipes[id]!;
    const { bag, gauges } = gameState.world;
    const detail = element('div', 'cook-detail');
    const plates = element('div', 'cook-plates');
    for (const [item, need] of Object.entries(recipe.ingredients)) {
      const have = haveFor(bag, item);
      plates.append(ingredientPlate(item, theme, `${have}/${need}`, have < need));
    }
    const facts = element('p', 'cook-facts');
    facts.append(
      element('span', '', `${minutesFor(recipe)} ${t('cook.minutes')}`),
      element('span', 'cook-facts__stars', STAR.repeat(starsFor(gauges.happiness))),
    );
    const go = element('button', 'phone-tool cook-go', t('cook.start'));
    go.id = 'cook-go';
    go.type = 'button';
    go.disabled = !canCook(gameState.world, id);
    go.addEventListener('click', () => apply(startCooking(gameState.world, id)));
    detail.append(
      dishPicture(recipe, id, theme),
      element('h3', 'cook-detail__name', t(`dish.${id}.name` as TextKey)),
      facts,
      element('b', 'cook-label', t('book.ingredients')),
      plates,
      go,
    );
    if (gauges.happiness < balance.cooking.twoStarHappiness) detail.append(element('small', 'cook-tip', t('cook.star_tip')));
    return detail;
  };

  const renderRecipes = (category: Theme): void => {
    const ids = knownIn(category);
    if (!selected || !ids.includes(selected)) selected = ids.find((id) => canCook(gameState.world, id)) ?? ids[0] ?? null;
    const list = element('div', 'cook-list');
    list.append(...ids.map(recipeCard));
    if (ids.length === 0) list.append(element('p', 'cook-empty', t('cook.none')));
    body.replaceChildren(list, selected ? recipeDetail(selected, category) : element('div', 'cook-detail'));
  };

  const mixChoices = (bag: BagStack[]): BagStack[] => bag.filter((stack) => isIngredient(stack.item) || isRawProduce(stack.item) || isFish(stack.item));

  const renderMix = (): void => {
    const { bag } = gameState.world;
    const pantry = element('div', 'cook-pantry');
    for (const stack of mixChoices(bag)) {
      const button = element('button', 'bag-slot');
      button.type = 'button';
      button.dataset.mixItem = stack.item;
      button.setAttribute('aria-label', itemName(stack.item));
      const left = stack.count - (mix[stack.item] ?? 0);
      button.disabled = left <= 0;
      button.append(itemImage(stack.item, false), element('b', '', String(left)));
      button.addEventListener('click', () => {
        mix = { ...mix, [stack.item]: (mix[stack.item] ?? 0) + 1 };
        render();
      });
      pantry.append(button);
    }

    const pot = element('div', 'cook-detail');
    const plates = element('div', 'cook-plates');
    for (const [item, count] of Object.entries(mix)) {
      const plate = ingredientPlate(item, MIX_THEME, `×${count}`, false);
      // แตะของในหม้อเพื่อเอาออกทีละชิ้น
      const remove = element('button', 'cook-plate__remove');
      remove.type = 'button';
      remove.dataset.mixRemove = item;
      remove.setAttribute('aria-label', `${t('cook.mix_remove')} ${itemName(item)}`);
      remove.append(plate);
      remove.addEventListener('click', () => {
        const next = { ...mix };
        if ((next[item] ?? 0) > 1) next[item] = next[item]! - 1;
        else delete next[item];
        mix = next;
        render();
      });
      plates.append(remove);
    }
    const clear = element('button', 'phone-tool', t('cook.mix_clear'));
    clear.type = 'button';
    clear.disabled = Object.keys(mix).length === 0;
    clear.addEventListener('click', () => {
      mix = {};
      render();
    });
    const go = element('button', 'phone-tool cook-go', t('cook.mix_go'));
    go.id = 'mix-go';
    go.type = 'button';
    go.disabled = Object.keys(mix).length === 0;
    go.addEventListener('click', () => {
      const chosen = mix;
      mix = {};
      apply(startExperiment(gameState.world, chosen));
    });
    const actions = element('div', 'cook-actions');
    actions.append(clear, go);
    pot.append(
      dishPicture(null, null, MIX_THEME),
      element('h3', 'cook-detail__name', t('cook.mix_title')),
      element('small', 'cook-tip', t(Object.keys(mix).length > 0 ? 'cook.mix_warning' : 'cook.mix_hint')),
      plates,
      actions,
    );
    body.replaceChildren(pantry, pot);
  };

  function render(): void {
    const theme: Theme = tab === 'mix' ? MIX_THEME : tab;
    panel.dataset.theme = theme;
    panel.dataset.tab = tab;
    panel.style.setProperty('--cloth', bookArt(`book_cloth_${theme}`));
    // ปุ่มในหน้าต่างใช้แท็บสีเดียวกับธีม ไม่ปนชมพูของโทรศัพท์
    panel.style.setProperty('--theme-button', bookArt(`book_tab_active_${theme}`));
    panel.style.setProperty('--theme-soft', bookArt(`book_tab_${theme}`));
    frame.style.borderImageSource = bookArt(`book_frame_${theme}_9slice`);
    tabs.replaceChildren(
      ...TABS.map(({ id, label }) => {
        const button = element('button', `cook-tab${id === tab ? ' is-active' : ''}`, t(label));
        button.type = 'button';
        button.dataset.cookTab = id;
        button.style.borderImageSource = bookArt(id === tab ? `book_tab_active_${theme}` : `book_tab_${theme}`);
        button.addEventListener('click', () => {
          tab = id;
          render();
        });
        return button;
      }),
    );
    if (tab === 'mix') renderMix();
    else renderRecipes(tab);
  }

  close.addEventListener('click', hide);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) hide();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });
  eventBus.on('cook-open', () => {
    mix = {};
    render();
    backdrop.hidden = false;
    revealWhenReady(backdrop);
    gameState.setWindowOpen(WINDOW, true);
  });
}
