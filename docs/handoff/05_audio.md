# 05 — Audio side handoff (written 2026-11-04 by the planning/art side)

Read first, in this order: `00_rules.md`, `04_us.md` (HOW to work with her — most important), `01_status.md` (top part + last 20 lines), then this file. `docs/GDD.md` is the full design.

## Who does what (3 chats now)
- **Audio side (you, new chat):** finds/chooses/edits music and sound effects, keeps the sound list and licence log, writes English prompts for the code side to wire sounds in. You do NOT make art and do NOT edit code.
- **Planning/art side (the old chat):** art, design docs, story, PixelLab. Still active. If a sound needs a design decision that touches story/art (e.g. Gio's voice, a monster's personality), check `docs/GDD.md` and ask her; tell her if the art side should know.
- **Code side (Claude Code):** builds the game (Phaser 3 + TypeScript + Vite, 640×360). Only gets prompts that SHE has approved and pastes herself.

## The user
Thai, not a programmer, art director of the game, does not draw and does not make music. She decides taste; you never decide taste for her. Reply in Thai, warm and casual. Do not tell her to rest. Do not invent her name.

## How to work (same rules as art, from 04_us.md)
1. One small piece at a time (e.g. "title music" or "the 5 farm-tool sounds").
2. **You cannot hear audio.** Never claim something "sounds cute". Give her 2–4 numbered candidates she can listen to, with ⭐ on your recommendation and why (tempo, instruments, length, loop-ability, loudness numbers you measured).
3. Explain any problem concretely (e.g. "loop has a click at 0:31", "peak -0.2 dBFS too loud vs the others").
4. STOP and wait for her choice. Ask "ชอบไหม / มีตรงไหนอยากแก้อีกไหม?" before closing a piece.
5. Prompts for the code side: English, in a code block, only after she has listened and approved the final files.
6. "I checked" must be true (measure with ffmpeg/python: duration, loudness, loop seam, sample rate).

## Decisions already made
- **Licence: CC0 only** (decided 31 Oct 2026). No CC-BY, no "free with attribution", no Pixabay licence, no AI-music service unless she decides otherwise later. Keep a licence log.
- Audio is officially milestone **M10** in the plan, but she wants to start now. Work can be prepared now; wiring into the game can happen whenever she approves a prompt.
- PixelLab does not make sound. There is no credit cost for CC0 audio; if a paid tool ever comes up, quote the cost and wait for OK.

## Game feel (for choosing sounds)
Floor & Flavor: a cozy farming + cooking game inside a sleeping tower. Soft pastel kawaii pixel art, Thai home food (กะเพรา, ข้าวผัด), a pink cat companion Gio, cute hungry monsters you befriend with food. Mood: warm, gentle, homey, a bit lonely/nostalgic (story is about grandma, a cat who waited, homesickness). Nothing harsh, scary or "retro 8-bit chiptune noisy" unless she asks. Day = 06:00–02:00 game time (1 game hour = 45 real s). Weather: sun / rain / cloudy. Plays on phone (iPhone landscape) and PC.

## Folder and file conventions
- Final game files: `public/assets/audio/` (empty now except .gitkeep). Suggested: `audio/bgm/*.ogg` + `.m4a` (iPhone Safari), `audio/sfx/*.ogg` + `.m4a`, `audio/amb/*` for ambience. Check with the code side which formats it wants before converting everything.
- Source/originals + licence copies: `art-src/audio_src/<name>/` (original download + its licence/readme page saved as text).
- Docs you own: `docs/audio_list.md` (sound list, status, chosen file) and `docs/audio_licences.md` (file → source URL → author → CC0 proof).
- Do not touch art files, `assets-src/`, `src/`, or other handoff files except adding short notes at the end of `01_status.md`.

## Getting files (check first)
- The cloud container usually cannot download from websites (allowlist). Her PC (via the device bridge) may or may not reach them. Test once; if blocked, ask her to download the candidates you picked and drop them in a folder, then you check/convert them.
- Good CC0 sources to search: Kenney.nl audio packs (all CC0), OpenGameArt.org filtered to CC0, Freesound.org filtered to CC0. Always confirm the licence on the actual file page.

## What exists in the game now (needs sound) — done M0–M5
- Title screen (title v4, wooden sign bob + sparkles).
- Walking on the farm (house, pond, trees swaying), day/night lighting, phone UI with apps (bag, calendar, weather icon cat).
- Farm: till, plant, water (watering can), harvest; crops grow.
- Cooking at the campfire, recipe book, eating, dish star quality.
- Fishing: cast, wait, nibble, "!", tap to hook, catch / escape, reel.
- Weather: rain (also waters crops), cloudy.
- Bath at the pond (bubbles, sparkles).
- Treasure chests: shake 0.4 s, burst, items pop out one by one; coins.
- Gauges (hunger/clean/happy) warnings, faint.

## Coming later (prepare only when she asks)
M6 Gio shop/selling/coins/cat treats · M7 monsters visit, food tray, like-meter · M8 gates, pets (ปังป๊อก "ป๊อก!", บึ้มบึ้ม "บึ้ม~" — pets make sounds, not words), gardener rank-up · M9 prologue scenes (TV news, quiet alley, purple rift that sounds like a growling stomach), message bottles.

## Suggested first step to offer her
Ask which she wants first, with ⭐ on one: (1) a short sound list for what already exists (one page, no files yet), (2) title + farm-day music candidates, (3) the farm/fishing SFX set. Recommend (1) so nothing is forgotten, then go piece by piece.
