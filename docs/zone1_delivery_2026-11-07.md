# Zone 1 monsters 4–10 + twins feature — delivery 2026-11-07 (her OK: "พรอพส่งโค้ดเลย")

All art is already copied into `public/assets/` (61 files, byte-checked against `art-src/`). Not committed yet.
Sources stay in `art-src/` (specs: `docs/<name>_art_2026-11-0x.md`). Previews (`*.gif`, `preview_*`, `contact_*`) are not shipped.

## 1. Files in public/assets
Every monster: `monsters/<id>/<id>_<state>_{stand,walk,eat}.png`, states `sweet` + `hungry`
(twins: `a`, `b`, `hungry`). Layout identical to puinun/popcorn/mookmik:
stand = 4 cells in one row (S, E, N, W) · walk = 6 cols × 4 rows (rows S, E, N, W) · eat = 8 frames, south only.
Hungry sheets are fully drawn (colours, faces, missing bird) — do not tint them in code.

| id | cell | feet (last opaque row of the S stand, cell coords) | visible height | walk sheet is really… | walk ms | eat ms | eatFrames |
|---|---|---|---|---|---|---|---|
| mookmik | 40 | 37 | 36 | hop (unchanged) | 110 | 150 | unchanged |
| toomtia | 48 | 45 | 44 | sleepy walk | 140 | 150 | 0–7 |
| tangkrading | 56 | 46 | 38 | 4-legged walk | 110 | 150 | 0–7 |
| yaibaimai | 48 | 44 | 43 | granny walk | 160 | 150 | 0–7 |
| wingwing | 56 | 50 | 46 | **hover** (she flies; shadow stays on the ground line) | 140 | 150 | 0–7 |
| tubpong | 56 | 55 | 55 | **slide on the lily pad** | 180 | 150 | 0–7 |
| jaotungtong | 64 | 59 | 59 | royal walk (feet dip to row 62 on steps) | 160 | 150 | 0–7 |
| puefaotung | 64 | 60 | 58 | **hop on his base** | per frame **140,100,100,140,100,160** | 150 | 0–7 |

- `mookmik/*` (6 files) were **replaced** in place by the plum-outline versions (her gang rule). Same size and layout, drop-in.
- Canvases differ (40/48/56/64): anchor each sprite by its feet row, not by the cell bottom, so feet sit on the same ground line as the player.
- Movement for wingwing / tubpong / puefaotung: they never walk; play their walk sheet while the code moves them.
- State meaning: jaotungtong hungry = green unripe wheat antlers (fed = golden). puefaotung hungry = **no bird on the shoulder** ("นกหนีไปหมดแล้ว…").

## 2. Twins (floor 5, tangkrading) — rules in GDD section "แฝดขี้แกล้ง" (docs/GDD.md ~line 1024–1047)
Extra sprites (56x56 cells, south):
| file | layout | timing | use |
|---|---|---|---|
| `tangkrading_b_shake.png` | 20 frames | f1 300 ms, f2–19 80 ms, f20 800 ms | reveal: twin B shakes off the hay → lilac |
| `tangkrading_a_giggle_run.png` | row 1 giggle 3 frames (play ×2), row 2 run east 6, row 3 run west 6 | giggle 120 ms, run 90 ms | twin A teasing visit after the bar switch: giggles, runs off screen, does not eat |
| `tangkrading_a_jump.png` / `tangkrading_b_jump.png` | 6 frames | 110 ms | reveal step 4 happy jump (hearts/sparkles are baked in) |
Short checklist (details in the GDD section):
- 36 points EACH. Liking bar = "fake 100%": shows twin A only; at A 100% the door stays shut, giggle line, the bar switches to twin B (B's hidden points, capped at 90% while hidden). B full → reveal scene → door opens → Gio news next day.
- Visits: floor 5 picked as usual, then 50/50 A or B, never both on one day before the reveal. After the switch: mostly B; A drops by 1 in 5 floor-5 visits (giggle + run, no eating).
- Twin A = current `monsters.json` entry (fav grilled_fish, drink tomato_juice, likes home_kaprao + boiled_egg, dislike grilled_corn, signature fish_congee ★1).
  **Twin B (new data):** fav grilled_corn, drink warm_honey_milk, likes boiled_egg + warm_honey_milk, dislike grilled_fish, signature **grilled_corn ★3**; asks for the signature only after the bar switched.
- Teasing line when a twin gets a dish it dislikes (so it reads as a prank, not a bug). Verbal tics: A ends lines with "กริ๊งๆ", B with "คิกๆ".
- Reveal scene order: arrive together (both straw) → two-note bells → **guessing quiz** (random left/right, each says one line, tap who likes fish = A) → B shake (`b_shake`) → both jump + line → door opens → next-day Gio news. Names after the reveal: หางกระดิ่งพี่ (A) / หางกระดิ่งน้อง (B).
- Quiz right → decoration **"กระดิ่งลมแฝด"** `world/yard/deco_bell_chime.png` (48x64) + idle `deco_bell_chime_sway_8f.png` (8 × 48x64, 180 ms, loops), placeable in arrange mode like other decorations. **Daily happiness: +5** (her pick 2026-11-07 01:18; replaces the TODO placeholder). Quiz wrong → no reward, retry on later floor-5 visits.
  Its daily happiness value is **not decided yet**: use a placeholder in data, mark it TODO, and report it to her.
- Lines: merge the `twins` block of `docs/dialogue_zone1_draft.json` into `src/data/dialogue.json` (draft text, she may still edit words).
- Audio: the two-note bell does not exist yet (audio side); leave the sound hook empty.

## 3. strawberry_juice dish art (drink for wingwing + jaotungtong)
`food/dishes/`, `food/dishes_bag/`, `food/tray_mini/`, `food/mini16/` — all `strawberry_juice.png`. Replaces the mound fallback.

## 4. Not in this delivery (on purpose)
Phone UI (on hold until she finishes it) · crafting (open questions) · pacing simulation (not approved yet) · twin two-note bell sound · debug item spawner removal (before release).
