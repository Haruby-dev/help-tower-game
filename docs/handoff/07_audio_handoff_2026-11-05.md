# 07 — Audio side handoff #2 (2026-11-05 04:00, end of the second audio chat)

Read first: `00_rules.md`, `04_us.md` (HOW to work with her), `05_audio.md` (audio role + rules), `06_audio_handoff_2026-11-04.md` (first audio chat), then THIS file.
Docs owned by the audio side: `docs/audio_list.md`, `docs/audio_licences.md`. Nothing has been sent to the code side yet. Everything is a DRAFT she approved by ear.

## 1. Done in this chat — cooking set (progress now 24/43)
All final drafts in `art-src/audio_src/sfx_cook_draft/` (READMEs: README.txt = loop, README_cook_start.txt, README_cook_done.txt, README_eat.txt). Sub-folders r2…r14 = rejected/working rounds (can be cleaned later).
| file | what | trigger |
|---|---|---|
| cook_start.wav | gum pop (pick up pan) -> "chaaa" sizzle swell, 1.8 s | play at cook intro frame 0; start cook_loop at frame 4 (0.5 s later) |
| cook_loop.wav | 7.5 s seamless loop (= 12 cook-loop anim cycles, 96 BPM): soft sizzle bed + 2 sizzle swells + bubble-gum pop + pepper-mill twist "krik-krik-krik" + pop-pop-pop | loop while cooking |
| cook_done.wav | sizzle fades "fuu" -> gum pop -> soft glass-bottle "ting", 0.9 s | when the dish pops up above the campfire; stop the loop at the same moment |
| eat.wav | HER OWN VOICE "หม่ำแล้วนะ" (~1.0 s), cleaned | press "eat" in the bag |
| eat_rapid_1/2.wav | her short "งั่ม" (+ tiny pop), as recorded / +2 semitones | if eat is pressed again within 1.5 s: alternate 1/2; never stack voices |
| drink.wav | HER VOICE "อึก อึก อึก อ่า~ สดชื่นจังเลย", 3.8 s (first take; her note: fix later if bad in game). drink_extra/drink_ugh_1..3 = single gulps, use for rapid presses only if she agrees | drink item in the bag |
Still TODO in this set: **cook_star** (skipped: no star animation exists in the game yet).

## 2. Her taste — new things learned this chat
- Cooking must NOT be realistic foley alone, and NOT an imitation of a reference ("ไม่ต้องคล้ายจนเหมือนเลียนแบบ"). She wants the FEEL: cute, rhythmic, homey.
- Her own cooking design: meat searing in oil "chaaa" ALTERNATING with cute pops when picking things up; she loves the **salt/pepper-mill twist** sound.
- Pops: she prefers **round bubble-gum pops** (low ~1.2 kHz, soft) over bubbly/watery pops. Reference she sent = Pixabay file (NOT CC0) -> used only for comparison; javapimp "Pop 1/5" (CC0) are the nearest.
- She hears low "thump" ("เสียงตึงๆ") immediately -> keep < 250 Hz near zero; check handling noise inside real recordings.
- Sizzle a bit quieter than first instinct (-3 dB vs pops).
- She likes giving the heroine a voice: her own recordings, natural or +2 semitones, she can drag vowels herself (better than code stretching).
- Do not tell her to rest (rule) — I slipped once at 03:00; don't repeat.

## 3. New tools on her PC (MCP via the device bridge) — USE THEM
- **Earshot** (audio-analysis MCP, runs on her PC; paths must be Windows paths on her PC, so commit files there first, e.g. `art-src/audio_src/sfx_cook_draft/rN/`):
  - `rank` (sort a folder by a text description) — great to pick candidates from downloads.
  - `find` (best moment inside a long file; kind=texture for beds, event for hits).
  - `compare` (similarity to her reference files) — found the CC0 pops nearest her reference (cos 0.86).
  - `describe` / `match` (what it sounds like; verify a claim with z score), `timeline` (events over time), `realness`.
  - Lessons: CLAP reads sizzle partly as "rain / pouring water" (normal). Mixed files are judged by the loudest element (pops dominate). It cannot judge abstract meaning ("sounds like food is ready") or transcribe words. Earlier, Earshot caught wrong directions before she heard them: r2 starts read as "explosion", pot+plops read as "underwater".
  - First call loads models (~20-60 s); a call can time out at 60 s — read-only calls are safe to retry.
- **Openverse** (CC0 search + download): `search_audio` with `license: "cc0"`; `download_media(type audio, id, folder=<project path>)` saves Freesound previews (mp3) and appends attribution to CREDITS.txt in that folder. Downloads so far in `art-src/audio_src/openverse/{sizzle,pop,salt,gum,done,eat}/`. ALWAYS ask her OK per batch (names, sizes) before downloading.
- **BigSoundBank** (all CC0) via the built-in browser: site approved "on this computer". Download = POST `/download.php` with `format=ogg&id=NNNN&button=Download` (create a form with JS and submit), file lands in `C:\Users\Railg\Downloads` (folder access must be re-requested in a new chat). 9 files in `art-src/audio_src/bigsoundbank/` (SOURCE.txt), mostly unused.
- The cloud container still cannot reach these sites directly.

## 4. Her voice (NEW, design-level)
- Raw recordings: `art-src/audio_src/her_voice/her_voice_eat_raw_1105.m4a` ("งั่ม"), `her_voice_word_raw_1105.m4a` ("หม่ำแล้วนะ"). Female, f0 ~220-420 Hz, phone recording with room hiss ~-48 dB.
- Processing that worked: spectral-gate denoise using the silence before the word as the noise profile, trim, HP 140 Hz / LP 8 kHz, optional +2 semitones (simple resample), optional tiny gum pop at the end.
- FIRST time the heroine has a voice -> the planning/art side should know (status line written). More voice moments may follow (tired, happy, hungry, faint...).
- Ask her what she said in each recording (I cannot hear words).

## 5. Scripts
Saved with each draft in `sfx_cook_draft/scripts/` (build_cook2/4/4b/6/7, build_start8, build_done9, build_eat10/12/14, video*.py, helpers.py). They were run in the cloud container under `~/cook/` with sources copied to `~/cook/src`, `~/cook/ov`, `~/cook/voice`; a new chat must re-stage sources and fix paths. Menu-video method from 06 still works (numbered options, real animation frames, campfire, dish pop).

## 6. Known issues / to do before final
- From 06: glockenspiel octave/sharp issue in the 3 BGMs; final mastering pass; ask the code side about formats (.ogg + .m4a) via a prompt she approves; fish_cast frame per direction to verify in game.
- Cooking: cook_loop 2-5 kHz share ~36 % (real sizzle; stronger filtering made it stop reading as a pan) — she accepted after the -3 dB change; keep watching.
- Eat: tell the code side the 1.5 s rapid-press rule + "stop previous voice first".
- Clean up r2…r14 working folders later (keep README + finals).

## 7. Remaining list (see audio_list.md)
cook_star · heroine voice: ALL lines of docs/voice_lines DONE (art-src/audio_src/voice_draft/: MVP set README.txt + batch 2 README_batch2.txt, 2 takes each, her voice, original key — she rejected pitch-up and re-recorded); drink should be added to voice_lines as line 14 · Chests 3 (shake 0.4 s, open burst, item pop) · Bath/weather 4 · Gauges 3 (warn_hungry could be her voice/stomach) · Ambience 5 (day birds, night crickets, rain, pond, campfire) · farm_grown · step_grass.
Suggested next after drink: chests (short; gum-pop family fits the item pops) or ambience.

## 8. Update 11-05 18:20
She tested in game: all sounds good. Rejected the hand-made polish (reverb/EQ/denoise) test — keep current files. Heroine voice cut down to ONLY "งั่ม" (eat_rapid_1/2 alternating) for eat and drink; all other voice lines OFF (files kept). If voice returns: short non-verbal sounds, very few moments. Package installs (pip) were blocked this session: she would need to allow package managers in claude.ai Settings > Capabilities for Pedalboard/DeepFilterNet.
