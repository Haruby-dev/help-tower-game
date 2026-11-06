# Hangkradueng หางกระดิ่ง (floor 5 monster, TWINS) art — 2026-11-06

Approved by her ("1" at 04:41). Files: `art-src/hangkradueng_1106/final/` (not in `public/` yet, not sent to the code side).

## Story decision (hers): mischievous twins แฝดขี้แกล้ง
- Floor 5 is really **two wolf pups** (twin A and twin B) who disguise themselves as one and take turns visiting, to prank the player.
- Before the reveal both look **identical** (twin B rolled in the hay, so its fur looks straw like A). Each twin has **its own food taste**, so the player wonders "yesterday it liked this, why not today?".
- When **both** reach 100% liking, they come **together** and twin B shakes the hay off: real lilac fur is revealed. Line idea: "แฮ่~ หลอกได้ละ! เราเป็นแฝดกันนะ! กริ๊ง กริ๊ง!"
- Difficulty: her pick **medium**. A teasing line when the player serves a dish that twin does not like (e.g. "เอ๊ะ~ วันนี้ไม่อยากกินอันนี้แฮะ คิกๆ") so it reads as a prank, not a bug. The two taste profiles should clearly differ.
- Reveal = **only at 100% for both** (her pick B). Full-state colour before the reveal is A (straw) for both.
- Optional later: a "shake off the hay" reveal animation (1-3 cr), small clues (hay bit on the head, different bell note).
- NOT decided yet: twin B's taste table, how the code picks which twin visits each day, the reveal scene, GDD liking/score numbers for two monsters.

## Look
- Cheerful round chibi wolf pup, upright pointed ears (pink inside), **red eyes with a white star sparkle in every state** (her pick: red eyes even when full; hungry is shown by grey fur + wilted clover only), tiny closed smile, pink blush, **small green clover mark on the forehead** (her pick C3, 5x5), light blue bows on both sides of the head, light blue scarf with a gold bell, fluffy tail, dark plum outline.
- Ref = her AI image (straw wolf pup, pigtails with blue bows, blue scarf, gold bell). Round 1 (pixen A/B/C, 3 cr) rejected: "ugly, does not fit" (brown outline, realistic dog mouth, heavy shading). Round 2 prompt in the kawaii style (round blob, simple round eyes with a star, closed smile, plum outline, 2-tone shading), 3 cr: she picked F; stars drawn in the eyes by hand (F1), clover added by hand (C3).

## Colours (recolour scripts, 0 cr)
| State | Fur | Clover | Who / when |
|---|---|---|---|
| `a_full` | H1 pale straw (fur sat x0.45, val x1.03) | green | both twins before the reveal; twin A after |
| `b_full` | H5 lilac grey (hue 0.78, sat x0.25, val x0.95) | green | twin B after the reveal only |
| `hungry` | G2 warm grey (sat x0.12, val x0.92) | wilted brown `#8a6a45 #a8844f #d2b47a` | both twins, always |
Red eyes `#4a0a16 #7a1626 #9c2234 #d0606a`; bell gold, bows/scarf blue and blush unchanged.

**File names are neutral on purpose** (`a_full`, `b_full`, `hungry`; no "twin"/"lilac") so the secret does not leak from the web build's file list. Tell the code side to keep it that way.

## Sheets (`final/`) — ALL cells 56x56, feet line y=46 (display 1:1)
| File | Layout |
|---|---|
| `hangkradueng_<state>_stand_4dir.png` | 224x56, S E N W (40px sprite padded +8,+8) |
| `hangkradueng_<state>_walk_4dir.png` | 336x224, rows S E N W, 6 frames, 110 ms. 4-legged walk, no hop (her rule: front must match the sides). N frames 2-6 sit 1 px higher (AI). |
| `hangkradueng_<state>_eat_south.png` | 448x56, 8 frames south, 150 ms, loop 1-8: 1 looks down, 2-6 head down eating with happy closed ^^ eyes, 7 lifts, 8 = stand pose. AI frames as made. |
Previews: `preview_twins_set.png`, `preview_twins_walk.gif`, `preview_twins_eat.gif`, `preview_eat_frames.png`.

Hand fixes: side views E/W — star eyes added, clover moved from the top of the head to the forehead (C3 pattern), then imported. Walk — the stand face (star eyes, mouth) pasted back on S and E/W frames (AI made solid black eyes / open mouth). Front walk v1 (hop) rejected; kept in `drafts/walk/s1hop_fix_*.png` (could be a happy/jump anim later).

## PixelLab
- Rotation char `9fce9dc6` "hangkradueng v1 (rotate)" (1 cr). Import char **`5cca140c` "hangkradueng v2 (import)"** (0.25 cr) = the approved 4 dirs.
- Walk v3 custom: S group `326e8ce9` (no hop), E/N/W group `53c35168` (its S = rejected hop version). Eat v3 custom S group `35ffdfe6`.
- Credits: 13.25 (pixen 6, rotate 1, import 0.25, walk 5, eat 1).

## Code side notes (later)
- Canvas 56x56 (Puinun/Popcorn/Mukmik 40, Tumtia 48).
- Monster data needs two entries (twin A, twin B) that share a display name before the reveal; twin B uses `a_full` art until both are 100%, then `b_full`.

## Reveal + tease art (added 05:33, her OK) — `art-src/hangkradueng_1106/reveal/`
| File | Layout / use |
|---|---|
| `hangkradueng_reveal_shake_long_south.png` | 1120x56, 20 frames south (56x56). Twin B shakes the hay off: f1 hold 300 ms (straw disguise, star eyes) · f2-19 shake 80 ms each = AI shake frames 2-7 looped 3x (cycle 1 straw, cycle 2 lilac revealed head-down with a jagged edge, cycle 3 lilac) · f20 hold 800 ms (lilac, star eyes, hay on the ground). Hay bits drawn into the frames. Her ask: "shake longer" (first 8-frame version kept in drafts/reveal/). |
| `hangkradueng_a_full_tease_giggle_run.png` | 336x168, 56x56 cells. Row 1 = giggle south (3 frames, eyes ^^, play 2x at 120 ms). Row 2 = run east (6-frame loop, 90 ms). Row 3 = run west (mirror). Twin A teasing visit: giggle, then run off screen. Straw only. |
| `hangkradueng_{a_full,b_full}_happy_jump_south.png` | 336x56, 6 frames, 110 ms. **v3 approved by her 2026-11-07**: extra lift 0,1,3,4,2,0 px (feet leave the ground f3-f4), f2-f5 happy ^^ eyes, f1/f6 star eyes, big open mouth with tongue on all frames, fx_heart_5 + fx_sparkle_5 baked in the side margins (f2-f5), f3 clover fixed. v1 kept in `reveal/drafts/`. Script `reveal/happy_jump.py` + `reveal/faces.py`. |
Mocks: `hangkradueng_reveal_long_mock.gif`, `hangkradueng_tease_mock.gif`, `hangkradueng_twins_happy_jump.gif`.
PixelLab: shake v3 S group `f2ba5bcc` (1 cr), run v3 E group `a8eb91ef` (1 cr). Hangkradueng total now **15.25 cr**.
