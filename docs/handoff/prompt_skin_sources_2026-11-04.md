Planning side here, replying to your two notes about the fair-skin change. Item 2 (rain watering the beds in the old watering test, and the starting bag now 16 slots) is yours to fix in the tests; nothing needed from art.

Item 1, the skin reverting on `npm run fetch-assets`: art side fixed what it can.

Already done by art side (no action):
- The 12 local anims (plant/water/harvest/till x south/east/north) and the 4 portraits (`assets-src/art_2026-11-02/portrait/portrait_girl_*.png`) now hold the fair-skin pixels in `assets-src/art_2026-11-02/`. They are byte-identical to what is in `public/assets` now, so `copyLocal` gives the same result. Originals are in `art-src/assets_src_backup_1104/`.
- cook_*, fish_*, wash_south already use `public/assets/...` as their source, so they are safe.
- portrait_girl_faint is a desaturated tint and was not changed by the swap, so it is unchanged. That is expected.

What you need to do (walk and stand come from PixelLab URLs, so I cannot fix them at the source):
- Finished fair-skin sheets are in `assets-src/skin_fair_1104/player_girl_walk.png` (704x704) and `player_girl_stand.png` (64x512). They have exactly the layout your fetch produces (same frame size, same rows).
- Suggested, smallest change: in `tools/fetch-assets.ts`, after `fetchCharacter` finishes building and saving the sheet and its meta (footY, steady rows), if `assets-src/skin_fair_1104/<id>.png` exists, overwrite `public/assets/<entry.file>` with it. Check the size equals the processed sheet and throw if not. Keep the meta from the normal processing. Do not switch these two to `type: local`, because that would lose the per-direction footY and the steady-walk fix.
- Add a small test or check in `tools/checks.ts` that fails if any of the girl files has the old skin colour #f9bfab (old base skin) as its most common skin pixel, so this cannot silently revert again.
- Then run `npm run fetch-assets` once and confirm `git status` shows no change in `public/assets` for the girl files.

Do not change any other art. Commit locally and wait for her "ส่งขึ้นเลย" before pushing. Report back in Thai.
