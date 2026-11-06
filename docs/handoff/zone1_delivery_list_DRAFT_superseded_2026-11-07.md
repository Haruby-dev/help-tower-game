# Zone 1 monsters — delivery list (DRAFT for her review, 2026-11-07)

Status: DRAFT. Not zipped, not sent, no code prompt yet. She reviews this list first.

## Naming (technical default, follows the 3 monsters already in the game)
`public/assets/monsters/<id>/<id>_<state>_<anim>.png` — ids from `src/data/monsters.json`.
Every movement sheet is shipped as `_walk` (rows S, E, N, W) even when the motion is a hover / slide / hop; the real motion and its frame
timing are listed below and go into the monster data. Previews (`*.gif`, `preview_*`, `contact_*`) are never shipped.

| id (code) | art folder | canvas | bottom line (last opaque row of the stand) | movement | move timing | eat |
|---|---|---|---|---|---|---|
| mookmik (in game) | `art-src/outline_fix_1106/mukmik/` | 40 | as now | hop (drop-in replacement, plum outline) | as now | as now |
| toomtia | `art-src/outline_fix_1106/tumtia/` (USE these, not tumtia_1106/final) | 48 | 45 | sleepy walk | 140 ms | 8f 150 ms |
| tangkrading (twins) | `art-src/hangkradueng_1106/final/` + `reveal/` | 56 | feet 46 | 4-legged walk | 110 ms | 8f 150 ms |
| yaibaimai | `art-src/yaibaimai_1106/final/` | 48 | 44 | granny walk | 160 ms | 8f 150 ms |
| wingwing | `art-src/wingwing_1106/final/` | 56 | 50 | **hover** (flies) | 140 ms | 8f 150 ms |
| tubpong | `art-src/tubpong_1106/final/` | 56 | 55 | **slide on the lily pad** | 180 ms | 8f 150 ms |
| jaotungtong | `art-src/jaotungtong_1106/final/` | 64 | 59 | royal walk (feet bob to 62) | 160 ms | 8f 150 ms |
| puefaotung | `art-src/puefaotung_1106/final/` | 64 | 60 | **hop on the base** | 140/100/100/140/100/160 ms | 8f 150 ms |

## Files per monster (sweet + hungry each)
- stand 4 dir (S E N W in one row), movement 4 dir × 6 frames, eat south × 8 frames.
- toomtia: `tumtia_{sweet,hungry}_{stand_4dir,walk_4dir,eat_s}.png` -> `toomtia_{state}_{stand,walk,eat}.png`
- yaibaimai: `yai_*` -> `yaibaimai_*`; wingwing: `*_hover_4dir` -> `_walk`; tubpong: `*_slide_4dir` -> `_walk`; puefaotung: `pft_*_hop_4dir` -> `puefaotung_*_walk`; jaotungtong: `jtt_*` -> `jaotungtong_*`.
- **Twins (tangkrading)**: three states `a_full` (straw, older), `b_full` (lilac, younger), `hungry` × stand/walk/eat, plus reveal set:
  `reveal_shake_long_south` (20f: f1 300 ms, f2-19 80 ms, f20 800 ms), `a_full_tease_giggle_run` (giggle 3f ×2 at 120 ms, run E/W 6f 90 ms),
  `{a_full,b_full}_happy_jump_south` (6f 110 ms — v3 approved 2026-11-07: higher jump, ^^ eyes in the air, hearts/sparkles baked in).
- **Twin wind chime** (quiz reward deco): `deco_bell_chime.png` 48x64 + `deco_bell_chime_sway_8f.png` (180 ms).
- **strawberry_juice** dish art (4 files, targets in `art-src/strawberry_juice_1106/README.md`).

## Game behaviour the code side must know (from GDD / specs)
- wingwing / tubpong / puefaotung never walk: their movement sheet plays while the code moves them.
- puefaotung hungry = **no bird** (the bird "flew away"); fed = bird back (just swap state sheets).
- jaotungtong hungry = green unripe wheat antlers; fed = golden.
- Twins: random 50/50 per floor-5 visit, never both before the reveal; fake-100% bar (A then B, B capped at 90% while hidden);
  reveal scene + guessing quiz (correct = wind chime); after the reveal: names หางกระดิ่งพี่ / หางกระดิ่งน้อง. Full rules: GDD twin section.
- Larger canvases (56/64) need the bottom line values above for y-sorting and shadow placement.

## Open questions for her before sending
1. Ship everything in ONE delivery (as decided 2026-11-06) or split (monsters first, twins feature second)?
2. ~~Twins happy-jump review~~ DONE 2026-11-07 (v3 approved).
3. Include the plates D1 / m7a prompts she has not sent yet, or keep them separate?
