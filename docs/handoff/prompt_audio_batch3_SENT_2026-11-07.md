# Audio batch 3 prompt — given to her 2026-11-07 05:51 (items 1-7)

```
AUDIO BATCH 3 (Floor & Flavor) — 7 changes in one pass. All new sound files are already in public/assets/audio/{sfx,amb,voice} and listed in public/assets/audio/_audio_index.json (88 keys). Load/preload the new keys the same way as the existing ones. Each item has a spec README in art-src/audio_src/.

1. footsteps on dirt
New SFX: step_dirt_1 .. step_dirt_5 (already in public/assets/audio/sfx + _audio_index.json, same quiet level as step_grass).
BaseScene.footstep() now always plays audioSettings.steps.keys (grass). Make it pick the surface under the player's feet at that moment:
dirt = the farm soil plots and the dirt tiles of the ground layer (tilesets ground_grass_dirt dirt side / ground_farm_soil in public/assets/maps/base.json); everything else = grass.
Add the dirt key list to src/data/audio.json steps (e.g. steps.dirtKeys) and keep a separate take counter per surface. Same frames (2 and 6).
If a tile is half grass / half dirt (wang edge tiles), use whichever covers the feet point; if that is not easy, treat edge tiles as grass and tell her.
Spec: art-src/audio_src/sfx_step_draft/README_step_dirt.txt.

2. pond ambience
New loop: amb/amb_pond (20 s seamless, quiet; group "amb", Ambience volume). Play it on the farm near the pond: volume by distance from the player to the nearest pond water — full volume at the bath/fishing spot (pondSpot), fading to silent about 6 tiles away (make the near/far distances values in audio.json). Keeps playing quietly while fishing or bathing, day and night, also under rain.
Spec: art-src/audio_src/amb_final/README_amb_pond.txt.

3. campfire ambience
New loop: amb/amb_campfire (20 s seamless, quiet; group "amb", Ambience volume). Play it on the farm near the campfire: volume by distance from the player to the campfire — full when standing at the cooking spot, fading to silent about 6 tiles away (same near/far setting style as amb_pond, separate values in audio.json). Keep it running under the cooking sounds (cook_start/cook_loop/cook_done). Day and night, also under rain.
Spec: art-src/audio_src/amb_final/README_amb_campfire.txt.

4. eating / drinking = one crunchy bite
New SFX: sfx/eat_crunch (0.5 s crunchy bite, same level as the old "งั่ม"). Every time she eats OR drinks an item from the bag, play eat_crunch — ONE sound, no alternating. Stop the previous one before starting the next when the player taps fast.
This replaces voice/eat_rapid_1 + eat_rapid_2 ("งั่ม") for eating and drinking: stop loading eat_rapid_1/2 (keep the files in the repo). The only voice line left is item 5 (voice_till_effort), so KEEP the Voice volume slider; its preview sound becomes voice/voice_till_effort.
Spec: art-src/audio_src/sfx_cook_draft/README_eat_crunch.txt.

5. her effort voice when tilling
New voice file: voice/voice_till_effort (0.53 s, her own "push" sound; Voice group). When the hoe hits the ground in the till move (frame audioSettings.farmFrames.till = 6, the same moment farm_till plays) — for till AND dig — also play voice_till_effort, but only about 1 time in 3 (random; put the chance, 0.33, in audio.json as e.g. tillVoiceChance). Never two in a row closer than 1 s.
Spec: art-src/audio_src/voice_draft/README_till_effort.txt.

6. fainting
New SFX: sfx/faint (1.6 s: her voice + soft slide down + soft fall on grass, one file). Play it ONCE when she faints: when the rest curtain opens with cause 'faint' (eventBus 'rest-finished' with cause === 'faint', curtain in src/ui/hud.ts; note sound.ts treats the 'rest' window as silent — make sure this one still plays). Not for normal sleep or passed_out. SFX volume group.
Spec: art-src/audio_src/voice_draft/README_faint.txt.

7. twin two-note bell
New SFX: sfx/twin_chime (1.4 s, "กริ๊ง~ กรุ๊ง~": high bell = older twin, then low bell = younger twin).
1) Floor-5 twin reveal scene, step 2 (the two-note bells): play it once — this fills the empty sound hook you left.
2) Yard decoration กระดิ่งลมแฝด (deco_bell_chime): when the player comes within ~2 tiles, play twin_chime at about 60% volume, at most once every 10 s (values in audio.json).
SFX volume group. Spec: art-src/audio_src/sfx_chime_draft/README_twin_chime.txt.

Do not change the existing audio files or other triggers unless listed above. Run the tests, commit, and give her the test link. Report triggers you could not find or had to guess.
```
