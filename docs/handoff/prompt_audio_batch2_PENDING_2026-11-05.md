# PENDING audio prompt — items 1-11 GIVEN TO HER 21:50 as prompt_audio_batch2_SENT_2026-11-05.md. Start a new pending file for the next batch.
She wants to send audio changes in ONE batch (code-side tests take long). Add new items here as they get approved, then give her the merged prompt.

## Item 1 (approved 18:20) — heroine voice cut to "งั่ม" only
```
The heroine's ONLY voice is now "งั่ม": voice/eat_rapid_1 and voice/eat_rapid_2. Play them alternately (1, 2, 1, 2...) every time she eats OR drinks an item from the bag. Stop the previous one before starting the next.
Remove all other voice triggers: eat ("หม่ำแล้วนะ" = voice/eat), drink, hungry, tired, yay, cook_done, cook_fail, fish_bite, fish_miss, faint, wake, bath, gio_pet, coins. Stop loading those voice files (keep the files in the repo).
Keep the Voice volume slider (it now controls only "งั่ม"). Remove the music ducking for voice lines if it is no longer used.
Spec: section "UPDATE 2026-11-05 18:20" at the top of docs/audio_wiring_2026-11-05.md.
```

## Item 2 (approved 18:45) — bath sounds at the pond
```
New SFX files (already in public/assets/audio/sfx + _audio_index.json): bath_scoop, bath_splash_1, bath_splash_2, bath_splash_3, bath_splash_4, bath_sparkle.
Bath = BaseScene.startBath()/endBath(), player pose 'anim_wash' (wash_south, 8 fps: frames 0-8 once, then loop frames 2-8).
- Every time the wash animation shows frame 4 (hands go into the water): play bath_scoop.
- Every time it shows frame 6 (water hits her face): play the next bath_splash, cycling 1 -> 2 -> 3 -> 4 -> 1 ... (on EVERY loop, also the first pass).
  Hook this to the sprite's animation-update event for the frame index, so the sound stays on the picture even if fps changes. Stop listening in endBath().
- endBath(): play bath_sparkle once (the "clean!" sound). Remove the voice_bath speak calls (see item 1).
- The existing bubble/sparkle particles stay silent (no sound per particle).
Group: SFX volume. Spec: art-src/audio_src/sfx_bath_draft/README_bath.txt.
```

## Item 3 — settings voice preview
```
src/ui/settings.ts line ~255 previews the Voice slider with sound.speak('voice_yay'). After item 1 voice_yay is no longer used: preview with voice/eat_rapid_1 instead.
```

## Item 4 (approved 19:06) — rain starts
```
New SFX: sfx/rain_start (4.2 s, already quiet on purpose). Play it ONCE when gameState.world.weather changes to 'rain' while the player is in the game (e.g. a new day starts with rain, or weather switches during play). Do not play it on load/continue if it was already raining, and do not loop it. The visual rain is drawn in src/scenes/weatherEffects.ts; BaseScene passes the weather in update() — detect the change from "not rain" to "rain" there or wherever the weather is set.
Group: SFX volume. Spec: art-src/audio_src/sfx_rain_draft/README_rain_start.txt.
```

## Item 5 (approved 19:28) — footsteps on grass
```
New SFX: step_grass_1 .. step_grass_5 (quiet, ~0.26 s each). In src/entities/Player.ts, while the walk animation (player_girl_walk, 8 frames, 10 fps) is playing, play one footstep every time the frame index becomes 2 or 6 (foot touches the ground) — use the animation-update event, so running (timeScale x1.5) speeds the steps up automatically. Cycle 1..5 or pick randomly without repeating the previous one. No steps while standing still, fishing, bathing, cooking or in poses. Check frames 2/6 look like foot contact in all 8 directions; if a direction differs, tell her which frames you used.
Group: SFX volume. Spec: art-src/audio_src/sfx_step_draft/README_step_grass.txt.
```

## Item 6 (approved 19:41) — crop is ready
```
New SFX: farm_grown (0.45 s twinkle). Play it when a crop becomes ready to harvest and its ready sparkle (fx_sparkle_idle) starts — not on every sparkle loop, and not again for the same crop. If several plots become ready at the same moment (e.g. the morning after sleeping, when the farm scene appears), play it only once (at most once per 2 s). Group: SFX volume.
Spec: art-src/audio_src/sfx_farm_draft/README_farm_grown.txt.
```

## Item 7 (approved 20:11) — hungry warning
```
New SFX: warn_hungry (1 s cute stomach growl). In src/ui/sound.ts createWarnings(): when the fullness gauge enters the alert zone, play sound.play('warn_hungry') instead of the removed voice_hungry. Keep the same rules (once each time it enters the zone, at most once per warningEveryGameHours). It is an SFX now (SFX volume group, no music ducking). The happiness branch is item 8.
Spec: art-src/audio_src/sfx_gauge_draft/README_warn_hungry.txt.
```

## Item 8 (approved 20:19) — happy / clean gauge warning
```
New SFX: warn_generic (0.45 s, two soft notes down). In createWarnings(): when the happiness gauge enters the alert zone play sound.play('warn_generic') instead of the removed voice_tired. Add the same check for the cleanliness gauge (also warn_generic). Same rules as warn_hungry, tracked per gauge. If isAlert() does not fit cleanliness, use the same low threshold the HUD uses to show the gauge as low, and tell her which value you used.
Spec: art-src/audio_src/sfx_gauge_draft/README_warn_generic.txt.
```

## Item 9 (approved 20:35) — opening a chest
```
New SFX: chest_shake, chest_open, chest_open_golden, chest_item_1 .. chest_item_5. In src/ui/chest.ts (createChestWindow, 'chest-open' handler):
- when the chest starts shaking (is-shaking): play chest_shake
- at SHAKE_MS when the burst starts: play chest_open
- when reward N is appended to the list (index N-1): play chest_item_N (N > 5 -> chest_item_5), so the pops go up in pitch one by one.
If the window is closed early (Take button), stop/cancel the pending sounds together with the timers. Golden chest (chestTierOfItem(item) === 'golden'): play chest_open_golden instead of chest_open. Wooden and silver use chest_open.
Group: SFX volume. Spec: art-src/audio_src/sfx_chest_draft/README_chest.txt.
```

## Item 10 (approved 20:46) — rain ambience loop
```
New folder public/assets/audio/amb/ (index group "amb"). New loop: amb/amb_rain (20 s seamless, already quiet).
Loop it while gameState.world.weather === 'rain' and the farm scene is showing: fade in over ~2 s (start ~1.5 s after rain_start plays), fade out over ~2 s when the weather is no longer rain or the scene/title changes. If a save is loaded while it is already raining, just fade the loop in (no rain_start).
Volume: add an "Ambience" slider in settings if easy (default 1.0); otherwise put ambience under the SFX slider and tell her. Ambience must not be ducked by voice and must keep playing while menus/phone are open.
Spec: art-src/audio_src/amb_final/README_amb_rain.txt.
```

## Item 11 (approved 21:31) — day birds / night crickets ambience
```
New loops: amb/amb_day_birds and amb/amb_night_crickets (20 s seamless, quiet). On the farm: loop birds while the day music plays and crickets while the night music plays; crossfade them together with the music (dayNightFadeMs). Same Ambience volume as item 10. While it rains, play birds/crickets at about 50% under amb_rain (make the factor a value in audio.json so she can tune it). Stop/fade all ambience on the title screen.
Spec: art-src/audio_src/amb_final/README_amb_birds_crickets.txt.
```

## Item 12+ — (next approved sounds go here: amb_pond, amb_campfire ...)

## Footer for the final prompt
```
Do not change the existing audio files or other triggers unless listed above. Run the tests, commit, and give her the test link. Report triggers you could not find or had to guess.
```
