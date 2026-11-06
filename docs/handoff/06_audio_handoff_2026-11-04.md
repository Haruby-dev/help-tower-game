# 06 — Audio side handoff #1 (2026-11-04, end of the first audio chat)

Read first: `00_rules.md`, `04_us.md` (HOW to work with her), `05_audio.md` (audio role + rules), then THIS file.
Docs owned by the audio side: `docs/audio_list.md` (every sound + status + trigger), `docs/audio_licences.md` (source → licence proof).
Nothing has been sent to the code side yet. Everything below is a DRAFT she approved by ear.

## 1. Done so far — 20 of 43 (all in `art-src/audio_src/`, each folder has a README with details)
| folder | what | key facts |
|---|---|---|
| `bgm_title_draft/` | title BGM "H3" | D major 120 BPM, 64 s, build-up intro; play once, then LOOP 32.0 s → end. -17 LUFS |
| `bgm_farm_day_draft/` | farm day BGM "A-solo1" | G major 96 BPM, 72.5 s; LOOP 12.5 s → end. -18 LUFS |
| `bgm_farm_night_draft/` | farm night BGM "N1c" | 76 BPM, harmonica + soft harp, no drums, harp intro fades in; LOOP 6.32 s → end. -20 LUFS |
| `sfx_ui_draft/` | ui_tap/open/close/page/error/coin "bubble A" | 100% code-made bubble sweeps; -7…-12 dBFS peaks |
| `sfx_farm_draft/` | farm_till / plant / water / harvest | each file starts at t=0; play ON FRAME: till 6, plant 4, water 5, harvest 7 (moves = 9 frames × 125 ms) |
| `sfx_fishing_draft/` | fish_cast/plop/nibble/alert/reel/catch/escape | event triggers listed in its README (landBobber, nibble anim, startBite, reel start, reel end) |
BGM instruments = real samples from VCSL (CC0) + Claude's own melodies. Harmonica (Hohner Special20 Soft, one octave low, heavily filtered) is her favourite lead.

## 2. Her taste (learned the hard way — read this before making anything)
LIKES: bright but soft; small, light, quiet sounds; NO bass thumps; short real splash + cute code bubbles; sand/soil grains; harmonica; kalimba as dry short chord stabs (title/day only); slow, spaced events (not rapid).
DISLIKES (each was rejected): synth instruments that sound thin/"digital"; piercing 2–5 kHz (she says "แหลมบาดหู"); loud files; long reverb on kalimba;
 instrument notes used as UI sounds ("like notes falling out of the song"); pure code-synth foley ("quality bad"); low thumps ("like smashing someone's house");
 realistic water pouring ("สมจริงไป"); fast bubble runs ("รัวไป"); kalimba at night ("not sleepy").
Practical levels that she accepted: SFX peaks -11 (rewards) … -20 dBFS (frequent small sounds); lowpass ~4–5 kHz on SFX; keep 2–5 kHz share low.
She wants music default volume BELOW SFX (suggest music 0.6–0.7, sfx 1.0) + volume sliders in Settings (tell the code side when the prompt is written).

## 3. Working method that works with her
- You cannot hear. Measure everything (ffmpeg ebur128 LUFS/true peak, spectral centroid, % energy 2–5 kHz, loop seam jump vs normal note-onset jump, onset delay, silent end).
- For SFX tied to animations: read the sheets + code first (frame timing), then make a VIDEO of the real animation (PIL frames ×6 nearest + ffmpeg mp4 with sound on the exact frame).
- When she says "แปลก" without detail, stop guessing in prose: make a NUMBERED MENU video (big number on screen per option) and ask her to answer with a number. This is what finally worked for plant/harvest/water/catch.
- For music she gave a reference mp3 once (`bgm12.mp3`, unknown author): only measured it (tempo ~120, D major, tone balance). Never use reference audio itself.
- Always save approved drafts to her PC right away (zip → device_commit_files → unzip), update audio_list / audio_licences / one line at the end of 01_status.md.

## 4. Sources and how to get them (CC0 only)
- VCSL (Versilian Community Sample Library, CC0): reachable from the cloud container with git: `git clone --depth 1 --filter=blob:none --no-checkout https://github.com/sgossner/VCSL` then `git sparse-checkout set --no-cone '/LICENSE' '<instrument folder>/*'` + checkout (big repo — never full checkout). Commit used: c1ea7bc.
  Gotchas: Glockenspiel samples sound ONE OCTAVE above their file name and ~+15 cents sharp (G4 file unusable). Tanzanian kalimba needs per-note retuning (roots measured in scripts/roots.json). Marimba/harp are in tune.
- Kenney.nl (all CC0): downloaded "Impact Sounds" + "RPG Audio" via her built-in browser (Claude app browser pane). Zips + licence in `art-src/audio_src/kenney/`.
- OpenGameArt: "40 CC0 water / splash / slime SFX" by rubberduck → `art-src/audio_src/oga_water_rubberduck/` (also has rain loop + bubbles for later: amb_rain, bath).
- Download flow: ask her OK per file (name, source, size) → click download in the browser pane → file lands in her `Downloads` → request folder access to `C:\Users\Railg\Downloads` (must be re-requested in a new chat) → copy into art-src → stage to the container.
  Each new page on a site may pop an approval for her. The container itself cannot reach these sites; her VM shell has no internet either. No 7z extractor available (skip .7z packs or ask her).
- Scripts used are inside each draft folder (`scripts/`): sampler (resample_poly pitch shift), render_*.py for BGM, make_pop.py (bubbles), build_*.py for SFX, mock/menu video makers.

## 5. Known issues / to do before final
- Glockenspiel in all 3 BGMs plays 1 octave higher than intended and ~15 c sharp (quiet, low-passed, not noticed). Fix when making final masters.
- Final mastering pass for all files (consistent loudness, true peak ≤ -1 dBFS for music), then convert to the formats the code side wants (planned: .ogg + .m4a for iPhone Safari — ASK the code side first via a prompt she approves).
- fish_cast frame per direction is my reading of the sheets (east 6, south 5, north 4) — verify in game.
- BGM loop points must be implemented by the code side as "play once from 0, loop from X" (X listed above).

## 6. Remaining list (see audio_list.md)
Cooking 6 (cook_start, cook_loop, cook_done, cook_star, eat, drink) · Chests 3 (shake 0.4 s, open burst, item pop) · Bath/weather 4 (bath_splash, bubbles, sparkle, rain_start) ·
Gauges 3 (warn_hungry cute stomach growl, warn_generic, faint) · Ambience 5 (day birds, night crickets, rain, pond, campfire) · farm_grown, step_grass.
Suggested next: chests (short, uses the splash/bubble family) or cooking. Then ask the code side about formats and do a test build with her on the phone.
