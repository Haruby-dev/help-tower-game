# Recipe Book v4 — Gingham Kitchen Theme (2026-11-03)

This replaces the art in `docs/m4_recipe_book_v3_2026-11-03.md`. The **layout, data (`recipe_steps.json`), mini ingredient icons and the moving sunlight stay the same.** Only the look changes.

The book now looks like a kitchen recipe book on a gingham tablecloth. Each tab has its own colour theme:

| Tab | Theme key | Colours | Decorations |
|---|---|---|---|
| คาว (savory) | `savory` | Soft cream + light orange | Chili, garlic, fried egg, basil sprigs |
| หวาน (sweet) | `sweet` | Pastel pink | Strawberry, macaron, heart |
| เครื่องดื่ม (drink) | `drink` | Pastel mint green | Lemon slice, tea cup, bubbles, mint sprigs |

Preview: `docs/previews/m4_recipe_book_v4.png` shows savory (kaprao), sweet (pancake) and drink (basil tea).

The current recipe's category picks the theme. All files below with `_{t}` exist for `t` = `savory`, `sweet` and `drink`. Use integer nearest-neighbour scaling only.

## Remove (v3 art no longer used)

Remove these from `public/assets/ui/book/`:
- `book_bg_kaprao.png`, `book_bg_plain.png`
- `book_magic_circle_8f.png`, `book_locked_glow.png`
- `book_page_frame_9slice.png`
- `book_ing_slot.png`, `book_ing_slot_locked.png`
- `book_count_badge.png`, `book_divider.png`, `book_step_bullet.png`
- `book_arrow_left.png`, `book_arrow_right.png`
- `book_page_dot_on.png`, `book_page_dot_off.png`
- `book_tab.png`, `book_tab_active.png`

Also remove the v1 files still in that folder: `book_entry_9slice.png`, `book_entry_locked_9slice.png`, `book_paper_tile.png`, `book_star.png`, `book_star_empty.png`, `book_unknown_dish.png`.

Keep: `book_light_16f.png`, `book_note_9slice.png`, `book_tape.png`, `book_star_on.png`, `book_star_off.png` (the stars are new versions with the same names).

## Background stack (201×300 UI px page, back to front)

1. `book_cloth_{t}.png`: 40×40 gingham tile (20 px checks, soft pastel), repeat.
2. `book_light_16f.png`: moving sunlight, unchanged. 16 frames of 67×100 shown at ×3, `steps(16)` over 8 s.
3. Decorations (static, `pointer-events: none`):
   - `book_deco_{t}_1/2/3.png` at about (24,44), (164,146), (156,92). These are cute mascots with faces: savory = chili, garlic and fried egg; sweet = strawberry, macaron and heart; drink = lemon slice, tea cup and bubbles.
   - `book_corner_plant_{t}.png` (44×44) at the bottom-left corner (0, 256).
4. Frame `book_frame_{t}_9slice.png`: 24×24, slice 8, **no fill**.
5. Corner ribbons `book_ribbon_{t}.png` (44×44): top-right at (157,0); bottom-right at (157,256), **flipped vertically**.
6. Hanging apron `book_apron_{t}.png` (26×34) at (4,14), top-left. It is decoration only.

## UI pieces (same positions as v3 unless noted)

| Piece | File | Notes |
|---|---|---|
| Tabs | `book_tab_active_{t}.png` / `book_tab_{t}.png` (16×16, slice 5) | Tabs start at x 30 to clear the apron. Active label #fffaf4; inactive label = theme text colour (see below). |
| Page no. | text | Theme text colour, right-aligned at x 178 to clear the ribbon |
| Dish name | text | #54382c, bold, centred, y 38 |
| Dish plate | `book_dish_halo_{t}.png` (72×72) at (64,50) | Static plate/halo; replaces the magic circle. Dish icon at (76,62). |
| Locked dish | — | Silhouette with all opaque pixels filled in the theme `ad` colour at 60% alpha, plus a "?" over it |
| Stars | `book_star_on.png` / `book_star_off.png` | y 125 |
| Dividers | `book_divider_{t}.png` | Repeat-x at y 141 and y 195 |
| Ingredient plates | `book_ing_slot_{t}.png` / `book_ing_slot_locked_{t}.png` (22×22) | y 166. Mini icon centred at the plate's (11,10). Count badge `book_count_badge_{t}.png` at (+13,+15), white number on it. |
| Step bullets | `book_step_bullet_{t}.png` | Number in the theme `ad` colour; step text #54382c |
| Section labels | text | "วัตถุดิบ" / "วิธีทำ" in the theme text colour |
| Note | `book_note_9slice.png` + `book_tape.png` | Unchanged |
| Nav | `book_arrow_left_{t}.png` at (52,283); `book_arrow_right_{t}.png` at (138,283) | Moved inward so they clear the corner plant and ribbon. Dots `book_page_dot_on/off_{t}.png` centred at y 287. |

Theme text colours:

| Theme | Text | `ad` |
|---|---|---|
| savory | #965024 | #a06030 |
| sweet | #aa466e | #b25276 |
| drink | #38764a | #408052 |

## Animated decorations (added 2026-11-03)

Every mascot has an 8-frame sprite sheet: `book_deco_{t}_{1,2,3}_8f.png`. The frames sit side by side; frame width = sheet width / 8.

| Theme | 1 | 2 | 3 |
|---|---|---|---|
| savory | chili: bob + blink | garlic: hop + blink | fried egg: tiny hop + blink |
| sweet | strawberry: bounce + blink | macaron: bob + blink | heart: pulse |
| drink | lemon slice: bob + sparkle | tea cup: bob + blink + steam | bubbles: float up and fade |

How to play them:
- Use them in place of the static `book_deco_{t}_{i}.png`. Keep the statics as a fallback when reduced-motion is on.
- Place each sheet **2 px higher** than the static position, because the frame has 2 px of headroom for the bounce.
- Play with CSS `steps(8)`, about **6 fps** (1.3 s per loop), infinite.
- Give the three mascots different `animation-delay` values (0 s, −0.5 s, −0.9 s) so they don't move in sync.

Preview: `docs/previews/m4_recipe_book_v4_anim.gif`.

## Living dish in the centre (added 2026-11-03)

The 48px dish on its plate is alive too. All loops are 8 frames at about **3.3 fps** (2.4 s per loop), so it feels calm.

1. **Float (CSS only, no new art):** move the dish icon by these whole-pixel offsets, in UI px, one per frame: `translateY 0, 0, -1, -1, -2, -2, -1, -1`. Use `steps`, never a smooth tween, so pixels stay crisp.
2. **Shadow** — `book_dish_shadow_8f.png`: 8 frames of 40×8, synced with the float. It shrinks and fades when the dish is up.
   - Draw it under the dish icon, above the halo, at page (80,104) (centred under the plate).
3. **Steam** — `book_dish_steam_8f.png`: 8 frames of 16×22, two wavy wisps rising and fading.
   - Draw it above the dish at (94,50), moving with the float offset.
   - Show it only for hot food: every **savory** recipe, plus the drinks `warm_honey_milk` and `basil_tea`.
   - Hide it for sweets and cold drinks (`tomato_juice`, `strawberry_juice`).
4. **Sparkles** — `book_dish_sparkle_8f.png`: 8 frames of 7×7, a gold twinkle followed by rest frames.
   - Place three copies around the plate at (70,60), (124,70) and (116,104).
   - Offset each copy by 3 frames so they twinkle one after another.
   - On a **locked** page, show only the sparkles: no float, no steam.

When reduced-motion is on, show the static dish only.

Preview: `docs/previews/m4_recipe_book_v4_anim.gif`.
