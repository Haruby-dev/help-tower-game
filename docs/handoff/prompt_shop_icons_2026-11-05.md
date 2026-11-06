# Prompt to the code side: shop icons follow-up (updated 2026-11-06 15:20: star art and tray icons are already in the game, so those parts were removed)

All art below is approved by her (2026-11-05). Spec: `docs/m6_art_2026-11-05.md` section 7.

## 1. Files already on disk, not committed yet (from the planning side)
In `public/assets/ui/shop/items/` (all 32×32, transparent):
- Changed: `kitchen_pots_pans.png`, `kitchen_oven_mortar.png`, `pet_coop.png`
- New: `kitchen_magic.png`, `kitchen_star_stove.png`, `pet_beehive.png`, `pet_pen.png`, `farm_expand.png`, `farm_greenhouse.png`, `life_bathtub.png`

Yes, the kitchen and pet icon changes you noticed came from us. Her rule now: **a shop icon must look like the real thing you get.**
- The 4 kitchen icons are made from the real sprites in `world/equipment/` (pot+pan, oven+mortar, smart_cooker, star_stove).
- The 3 pet home icons are minis of the real homes from 2026-10-31.

Please commit them together with:
- `art-src/shop_items_1105/`
- `art-src/pet_homes_1031/`
- The doc edits:
  - `docs/GDD.md`: Gio schedule now matches your 87c0642.
  - `docs/m6_art_2026-11-05.md`
  - `docs/gio_sales_summary_2026-11-05.md`
  - `docs/gio_talk_dialog_2026-11-05.md`
  - `docs/handoff/01_status.md`

## 2. Register and use the icons
- Register each icon in `assets-src/registry.json` the same way as `shop_item_kitchen_pots_pans`:
  - `local`, 32×32, `lazy: true`, `jade_tone: false`
  - id `shop_item_<file name>`
  - set `footY` in sprite-meta
- Use the icon for its offer wherever that offer already exists in the shop. Keep the colour box for offers that have no icon yet. Do not add new offers just for this.

| Icon | Offer |
| --- | --- |
| `kitchen_pots_pans` | pot + pan (first tier) |
| `kitchen_oven_mortar` | `oven_mortar` |
| `kitchen_magic` | `magic_kitchen` (= smart_cooker, confirmed) |
| `kitchen_star_stove` | `star_stove` |
| `tray_6` / `tray_10` | tray 6 / 10 slots |
| `rod_iron` / `rod_silver` / `rod_star` | rod tiers |
| `pet_coop` / `pet_beehive` / `pet_pen` | coop / hive / pen (barn) |
| `farm_expand` | every farm-expansion step |
| `farm_greenhouse` | greenhouse |
| `life_bathtub` | bathtub |

- Show the icons at integer scale only, the same as the other shelf items. Never resample.

## 3. Do NOT wire yet
`art-src/pet_homes_1031/` holds the real pet homes (`home_coop_kaipok`, `home_hive_boomboom`, `home_barn_mumumek`) at native size. They are for M8 (the pets meadow). Only keep them in the repo for now.

## 4. Check
- Run the tests.
- Save phone screenshots of the equipment tab and the farm tab to `docs/previews/code/`.
