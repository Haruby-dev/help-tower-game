# Recipe Book v3 — 2026-11-03

This replaces the recipe-book art in `docs/m4_cooking_art_2026-11-03.md` §5. Layout is now **one recipe per page**.
- **Backgrounds:** a warm white "sunlit table" painting with animated sunlight. The kaprao page has its own painted background; every other page uses the plain table.
- **UI pieces:** gold and violet magic-book pieces. The book is a special item, so the UI is a bit magical.

Previews:
- `docs/previews/m4_recipe_book_v3.png`: a known page with the painted background, a known page with the plain background, and a locked page.
- `docs/previews/m4_recipe_book_light_anim.gif`: the light motion. The preview runs faster than the target speed.

Use integer nearest-neighbour scaling only (`image-rendering: pixelated`). Don't generate images.

## Old files to delete

Delete these v1 files from `public/assets/ui/book/` (no longer used): `book_entry_9slice.png`, `book_entry_locked_9slice.png`, `book_paper_tile.png`, `book_star.png`, `book_star_empty.png`, `book_unknown_dish.png`.

`book_tab*.png` and `book_note_9slice.png` are replaced by new files with the same names.

## Page layout

Reference size: 201×300 UI px. Measurements below are in UI px from the page's top-left.

| Area | Position | Content |
|---|---|---|
| Tabs | y 10, h 15 | savory / sweet / drink. Use `book_tab*.png` (9-slice, slice 5). Active label #faf4ff, inactive label #9688c8. |
| Page no. | top-right, y 17 | `No.06` style, gold #a87028 |
| Dish name | centre, y 36 | Bold, gold #a87028. A locked page shows `? ? ?` in #9688aa. |
| Magic circle | 72×72 at (64,48) | `book_magic_circle_8f.png`, 8 frames of 72×72, loop at ~6 fps (slow spin) |
| Dish icon | 48×48 at (76,60) | `food/dishes/<id>.png` (chest desserts use their recipes.json `icon` → `food/desserts/<icon>.png`). For a locked recipe, draw it as a silhouette (all opaque pixels #2e2660), put `book_locked_glow.png` under it, and draw a "?" in the middle. |
| Stars | y 123, x 80/94/108 | `book_star_on.png` for each of bestStars, `book_star_off.png` for the rest (3 slots) |
| Divider | y 139 and y 193 | `book_divider.png`, repeat-x, inset 14 px |
| "วัตถุดิบ" | y 150 | Section label, gold |
| Ingredient orbs | y 164, 22×22, spacing 26, centred row | `book_ing_slot.png` + 16px icon from `food/ingredients_mini/<item_id>.png`, centred in the orb. If the count is >1, put `book_count_badge.png` at the orb's (+13,+15) with the number on it. A locked recipe shows `book_ing_slot_locked.png` ("?") only, one per ingredient. |
| "วิธีทำ" | y 203 | Section label, gold |
| Steps | y 219 + 14·i | `book_step_bullet.png` (11×11) with the step number in it; text at x 32 in #54382c. On a locked page, show faded bars (#d6cce2) instead of the text. |
| Note | y 262 | Only on pages with a note (kaprao: `book.kaprao_note`). `book_note_9slice.png` (slice 5) with `book_tape.png` over its top-left corner. Text #60503a. On a locked page, show the hint here instead (#7868a0). |
| Nav | y 282 | `book_arrow_left/right.png` at the edges; page dots `book_page_dot_on/off.png` centred |

Frame: `book_page_frame_9slice.png` (32×32, slice 11, **no fill**) over everything, on all four edges. It is a gold double line with constellation corners and a soft warm inner glow.

## Backgrounds and moving light

All three images are drawn on a **67×100 grid**. Show them at **×3** (201×300 UI px, one grid cell = 3 UI px) so they stay chunky like the painting.

Stack them in this order, back to front:

1. **Static painting**
   - `book_bg_kaprao.png` on the `home_kaprao` page.
   - `book_bg_plain.png` on every other page: the same sunny table and window, without food.
   - Both are already faded and washed to white at the bottom, so text stays readable.
2. **Moving light** — `book_light_16f.png`: 16 frames of 67×100 (sheet 1072×100), transparent. It contains the sun rays (sway and gently breathe), dappled leaf shadows and floating dust motes.
   - Loop it with `steps(16)` over **8 s** (0.5 s per frame) — slow and calm.
   - Optional: add an extra `opacity` 0.85↔1 ease over 6 s on this layer.
3. The UI on top.

The animated light also plays on locked pages.

## Data — `src/data/recipe_steps.json`

`{ recipe_id: [step1, step2, step3] }` in Thai, for all 33 recipes in recipes.json, including `strawberry_juice` and the 15 chest desserts.
- Every recipe has exactly 3 steps.
- Each step is at most 32 Thai characters, so it fits one line.
- Please move the steps into i18n (`dish.<id>.steps`) or load them as they are; either is fine.

## Ingredient mini icons — `public/assets/food/ingredients_mini/`

These are 16px max and tight-cropped. The file name is the item id exactly as written in recipes.json:
- `produce_basil`, `produce_blueberry`, `produce_carrot`, `produce_chili`, `produce_corn`, `produce_garlic`, `produce_potato`, `produce_rice`, `produce_scallion`, `produce_strawberry`, `produce_tomato`
- `ing_cherry`, `ing_cocoa`, `ing_egg`, `ing_fish_F`, `ing_fish_sauce`, `ing_golden_wheat`, `ing_honey`, `ing_honey_apple`, `ing_milk`, `ing_pork`, `ing_salt`, `ing_sugar`

No icon yet for `ing_cream`, `ing_butter`, `ing_slime_jelly_scrap`, `ing_fizzy_water` or `ing_vanilla`. Show an empty orb with a small text label until the art arrives.
