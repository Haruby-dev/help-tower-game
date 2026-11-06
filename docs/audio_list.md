# Audio list — Floor & Flavor (DRAFT v1, 2026-11-04, audio side)

Status: DRAFT, waiting for her review. Licence: CC0 only. Nothing chosen yet.
Priority: A = needed for the first sound pass, B = nice soon, C = later / optional.
Covers what exists now (M0–M5). Later milestones (M6–M9) get added when she asks.

## BGM (music, loops)
| id | where | mood | pri | status |
|---|---|---|---|---|
| bgm_title | title screen | bright, bouncy, warm (ref: her bgm12.mp3) | A | DRAFT H3 chosen 11-04 (art-src/audio_src/bgm_title_draft) |
| bgm_farm_day | farm 06:00–18:00 | calm, cozy, light (same instruments as title) | A | DRAFT A-solo1 chosen 11-04 (art-src/audio_src/bgm_farm_day_draft) |
| bgm_farm_night | farm 18:00–02:00 | quiet, warm then a bit nostalgic, harmonica lead, no drums | B | DRAFT N1c chosen 11-04 (art-src/audio_src/bgm_farm_night_draft) |

## AMB (background ambience, loops, under the music)
| id | where | pri | status |
|---|---|---|---|
| amb_day_birds | farm, daytime | B | DRAFT approved 11-05 21:31 (amb_final, studiogreenhill birds) — wiring pending (batch 2 item 11) |
| amb_night_crickets | farm, night | B | DRAFT approved 11-05 21:31 (amb_final, PhilllChabbb crickets) — wiring pending (batch 2 item 11) |
| amb_rain | rain weather | A | DRAFT approved 11-05 20:46 (art-src/audio_src/amb_final, rubberduck loop_rain, -3 dB) — in public/assets/audio/amb, wiring pending (batch 2 item 10) |
| amb_pond | near the pond (soft water) | C | DRAFT approved 11-07 01:40 (amb_final, Gently Splashing Water loop) — wiring pending (batch 3 item 2) |
| amb_campfire | near the campfire (crackle) | B | DRAFT approved 11-07 01:53 (amb_final, Sauron974 crackling fire) — wiring pending (batch 3 item 3) |

## SFX — UI / phone
| id | event | pri | status |
|---|---|---|---|
| ui_tap | button / menu tap | A | DRAFT bubble A approved 11-04 (art-src/audio_src/sfx_ui_draft) |
| ui_open | open phone / app | A | DRAFT bubble A approved 11-04 (art-src/audio_src/sfx_ui_draft) |
| ui_close | close phone / app | A | DRAFT bubble A approved 11-04 (art-src/audio_src/sfx_ui_draft) |
| ui_page | recipe book page / tab turn | B | DRAFT bubble A approved 11-04 (art-src/audio_src/sfx_ui_draft) |
| ui_error | can't do that (no item, full bag) | A | DRAFT bubble A approved 11-04 (art-src/audio_src/sfx_ui_draft) |
| ui_coin | coin gained | A | DRAFT bubble A approved 11-04 (art-src/audio_src/sfx_ui_draft) |

## SFX — farm
| id | event | pri | status |
|---|---|---|---|
| step_dirt (_1.._5) | footsteps on dirt / farm soil | B | DRAFT approved 11-07 01:23 (sfx_step_draft) — in public/assets/audio, wiring pending (batch 3 item 1) |
| step_grass (_1.._5) | footsteps (soft, quiet) | B | DRAFT approved 11-05 19:28 (art-src/audio_src/sfx_step_draft) — in public/assets/audio, code wiring pending (batch 2 item 5) |
| farm_till | hoe into soil | A | DRAFT L1 approved 11-04, play at frame 6 (art-src/audio_src/sfx_farm_draft) |
| farm_plant | drop seed / pat soil | A | DRAFT sandy brush x2 approved 11-04, play at frame 4 |
| farm_water | watering can pour | A | DRAFT splash+3 bubbles approved 11-04, play at frame 5 (art-src/audio_src/sfx_farm_draft) |
| farm_harvest | pull crop (pop) | A | DRAFT sand burst+bubble approved 11-04, play at frame 7 |
| farm_grown | crop finished growing (small sparkle) | C | DRAFT approved 11-05 19:41 (sfx_farm_draft/farm_grown.wav) — in public/assets/audio, code wiring pending (batch 2 item 6) |

## SFX — cooking / eating
| id | event | pri | status |
|---|---|---|---|
| cook_start | light fire / start cooking | A | DRAFT r8-1 chosen 11-05: gum pop -> sizzle, play at intro frame 0, loop starts frame 4 (art-src/audio_src/sfx_cook_draft) |
| cook_loop | sizzle / stir while cooking (loop) | A | DRAFT r7-3 chosen 11-05: sizzle + gum pops + pepper mill, 7.5 s loop (art-src/audio_src/sfx_cook_draft) |
| cook_done | dish ready (short happy jingle) | A | DRAFT r9-4 chosen 11-05: sizzle fade -> gum pop -> soft bottle ting, play when dish pops up, stop loop (art-src/audio_src/sfx_cook_draft) |
| cook_star | star quality pop, 1 per star | B | todo |
| eat | munch (cute, soft) | A | DRAFT chosen 11-05: HER VOICE "หม่ำแล้วนะ" (eat.wav); rapid presses (<1.5 s) alternate eat_rapid_1/2 ("งั่ม"); never stack (art-src/audio_src/sfx_cook_draft) |
| drink | sip / gulp (bamboo cup) | B | DRAFT chosen 11-05: HER VOICE "อึก อึก อึก อ่า~ สดชื่นจังเลย" 3.8 s (drink.wav); check length in game (art-src/audio_src/sfx_cook_draft) |

## SFX — fishing
| id | event | pri | status |
|---|---|---|---|
| fish_cast | rod swing whoosh | A | DRAFT approved 11-04 (art-src/audio_src/sfx_fishing_draft, see README for triggers) |
| fish_plop | bobber hits water | A | DRAFT approved 11-04 (art-src/audio_src/sfx_fishing_draft, see README for triggers) |
| fish_nibble | tiny nibble ticks | A | DRAFT approved 11-04 (art-src/audio_src/sfx_fishing_draft, see README for triggers) |
| fish_alert | "!" bite alert | A | DRAFT approved 11-04 (art-src/audio_src/sfx_fishing_draft, see README for triggers) |
| fish_reel | reel in (loop) | B | DRAFT approved 11-04 (art-src/audio_src/sfx_fishing_draft, see README for triggers) |
| fish_catch | caught! (jingle + splash) | A | DRAFT approved 11-04 (art-src/audio_src/sfx_fishing_draft, see README for triggers) |
| fish_escape | fish gets away (soft "aww" splash) | A | DRAFT approved 11-04 (art-src/audio_src/sfx_fishing_draft, see README for triggers) |

| voice_till_effort | her effort voice on the hoe hit (till/dig), ~1 in 3 | B | DRAFT approved 11-07 05:22 (voice_draft, her recording) — wiring pending (batch 3 item 5) |
| eat_crunch | eat AND drink from the bag (one crunchy bite, replaces "งั่ม") | A | DRAFT approved 11-07 02:54 (sfx_cook_draft) — wiring pending (batch 3 item 4) |

## SFX — bath / weather
| id | event | pri | status |
|---|---|---|---|
| bath_scoop + bath_splash_1..4 | wash at the pond (frame 4 scoop / frame 6 splash every loop) | B | DRAFT approved 11-05 18:45 (art-src/audio_src/sfx_bath_draft, README_bath.txt) — in public/assets/audio, code wiring pending (batch 2 item 2) |
| bath_bubbles | bubbles | C | not needed — bubbles are inside bath_sparkle; particles stay silent |
| bath_sparkle | clean! sparkle chime (end of bath) | B | DRAFT approved 11-05 18:45 (sfx_bath_draft) — code wiring pending |
| rain_start | rain begins (soft) | C | DRAFT approved 11-05 19:06 (art-src/audio_src/sfx_rain_draft) — in public/assets/audio, code wiring pending (batch 2 item 4) |

## SFX — chests
| id | event | pri | status |
|---|---|---|---|
| chest_shake | rattle (0.4 s) | A | DRAFT approved 11-05 20:35 (art-src/audio_src/sfx_chest_draft) — wiring pending (batch 2 item 9) |
| chest_open | burst open | A | DRAFT approved 11-05 20:35 (sfx_chest_draft) — wiring pending |
| chest_open_golden | burst open, golden chest only (coins + shimmer) | B | DRAFT approved 11-05 20:38 (sfx_chest_draft) — wiring pending |
| chest_item_1..5 | item pops out (1 per item, rising) | A | DRAFT approved 11-05 20:35 (sfx_chest_draft) — wiring pending |

## SFX — tower / twins
| id | event | pri | status |
|---|---|---|---|
| twin_chime | floor-5 twin reveal (two-note bell) + yard deco กระดิ่งลมแฝด when near | B | DRAFT approved 11-07 05:51 (sfx_chime_draft) — wiring pending (batch 3 item 7) |

## SFX — gauges / status
| id | event | pri | status |
|---|---|---|---|
| warn_hungry | hunger low (cute stomach growl) | B | DRAFT approved 11-05 20:11 (art-src/audio_src/sfx_gauge_draft) — in public/assets/audio, code wiring pending (batch 2 item 7) |
| warn_generic | clean / happy gauge low (soft blip) | B | DRAFT approved 11-05 20:19 (sfx_gauge_draft, synthesised) — in public/assets/audio, code wiring pending (batch 2 item 8) |
| faint | player faints (her voice + slide down + soft fall) | B | DRAFT approved 11-07 05:47 (voice_draft/faint.wav) — wiring pending (batch 3 item 6) |

Note: default volume — music below SFX (suggest music 0.6–0.7, sfx 1.0) + player sliders (her request 11-04).

Totals: 3 BGM, 5 AMB, 35 SFX (43). A = 25, B = 14, C = 4.

## Heroine voice (her own voice; list = docs/voice_lines_2026-11-05.md)
**11-05 18:20 DECISION: only "งั่ม" (eat_rapid_1/2 alternating) for eat AND drink is used in game. All rows below except eat_rapid are OFF (files kept).**
| id | line | status |
|---|---|---|
| voice_hungry_1/2 | "หิวจัง…" | DRAFT chosen 11-05 (art-src/audio_src/voice_draft) |
| voice_tired_1/2 | "ง่วงแล้ว…" | DRAFT chosen 11-05 |
| voice_yay_1/2 | "เย้!" | DRAFT chosen 11-05 |
| voice_cook_done_1/2 | "เสร็จแล้ว~" | DRAFT chosen 11-05 (play after cook_done.wav) |
| voice_wake / fish_bite / fish_miss / gio_pet / faint / bath / cook_fail / coins (_1/_2) | see voice_lines lines 6-13 | DRAFT chosen 11-05 05:21 (voice_draft/README_batch2.txt) |
| voice_drink | (= sfx_cook_draft/drink.wav, her voice) | DRAFT; add as line 14 in voice_lines |
