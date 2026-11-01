# Art & level update — 2026-11-01 (from the planning side)

This file records decisions the user approved in the planning chat after the last handoff (31 Oct, `m1_base_floor_update.zip`).
**Where this file disagrees with CLAUDE.md or the GDD, this file wins** (it is newer). Merge it into CLAUDE.md / GDD, then keep CLAUDE.md as the single source of truth.

All new art is already generated. **Do not generate replacements and do not spend PixelLab credits for anything listed here.** PNGs are in `assets-src/art_2026-11-01/`, and every file is listed in `assets-src/art_2026-11-01/registry_additions.json` (name, file, PixelLab job + index for traceability, size, and whether it gets the jade tone).

Reference pictures are in `docs/level/2026-11-01/` (numbered 01–14). `11_full_map_overview_labeled.png` is a rough whole-map mock-up of v3.1 made from the real sprites. Use it for overall feel, and use the blueprint (01) for exact positions. They are mock-ups made by compositing the real sprites at 1:1. Use them for the look and layout, not as pixel-exact maps.

---

## 1. Global rules that changed

| Topic | Old (CLAUDE.md) | New (approved) |
| --- | --- | --- |
| Internal resolution | 480×270 | **640×360** (camera sees about 20×11 tiles). Integer upscale to the screen, as before. |
| Shadows | "soft shadow under every object" | **NO shadows at all.** No drop shadows under objects, trees, characters, or the house, and no shadow band at the cliff foot. The only darker area is the cliff face, which is about 15% darker than the ground (that is shading baked into the art, not a shadow). |
| Blur | | Sprites and tiles are never blurred. The only soft-edged thing allowed is the lighting layer in section 1.1. |
| Way up the cliff | stairs (`stairs_cliff`) | **No stairs and no ramp art.** There is ONE path of stepping stones that curves around the LEFT end of the cliff up to the gate plateau. Do not use the `stairs_cliff` entries. |
| Colour | | **Jade tone** (see section 2) on all environment art. |

### 1.1 Lighting layer (approved: "soft" style)

The user approved an ambient lighting pass that is done in code only. It is the one exception to "no shadows". Drop shadows under objects, trees, characters and the house are still banned. What is allowed is the **ambient canopy shade on the ground**, like sunlight through leaves.

- References: `12a_lighting_before.png` → `12b_lighting_APPROVED_soft.png`.
- The mock-up script is `tools/lighting_mock_reference.py`. Copy its numbers rather than its code.
- Draw it as one full-screen layer above the world and below the UI. The layers, in order:
  1. **Canopy shade.** A mask of large leaf-cluster shapes (overlapping ellipses), concentrated along the forest edges and under trees, with a few patches crossing the clearing. Edges are soft (gaussian radius about 7px at 640×360). Punch small sun-fleck holes (radius 2–5px) into the mask. Shade pixels are multiplied toward the cool tint (0.42, 0.52, 0.66) at strength 0.85 × mask. The mask drifts slowly, as if leaves were moving.
  2. **Warm afternoon grade.** Multiply the whole image by (1.05, 1.00, 0.90), then add a warm light pool (+0.10, +0.07, 0) over the main activity area, fading to 0 at its edge.
  3. **Glows (additive, soft radial).** Campfire orange (1.0, 0.6, 0.25), radius about 46px. Gate blue (0.45, 0.7, 1.0), about 40px. Monster burrow purple (0.7, 0.4, 1.0), about 30px. Each at strength 0.35, with a gentle flicker for the fire.
  4. **Vignette.** Darken by up to 35% toward the screen corners.
- Keep the effect cheap. A shader or Phaser postFX is fine. Add a **"Lighting effects" on/off toggle in Settings** for weak phones, and put the shade mask on a low-resolution render texture.
- Interiors, menus and portraits do not get this layer.

## 2. Jade tone (โทนหยก)

- Tool: `tools/jade_tone.py`. Usage: `python tools/jade_tone.py in.png out.png`. For the house, add `--house <a toned tree png>` so the house greens match the toned tree greens.
- Apply it at asset-build time, not at runtime.
- **What gets toned:** environment art. That covers ground tiles (grass, dirt, water edge, the new wood deck), trees, rocks, stones, decals, flowers, the cliff, the gate, the burrow, the house, the yard props (campfire, food tray, Gio seat), and the restaurant's natural props (stump table, stump seat, order counter, shop sign). The `jade_tone` flag in the registry says which.
- **What does NOT get toned:** characters, pets, monsters, icons, and everything bought from the System shop. The shop items are the kitchens, drink bars, cute decor, cooking equipment and pet homes. These are pastel on purpose.
- Reference for the approved look: `02_APPROVED_base_scene_style.png`.

## 3. Base floor map v3.1

The layout is shown in `01_base_floor_blueprint_v3_1.png` (47×31 tiles).

- **Gate plateau:** a small curved plateau at the top centre holds the gate. The cliff exists only around that plateau.
- **House:** its back is against the cliff, blended in with vines, bushes and rock-crevice plants. It sits on a dirt yard that connects to its door. There is no shadow under the house.
- **Path up:** stepping stones curving around the left end of the cliff (see section 1).
- **Top-left:** 3 land plots for sale, each with a price sign, bought from Gio. Plots not yet bought show weeds, stumps and rocks.
- **Bottom-left:** the pets meadow, fogged until it is unlocked (section 6).
- **Bottom:** the monster playground (toys, AFK bench). Its art is not made yet, so use placeholders.
- **Right:** the restaurant. Its entrance is blocked by 3 big trees plus fog. An event after floor 5 chops the trees down.

### 3.1 Map props

All of these are environment art, so they get the jade tone. Reference: `10_map_props_soil_fence_sign_dock.png`.

- **Farm soil:** `ground_farm_soil` is a Wang tileset with grass as the lower terrain and tilled soil as the upper. It is chained to the existing grass base tile `f08dadb0`, so it meets the normal grass cleanly.
  - Pick tiles by the tileset `/metadata` corners and `bounding_box`.
  - **Watered soil** uses the same tiles darkened in code (multiply r×0.72, g×0.70, b×0.75) until the next morning. There is no separate art.
- **Fence:** `fence_straight`, `fence_straight_vines`, `fence_post` and `fence_gate`, each 1 grid cell.
  - Mix the vine variant in at about 1 in 4.
  - Put posts at the ends and corners.
  - Use it around the land plots and the pets meadow.
- **Land-sale sign:** `land_sale_sign` is a blank board. Draw the price on it in code. One sign per unbought plot.
- **Unbought plots:** scatter a random mix of `weed_01`…`weed_64`, plus the existing `stump_seat` art as stumps, plus existing rocks. Buying the plot clears them.
- **Fishing dock:** `fishing_dock`. Its baked water disc is already removed. The dock always points NORTH into the water, so the pond needs land on its south side where the dock stands.

## 4. Grid placement system (like Stardew)

The player places and moves items on a grid, and each zone accepts only certain item types:

| Zone | Items allowed |
| --- | --- |
| Front yard | Early kitchen (campfire, food tray, Gio seat) plus home decor. After floor 5 cooking moves to the restaurant, and the yard becomes a free decoration area. |
| Restaurant (wood deck) | Kitchen, drink bar, order counter, stump tables and seats, shop decor |
| Pets meadow | Pet homes only (rules in section 6) |
| Playground | Toys (art not made yet) |

While placing, valid cells highlight **green** and invalid cells highlight **red**.

## 5. Restaurant

Layout references: `03_restaurant_skin_smart.png` and `04_restaurant_skin_pastel.png`.

- **Not a prefab stall.** The restaurant is an area on a **light wood deck** (tileset `ground_deck_wood`) inside the dirt clearing. The deck never touches grass directly; dirt always sits between them. The player arranges everything on it.
  - Pick deck tiles by the tileset `/metadata` corners and `bounding_box`. Its sheet order is NOT the same as the old ground tilesets.
  - **Check after toning:** the deck tileset's dirt was generated separately from `ground_grass_dirt`. If the two dirts look different side by side, tell the user. The fix is regenerating the deck with `lower_base_tile_id` set to the existing dirt base tile, which costs 1 credit and needs approval first.
- **Kitchen** comes as 2 skins, and the player picks one in the System shop. Each skin is one big front-facing piece with **4 equipment slots**:
  - `kitchen_smart` (glossy white + mint, induction pads with light rings, small hologram menu)
  - `kitchen_pastel` (pink/cream/mint cabinets, mini fridge, kettle, toaster)
  - Skins are a free cosmetic choice and are **not tied to player gender**.
- **Drink bar** matching each skin: `drink_bar_smart`, `drink_bar_pastel`. The pastel bar is drawn slightly angled; the user likes it that way, so leave it. Drink flavours are tied to the pets: honey (Boom Boom), soda jelly (Bubble), marshmallow milk (Mumu Mek), butter tea (Kai Pok).
- **Order counter:** `order_counter`.
- **Shop sign:** `shop_sign`, placed at the entrance.
- **Dining:** `stump_table` with one `stump_seat` on the LEFT and one on the RIGHT of each table.
  - A customer is drawn ON TOP of the seat, both customers face the table, and no sitting pose is needed.
  - Leave a gap between table sets; the mock-up is too tight.
- **Decor:** 16 dessert-themed items in `restaurant/decor/`. All are player-placeable. Do not add the old rustic decor set (job `0c1d6656`); it was rejected.

### 5.1 Equipment slots (exact anchors)

Coordinates are measured in px from the top-left of the bbox-cropped kitchen PNG. Place each equipment sprite with origin **(0.5, 1)** at **(slot.x, slot.y + 5)**.

| Skin | slot x | slot y |
| --- | --- | --- |
| kitchen_smart | 42, 83, 126, 166 | 31 |
| kitchen_pastel | 49.5, 79.5, 111, 142.5 | 19 |

Switching skins moves the placed equipment to the new skin's slots. References: `05_kitchen_slots_smart.png`, `06_kitchen_slots_pastel.png`.

### 5.2 Cooking equipment

All equipment is 32px class, pastel, front-facing, and bought from the System shop. The protagonist is a present-day person, so the equipment is modern with light fantasy touches (no ancient or rune look). Reference: `07_equipment_main_and_skins.png`.

| Tier | Ranks (GDD) | Main item(s) | Shop colour skins (cosmetic only) |
| --- | --- | --- | --- |
| 1 | F–E | `campfire` (yard, crafted) | – |
| 2 | D–C | `equip_pot`, `equip_pan` | pot: 50 53 28 27 47 64 44 · pan: 17 |
| 3 | B–A | `equip_oven`, `equip_mortar` | oven: 1 3 4 24 59 · mortar: 2 3 4 |
| 4 | S–SS | `equip_smart_cooker` (in-game name may stay "ครัวเวทมนตร์") | 41 |
| 5 | SSS | `equip_star_stove` | 59 63 22 43 |

Each equipment item takes 1 slot.

**Decided by the user:** tiers 2 and 3 need BOTH items (pot AND pan; oven AND mortar) to unlock that tier's ranks.

### 5.3 Cooking flow (approved "option A")

1. The player puts a dish on an equipment slot.
2. A small round **progress ring** appears just above that item, and **steam** (puffs) rises from it. Both are drawn in code, with no extra art.
3. The player can walk away. Several slots cook in parallel.
4. When the dish is done, a **dish icon** pops up over the slot, and the player collects it.

Duration follows the GDD: 20–60 game minutes (15–45 real seconds).

## 6. Pets

### Pets (characters already made)

| Pet | Character id | Movement | Notes |
| --- | --- | --- | --- |
| Kai Pok (butter bread chicken) | `3592b6d8-e8e6-420a-83df-4328597ab7ae` | `kai_pok_hop` S,E,N | West = flip of east. Happy emote: job `ee9e7db5` idx 20. |
| Nueb Nub (sleepy snail, glass shell, rain cloud) | `554e7c33-0d09-4082-b84c-a1249c959c2e` | `nueb_nub_crawl` S,E,N | West = flip of east. Emotes in job `a6bdb39d` (0-based): sick 10/16, healed 12, sleep 5, watering 4, favourite food 11. |
| Boom Boom (vanilla honey bee) | `4fea2a7b-42e5-4d1a-8506-bf0a2e6fb4ad` | `boom_boom_fly` S,N | The S frame faces slightly right: use it for down/right, flip it for left, use N for up. |
| Bubble (soda jelly with sprinkles) | `bd680e89-8c00-47f0-a4f0-80a69c5ae9e4` | `bubble_bounce` S,E,N | Use the S animation for left/right too. |
| Mumu Mek (marshmallow cow) | `76cbbfd3-a197-4074-b3be-88118c30a2f7` | `mumu_float` S,E,N | 64px canvas (bigger pet). West = flip of east. |

- Idle for every pet is the static rotation plus a 1px bob in code. No scaling.
- Scale-table note: Mumu Mek is larger than the "pets 20–40px" row in CLAUDE.md. That is intended; update the table.

### Pet homes (player-placeable, pastel, not toned)

Reference for the default starting layout when the meadow unlocks: `09_pets_meadow_default_layout.png`.

| Home | Owner | Where it can be placed |
| --- | --- | --- |
| `home_coop_kaipok` | Kai Pok | land |
| `home_barn_mumumek` | Mumu Mek | land |
| `home_hive_boomboom` | Boom Boom | land |
| `home_leafspot_nuebnub` | Nueb Nub | only a land cell next to water |
| `home_shellbed_bubble` | Bubble | only a water cell (Bubble lives in the pond) |

- Homes can be placed only inside the pets meadow zone.
- Each pet wanders around its own home. If the home moves, the pet follows.

## 6.5 Premium cosmetics (approved direction, build the structure only)

- **Two currencies:**
  - **Coins**, earned by playing.
  - **Sugar Stars** (working name "ดาวน้ำตาล"), the premium currency.
- **Premium items are cosmetic only:**
  - extra toy costumes
  - equipment colour skins
  - kitchen and drink-bar skins
  - shop decor
- **Toy pricing:** everything in the playground (the zone, every toy and every costume) costs Sugar Stars only. See 6.6.
- **Never premium:** anything that affects gameplay. Equipment tiers, ranks and recipes are always earned or bought with coins.
- **For now Sugar Stars are earned in-game only**, from daily tasks, clearing a gate, and a monster reaching 100% liking. Keep the amounts small but real.
- **Do NOT build real-money purchasing.** The game has no backend, and saves are local, so paid items would be trivial to unlock by editing the save. Real payments also need a payment provider plus seller and tax registration.
  - Still, design the shop data so a "buy Sugar Stars" entry point can be added later without refactoring. Use a `currency: "coins" | "stars"` field on every shop item, and keep a single wallet module.
- **Shop UI:** premium items get a small star badge. The shop has a "Costumes" tab per item type, where the player can preview each skin before buying.

## 6.6 Monster playground (toys = costumes, very important to the user)

References: `13_playground_toys_all_sugar_stars.png` and `14_playground_scene.png`.

- **Look:** dessert-themed pastel art. Not toned.
- **Placement:** player-placeable in the playground zone only, with the same grid system as everywhere else.
- **Costumes:** each toy type has several costumes, listed below.
- **Sugar Stars only (user decision).** The playground zone itself, every toy, and every costume, including the balls, are unlocked with **Sugar Stars only**. Coins are never used here. The player unlocks them in any order they like; there is no "base costume first" rule. Every PNG in `playground/` has `currency: "stars"` in the registry.
- The `#` numbers below are the files the user picked. The first one listed per toy is the default one shown in the shop.

| Toy | Costumes (all Sugar Stars) |
| --- | --- |
| slide | #2, 1, 3, 4 |
| treehouse | #1, 2, 3, 4 |
| swing | #1, 2, 3, 4 |
| sandbox | #1, 2–7, 12, 14, 15, 16 |
| see-saw | #1, 2–16 |
| AFK bench | #2, 1, 3–12, 15, 16 |
| ball | all 64 (cheap) |

- **AFK bench:** when the player sits on it, the camera drifts slowly over the playground to watch pets and monsters play.
- **Test phase:**
  - The playground zone is **unlocked with Sugar Stars**.
  - Sugar Stars come from the normal in-game sources, with generous amounts while testing.
  - Add a **hidden "give test Sugar Stars" button in Settings**, clearly marked as removed before release.
  - Prices are placeholders. Put them in one data file so they are easy to tune.

## 6.7 Food tray upgrades

`food_tray_6` and `food_tray_10` match `food_tray_3` (same wood). They get the jade tone. Upgrades hold more plates: 3 → 6 → 10. Map plate capacity to the GDD tray rules. If the GDD does not say how capacity works, ask the user.

## 7. Not made yet (use labelled placeholder boxes)

- Restaurant entrance trees event art and the fog overlay (fog can be done in code)

The planning side will deliver these later. Do not generate them yourself.

## 6.8 Monster visits: tray browsing + eating (user decision, inspired by Kairosoft's Bonbon Cakery)

The GDD only says monsters take 1–5 dishes from the tray and prefer their favourites. This section adds what that looks like on screen. Use the GDD taste multipliers; nothing here changes the numbers.

**Tray**
- Each plate on the tray (3 / 6 / 10 plates) holds ONE menu.
- Cooking several servings of the same menu stacks them on that plate, and the visible stack grows.

**Browsing**
- A visiting monster walks along the tray and looks at the plates one by one.
- Some monsters decide instantly; others hesitate, step back and forth, and use a "thinking" bubble.

**Taking**
- Dislike or below the minimum rank: a sulky face, and it walks past.
- Like: takes 1 serving, with a small heart pop.
- Favourite: takes a stacked TOWER of 3–5 servings and carries it wobbling, with sparkles.
- The total per visit still respects the GDD's 1–5 dishes. Favourites are taken first.
- The suspense of "how many towers today?" is the fun, so make the tower stack and wobble readable.

**Where they eat (changes with affection)**
- Low affection (red eyes, still wary): grabs the food and runs straight back into the burrow.
- Medium: sits and eats on a bench or stump near the burrow.
- High affection (sweet eyes): sits at a restaurant stump table, or in the playground, and eats there. Pets may come over.
- While eating on screen, each dish gives an emote (heart / star / sulk). The eye colour shifts toward sweet as affection rises. When finished, the monster pats its belly, waves, and walks home.

**Monster look**
- At 0% the monster has red hungry eyes and a dull purple aura: grumpy-hungry, but still cute, never scary.
- At 100% it has sweet sparkly eyes and pink cheeks.
- Art needed is only 2 states per base body (hungry and happy). The in-between stages are an eye-colour and aura tween done in code.
- Each base body also needs 1 eating pose. The run reuses the walk animation, played faster.
- The GDD has 25 base bodies.
- Monster art is NOT made yet: use placeholder boxes or a single test monster until the planning side delivers it.

**Kairosoft-style flavour (code only):** short pop-up words over the cooking slots while cooking, for example "หั่น…", "ผัด…", "โรยหน้า…".
