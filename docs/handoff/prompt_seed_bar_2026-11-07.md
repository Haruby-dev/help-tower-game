# Prompt for the code side — seed bar (written 7 Nov 2026 21:5x, her OK 21:52; she sends it)

```
Seed bar (planning side, approved by her 2026-11-07). Mock on a real game capture: art-src/seed_bar_1107/seed_bar_S2_mock.png
(bottom row = new). Her problem: changing the seed type is slow (popup every time, seeds and fertilizer mixed, long list).

1. In tool mode, tapping the seed-bag slot (tool 4) now switches the WHOLE bar to a SEED BAR, the same way the
   food switch makes the food bar. Remove the seed-picker popup (createSeedPicker / .seed-picker*).
2. Seed bar = same tray, 5 slots, same look as the food bar:
   - items = every seed in the bag, then every fertilizer after the seeds (same bar; seeds in crops.json order,
     then fertilizer_2, fertilizer_3). Icon = the item's own bag icon (seed_<crop> / fertilizer art) at the same size
     the food bar uses, count ×N bottom-right like the food bar, no star badge for these items.
   - the › tab on the right end pages when there are more than 5. Keys 1-5 pick.
   - tapping a slot = gameState.setSelectedSeed(...) exactly like the old popup did; the chosen slot is pink.
   - the selected tool stays 'seeds' the whole time, so the action button plants / fertilizes as today.
3. The round switch on the left of the tray shows the hoe icon in seed mode (same as food mode). Tap = back to the
   tool bar with the seed-bag tool still selected. The food bar is only reached from the tool bar.
4. After planting, STAY in the seed bar (so she can plant many plots). When the chosen seed runs out, select the next
   item in the seed bar; if nothing is left, show empty slots and keep the bar open until she taps the switch.
5. No visible text anywhere on these buttons (her rule: HUD buttons are icons only); keep aria-labels.

Follow CLAUDE.md: npm test, npm run validate, npm run test:e2e must pass. Then send screenshots from the REAL game
(desktop AND landscape phone size): tool bar, seed bar page 1 with a seed picked, seed bar page 2 (fertilizer),
planting a plot from the seed bar. Tell me the commit hash and push.
```

What it changes (for her): tapping the seed bag turns the tool bar into a bar of your seeds (and fertilizer after them); tap a seed to switch instantly, plant plot after plot, tap the hoe circle to go back to tools.
