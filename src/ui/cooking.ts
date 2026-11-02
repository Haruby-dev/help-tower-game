import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState, type BagStack } from '../core/state';
import { canCook, canUseCampfire, isIngredient, isRawProduce, minutesFor, recipes, startCooking, startExperiment } from '../systems/cooking';
import { itemImage, itemName } from './inventory';

const WINDOW = 'cooking';
type Tab = 'savory' | 'sweet' | 'drink' | 'mix';
const TABS: { id: Tab; label: TextKey }[] = [
  { id: 'savory', label: 'recipe.tab_savory' },
  { id: 'sweet', label: 'recipe.tab_sweet' },
  { id: 'drink', label: 'recipe.tab_drink' },
  { id: 'mix', label: 'cook.tab_mix' },
];

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export const ingredientText = (items: Record<string, number>): string =>
  Object.entries(items)
    .map(([item, count]) => (count > 1 ? `${itemName(item)} ×${count}` : itemName(item)))
    .join(' · ');

/** หน้าต่างเลือกเมนูที่กองไฟ และแท็บทดลองผสมเอง นาฬิกาเกมหยุดระหว่างเปิด */
export function createCookingWindow(uiRoot: HTMLElement): void {
  const backdrop = document.createElement('div');
  backdrop.id = 'cook-window';
  backdrop.hidden = true;
  const panel = element('div', 'cook-panel');
  const close = element('button', 'phone-tool', '×');
  close.id = 'cook-close';
  close.type = 'button';
  close.setAttribute('aria-label', t('ui.close'));
  const tabs = element('div', 'bag-tabs');
  const body = element('div', 'cook-body');
  panel.append(close, tabs, body);
  backdrop.append(panel);
  uiRoot.append(backdrop);

  let tab: Tab = 'savory';
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

  const recipeRow = (id: string): HTMLElement => {
    const recipe = recipes[id]!;
    const row = element('button', 'cook-row');
    row.type = 'button';
    row.dataset.recipe = id;
    row.disabled = !canCook(gameState.world, id);
    const text = element('span', 'cook-row__text');
    text.append(element('b', '', t(`dish.${id}.name` as TextKey)), element('small', '', ingredientText(recipe.ingredients)));
    row.append(text, element('small', 'cook-row__time', `${minutesFor(recipe)} ${t('cook.minutes')}`));
    row.addEventListener('click', () => apply(startCooking(gameState.world, id)));
    return row;
  };

  const renderRecipes = (category: Tab): void => {
    const { known } = gameState.world.recipes;
    const ids = known.filter((id) => recipes[id]?.category === category && canUseCampfire(recipes[id]!));
    body.replaceChildren(...ids.map(recipeRow));
    if (ids.length === 0) body.append(element('p', 'cook-empty', t('cook.none')));
  };

  const mixChoices = (bag: BagStack[]): BagStack[] => bag.filter((stack) => isIngredient(stack.item) || isRawProduce(stack.item));

  const renderMix = (): void => {
    const { bag } = gameState.world;
    const tray = element('p', 'cook-mix__tray', Object.keys(mix).length > 0 ? ingredientText(mix) : t('cook.mix_hint'));
    const grid = element('div', 'cook-mix__items');
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
      grid.append(button);
    }
    const clear = element('button', 'phone-tool', t('cook.mix_clear'));
    clear.type = 'button';
    clear.addEventListener('click', () => {
      mix = {};
      render();
    });
    const go = element('button', 'phone-tool', t('cook.mix_go'));
    go.id = 'mix-go';
    go.type = 'button';
    go.disabled = Object.keys(mix).length === 0;
    go.addEventListener('click', () => {
      const chosen = mix;
      mix = {};
      apply(startExperiment(gameState.world, chosen));
    });
    const actions = element('div', 'cook-mix__actions');
    actions.append(clear, go);
    body.replaceChildren(tray, actions, grid);
  };

  function render(): void {
    tabs.replaceChildren(
      ...TABS.map(({ id, label }) => {
        const button = element('button', `bag-tab${id === tab ? ' is-active' : ''}`, t(label));
        button.type = 'button';
        button.dataset.cookTab = id;
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
    gameState.setWindowOpen(WINDOW, true);
  });
}
