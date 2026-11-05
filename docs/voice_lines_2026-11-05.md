# Heroine voice lines — recording list (planning side, 2026-11-05)

The heroine is voiced by **the user herself**, starting with the eating sound "หม่ำแล้วนะ" (audio side, eat.wav). This is the list of other moments that could have her voice. She records them; the audio side cleans and names the files; the code side triggers them.

## Recording tips
- Keep each line **short**: 1–3 words, 0.3–1.2 s. Players hear them many times, and short lines don't get annoying.
- Do **2 takes** of anything that plays often (marked ×2). The game picks one at random so it doesn't sound repetitive.
- Keep the same distance from the mic and a similar volume in every take, so all lines match the "หม่ำแล้วนะ" file.
- A soft, cute, natural voice. No need to act big.

## Lines (⭐ = suggested for MVP first)

| # | Moment | Example (she may change the words) | Mood | Takes | File name |
|---|---|---|---|---|---|
| 1 | Eat (done) | "หม่ำแล้วนะ" / "งั่ม" | happy | done | eat, eat_rapid_1/2 |
| 2 ⭐ | Hungry (fullness gauge low) | "หิวจัง…" | soft, a little whiny | ×2 | voice_hungry_1/2 |
| 3 ⭐ | Tired / sleepy (energy low, near faint) | "ง่วงแล้ว…" | sleepy | ×2 | voice_tired_1/2 |
| 4 ⭐ | Happy (harvest, good catch) | "เย้!" / "ได้แล้ว!" | bright | ×2 | voice_yay_1/2 |
| 5 ⭐ | Cooking finished | "เสร็จแล้ว~" | pleased | ×1 | voice_cook_done |
| 6 | Wake up (morning) | "อรุณสวัสดิ์~" / a yawn "ฮ้าว…" | sleepy-happy | ×1 | voice_wake |
| 7 | Fishing: bite "!" | "มาแล้ว!" | surprised | ×1 | voice_fish_bite |
| 8 | Fishing: missed | "อ๊ะ หลุด!" | disappointed, cute | ×1 | voice_fish_miss |
| 9 | Pat Gio / give a treat | "เก่งมากจีโอ" / "กินเยอะๆ นะ" | gentle | ×2 | voice_gio_pet_1/2 |
| 10 | Faint (gauge hits 0) | "อ๊ะ…" (falling) | weak | ×1 | voice_faint |
| 11 | Bath (pond) | "สดชื่นจัง~" | relaxed | ×1 | voice_bath |
| 12 | Cooking failed | "แง…ไหม้ซะแล้ว" | sad-funny | ×1 | voice_cook_fail |
| 13 | Get coins (sales summary "รับเงิน!") | "ว้าว!" | delighted | ×1 | voice_coins |

Later (when those systems exist): a monster likes the food, gate cleared, level up / rank up, a new pet.

## Notes for the code side (later, together with the audio prompt)
- Add a separate **Voice** volume slider in Settings, next to Music and SFX.
- Don't play the same voice line again within ~3 s, and don't play two voice lines at once. Hungry/tired lines play at most once per in-game hour.
- Voice lines must not cover important SFX (the fishing bite). Duck the music a little while a line plays.

## Audio-side notes (added 2026-11-05 05:25, after recording)
**Line 14 (new):** Drink | "อึก อึก อึก… อ่า~ สดชื่นจังเลย" | refreshed | ×1 | `drink` (art-src/audio_src/sfx_cook_draft/drink.wav, 3.8 s — check the length in game).

**Status: ALL lines 1–14 are recorded in her voice** (original key, cleaned, level-matched). Files: `art-src/audio_src/voice_draft/` (lines 2–13, 2 takes each, `_1/_2`) and `art-src/audio_src/sfx_cook_draft/` (eat, eat_rapid_1/2, drink). Raw takes: `art-src/audio_src/her_voice/`.

Trigger notes from the audio side:
- Line 5 "เสร็จแล้ว~" plays **after** the `cook_done` SFX ends (~0.9 s), not on top of it.
- Line 7 "มาแล้ว!" plays just **after** the fishing "!" alert SFX, never covering it.
- Lines 2 (hungry) and 10 (faint) overlap the old SFX ideas `warn_hungry` (stomach growl) and `faint`: for now the voice is used; a soft SFX can be added later if she wants.
- Eat rapid presses: if eat is pressed again within 1.5 s, alternate `eat_rapid_1/2` ("งั่ม") instead of "หม่ำแล้วนะ". This is the one exception to the "same line not within 3 s" rule.
- Lines 9 (Gio pet) and 13 (coins) wait for M6 systems.

## DECISION 2026-11-05 18:20 (her, after testing in game)
Too many voice lines. The heroine now has ONLY one sound: a short "งั่ม" (eat_rapid_1 / eat_rapid_2, alternating) when eating or drinking. All other lines (incl. "หม่ำแล้วนะ" and drink) are removed from the game. The recordings stay in art-src/audio_src/voice_draft + her_voice for possible later use. Future direction if voice comes back: short non-verbal sounds ("ฮึบ", "อ่า~", "อ๊ะ!"), very few moments.
