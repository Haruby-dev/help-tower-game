import { eventBus } from '../core/events';
import { t, type TextKey } from '../core/i18n';
import { gameState, type RecipeBook } from '../core/state';
import { recipes } from '../systems/cooking';
import { ingredientText } from './cooking';

type Category = 'savory' | 'sweet' | 'drink';
const TABS: { id: Category; label: TextKey }[] = [
  { id: 'savory', label: 'recipe.tab_savory' },
  { id: 'sweet', label: 'recipe.tab_sweet' },
  { id: 'drink', label: 'recipe.tab_drink' },
];
const FIRST_RECIPE_WITH_NOTE = 'home_kaprao';
const STAR = '★';

/** สมุดสูตรเก่า ไม่มีชื่อเจ้าของจนกว่าจะถึงบทที่ 9 */
export function createRecipeBookPage(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'phone-page book-page';
  page.id = 'recipe-book';
  const title = Object.assign(document.createElement('h2'), { textContent: t('book.title') });
  const tabs = Object.assign(document.createElement('div'), { className: 'bag-tabs' });
  const list = Object.assign(document.createElement('div'), { className: 'book-list' });
  page.append(title, tabs, list);

  let tab: Category = 'savory';
  let shown: RecipeBook | null = null;

  const entry = (id: string, book: RecipeBook): HTMLElement => {
    const recipe = recipes[id]!;
    const row = document.createElement('div');
    row.dataset.bookRecipe = id;
    if (!book.known.includes(id)) {
      row.className = 'book-entry is-locked';
      row.append(
        Object.assign(document.createElement('b'), { textContent: t('book.unknown') }),
        Object.assign(document.createElement('small'), {
          textContent: `${t('book.hint_kinds')} ${Object.keys(recipe.ingredients).length} ${t('book.hint_kinds_end')}`,
        }),
      );
      return row;
    }
    row.className = 'book-entry';
    const best = book.bestStars[id] ?? 0;
    const name = Object.assign(document.createElement('b'), { textContent: t(`dish.${id}.name` as TextKey) });
    row.append(name, Object.assign(document.createElement('small'), { textContent: ingredientText(recipe.ingredients) }));
    if (best > 0) row.append(Object.assign(document.createElement('span'), { className: 'book-stamp', textContent: STAR.repeat(best) }));
    if (id === FIRST_RECIPE_WITH_NOTE) {
      row.append(Object.assign(document.createElement('i'), { className: 'book-note', textContent: t('book.kaprao_note') }));
    }
    return row;
  };

  const render = (): void => {
    const book = gameState.world.recipes;
    shown = book;
    tabs.replaceChildren(
      ...TABS.map(({ id, label }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `bag-tab${id === tab ? ' is-active' : ''}`;
        button.dataset.bookTab = id;
        button.textContent = t(label);
        button.addEventListener('click', () => {
          tab = id;
          render();
        });
        return button;
      }),
    );
    list.replaceChildren(
      ...Object.keys(recipes)
        .filter((id) => recipes[id]?.category === tab)
        .map((id) => entry(id, book)),
    );
  };

  eventBus.on('world-changed', ({ recipes: book }) => {
    if (book !== shown) render();
  });
  render();
  return page;
}
