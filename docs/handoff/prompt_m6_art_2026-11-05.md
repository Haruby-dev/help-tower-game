M6a art + Gio fixes (after M6a is pushed). Read docs/handoff/00_rules.md and docs/m6_art_2026-11-05.md first. All art is already in public/assets (approved by her). Commit locally, wait for her "ส่งขึ้นเลย" before pushing, report back in Thai.

A. Replace the M6a colour-box placeholders with the real art (paths and sizes in docs/m6_art_2026-11-05.md):
   1. Talk icon on the context action button: ui/hud_v2/icon_talk.png.
   2. Gio talk dialog: keep it as a bottom dialog (NOT a bubble over his head), restyled exactly per docs/gio_talk_dialog_2026-11-05.md. That means the tool-tray 9-slice box, cat ears, the portrait frame with Gio, 2x2 tool-slot buttons with 12 px icons, the pressed state, the close coin, the treat count "×n", the unread-news dot, the grey button when there are 0 treats, and the green check mark after the daily pat.
   3. Evening sales summary: Gio's receipt per docs/gio_sales_summary_2026-11-05.md. The list scrolls inside the receipt when there are more than 3 item kinds; there is a gift row; HUD is hidden while it is open; "รับเงิน!" is inside the receipt.
   4. Coin icon ui/coin_paw_12.png everywhere money is shown.
   5. Shop shelf items: kitchen_pots_pans, kitchen_oven_mortar, recipe_scroll_savory / recipe_scroll_sweet (savory vs sweet by dish type), tray_6, tray_10, rod_iron / rod_silver / rod_star, pet_coop, pet_beehive. Other items keep their colour boxes for now.
   6. Treat-eating: gio_eat_lick_south.png plays 2 loops when she gives a treat, with floating hearts by flavour (fx_heart_5 / fx_sparkle_5, rules in the doc). No packet sprite.

B. Gio body size fix (her report from an in-game video: 4-leg poses looked bigger than sitting, and front/back looked skinny):
   - Use the new set gio_stand4 + gio_walk4_{south,east,west,north} (68x68 frames, feet at y=60, centred x=34). Retire the old gio_walk_* sheets.
   - Align gio_sit to the same feet line, so switching sit <-> stand <-> walk never jumps.
   - The back view (north) of gio_sit / gio_sit_blink / gio_stand4 / gio_walk4_north now has a bigger backpack (art already replaced in public, same file names). Just re-run fetch/registry checks; no code change needed for that.
   - Add an e2e/unit check that every Gio frame used in-game has its feet on the same line.

C. Gio bugs from the same video:
   1. Gio sits BESIDE his basket seat (world/yard/gio_seat.png) instead of IN it. Make him sit centred in the basket, drawn on top of the basket's inner floor (basket rim in front of his lower body if there is a front layer; otherwise just centred).
   2. When he walks away he walks over the basket rim. Path around it, or start his walk from the basket's front edge.
   3. A frame of two overlapping semi-transparent Gio sprites appears when he switches poses. Remove the crossfade; swap sprites instantly.
   4. After stopping he slides north in a standing pose with no leg motion. Any movement must play the walk animation for that direction; idle = stand4 (or sit when on the seat).

D. Remove the text label (pill) under the context action button for ALL actions (her decision 2026-11-04 23:04; it was added by the batch-cooking prompt before she changed her mind). Keep the i18n strings.

Run all tests, update docs/progress.md and assets-src/registry.json, commit locally, then wait for "ส่งขึ้นเลย".
