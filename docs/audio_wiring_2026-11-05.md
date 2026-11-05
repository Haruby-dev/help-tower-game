# Audio wiring — first in-game test (audio side, 2026-11-05)

All files are DRAFTS she approved by ear; this pass is so she can test them IN THE GAME (phone + PC). Expect changes after her test.
Files: `public/assets/audio/{bgm,sfx,voice}/<id>.ogg` + `<id>.m4a` (same name; load both URLs per key — Phaser picks the one the browser can play; iPhone Safari needs .m4a). Index of all 51 keys: `public/assets/audio/_audio_index.json` (key -> group).
Sources / READMEs (timings, loudness, licences): `art-src/audio_src/*_draft/README*.txt`, `docs/audio_list.md`, `docs/audio_licences.md`, `docs/voice_lines_2026-11-05.md`.

## 1. Volumes and settings
- Three groups with their own volume: **Music** (bgm), **SFX** (sfx), **Voice** (voice). Defaults: Music 0.65, SFX 1.0, Voice 1.0 (she wants music BELOW sfx).
- Add three sliders in Settings (phone settings app if that is where settings live). Save in the existing save/settings store.
- Mobile: audio must be unlocked on the first user tap (Phaser handles it; make sure title music starts after the first tap if needed).

## 2. Music (bgm) — "play once from 0, then loop from X to the end"
| key | where | loop start (s) | end (s) |
|---|---|---|---|
| bgm_title | title screen | 32.0 | 64.0 (file end) |
| bgm_farm_day | farm 06:00–18:00 game time | 12.5 | 72.5 (file end) |
| bgm_farm_night | farm 18:00–02:00 | 6.32 | 56.8 (file end) |
- Implement the intro + loop (Phaser sound markers, or play once then loop a marker from X). Seams are pre-crossfaded (no click).
- Day <-> night: crossfade ~3 s at 18:00 and 06:00. Title -> farm: fade out title ~1 s.
- While a heroine voice line plays: duck music to ~70 % and restore over ~0.4 s.

## 3. SFX triggers
UI (all screens, phone, bag, recipe book):
- `ui_tap` button tap · `ui_open` open phone/app/window · `ui_close` close · `ui_page` recipe book page/tab change · `ui_error` cannot do it (no item, bag full, can't cook) · `ui_coin` coin gained.
Farm (Player.playGardenMove onFrame — the same hook used for dirt puff / splash; 9 frames × 125 ms; same frame for every direction):
- `farm_till` frame 6 · `farm_plant` frame 4 · `farm_water` frame 5 · `farm_harvest` frame 7.
Fishing (see art-src/audio_src/sfx_fishing_draft/README.txt):
- `fish_cast` on the rod snap (east frame 6 / south 5 / north 4 of the cast intro at 8 fps — please verify) · `fish_plop` landBobber() · `fish_nibble` each nibble anim · `fish_alert` startBite() ("!") · `fish_reel` when the reel starts · `fish_catch` reel ends with a catch (showCatch) · `fish_escape` reel ends with no catch.
Cooking (campfire):
- `cook_start` when the cook INTRO animation starts (frame 0). Its sizzle swell lands on frame 4.
- `cook_loop` start at intro frame 4 (when the loop animation starts), loop the whole file (7.5 s) while cooking; stop (fade 0.15 s) when cooking stops or finishes. Positional/near the campfire is not needed now; just stop it when the player leaves the farm scene.
- `cook_done` once when the cooked dish appears above the campfire (Campfire.showDone moment). Stop cook_loop at the same moment.

## 4. Voice (heroine = her own voice). Random pick between _1/_2 where two takes exist.
| keys | moment |
|---|---|
| eat | press eat on a food item in the bag. RAPID: if eat is pressed again within 1.5 s of the last eat voice, play eat_rapid_1 / eat_rapid_2 alternately instead. Stop the previous eat voice before starting the next. |
| drink | eat/drink on a drink (bamboo cup) item (3.8 s; her note: check the length in game) |
| voice_cook_done_1/2 | after cook_done ends (~0.9 s after it starts) |
| voice_cook_fail_1/2 | when mystery food is collected (failed cooking) |
| voice_hungry_1/2 | fullness gauge becomes low (use the existing warning threshold); max once per in-game hour |
| voice_tired_1/2 | energy/clean/happy low warning near faint (use the existing tired/low warning); max once per in-game hour |
| voice_faint_1/2 | faint |
| voice_yay_1/2 | harvest a crop, and a fish catch (play ~0.3 s after fish_catch) |
| voice_fish_bite_1/2 | ~0.25 s after fish_alert, never on top of it |
| voice_fish_miss_1/2 | with fish_escape |
| voice_wake_1/2 | waking up in the morning (after sleep) |
| voice_bath_1/2 | bath at the pond (when the bath starts or ends — your choice, tell her) |
| voice_gio_pet_1/2, voice_coins_1/2 | NOT YET (M6: pat Gio / treat, sales summary coins). Load them, no trigger yet. |
Voice rules: never two voice lines at once (a new line stops the old one); the same line not again within ~3 s (eat rapid rule is the exception); duck music while a line plays.

## 5. Please report back
- Which triggers you could NOT find or had to guess (exact function names), and the bath/tired choices you made.
- Anything that sounds wrong on iPhone (loop seams in .m4a, delays, missing first sound).
- Total audio size added to the build (~7 MB now).
