# Prompt to the code side — zone 1 monsters 4–10 + twins + strawberry juice (her OK 2026-11-07 01:07)

```
Read docs/zone1_delivery_2026-11-07.md (everything you need is there; for the twins also read the GDD section "แฝดขี้แกล้ง", docs/GDD.md ~lines 1024–1047). All 61 art files are already in public/assets (not committed).

1. Monsters 4–10 (toomtia, tangkrading, yaibaimai, wingwing, tubpong, jaotungtong, puefaotung): register the sheets and fill the `art` block in monsters.json from the table in section 1 (cell size, feet row, visible height, walk ms — puefaotung needs per-frame walk durations — eat 150 ms, eatFrames 0–7). Anchor sprites by the feet row so every canvas size stands on the same ground line. Hungry sheets are fully drawn: no tint. wingwing/tubpong/puefaotung play their walk sheet as hover/slide/hop.
2. mookmik: the 6 sheets were replaced with plum-outline versions (same size). Just make sure nothing else changed.
3. Twins (floor 5): implement the GDD twin rules using section 2 of the doc: twin B data, fake-100% bar with B capped at 90% while hidden, visit logic (50/50, never both before the reveal, A giggle-run visit 1 in 5 after the switch), teasing lines, reveal scene with the guessing quiz, the 3 extra sprite sheets with their timings, names after the reveal, the wind-chime decoration reward (daily happiness = placeholder marked TODO, list it in your report), merge the `twins` dialogue block from docs/dialogue_zone1_draft.json into src/data/dialogue.json. No bell sound yet: leave the hook empty.
4. strawberry_juice: use the new dish / bag / tray_mini / mini16 images instead of the mound fallback.
5. Commit the art, the art-src folders listed in the doc's specs, docs/zone1_delivery_2026-11-07.md and the monster spec docs.
6. Check (keep it lean): run the tests and validate. Make ONE preview image docs/previews/code/zone1_monsters.png with each new monster's sweet + hungry stand next to the player on the yard ground (feet on one line), and ONE short check of the twin flow with a debug jump to the reveal (screenshots of: fake bar switch, quiz, after the reveal). Report: anything you could not do, the TODO happiness value, and any data that disagrees with the GDD.
```

What this changes in the game: floors 4–10 get their real monsters (sweet/hungry/eat art, special movers), floor 5 becomes the prank-twins feature with a reveal scene and quiz reward, Mukmik's outline matches the gang, strawberry juice gets its real picture.
