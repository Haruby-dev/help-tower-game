# Clear pond water + swaying trees (planning side, 2026-11-03) — user approved

0 PixelLab credits. Look target: `docs/water/pond_final_preview.gif` / `pond_final_still.png` (pond) and `docs/water/trees_final_preview.gif` (trees).
The previews were made offline in Python on a screenshot (`docs/water/pond_reference_v6.py` and the files it imports are the exact recipe, for reference only). In the game, build it at runtime from the tilemap's water tiles so it works for any pond shape. All work in native pixels (1 px = 1 game pixel), no smoothing.

## Lore (user)
There is a dark hole in the pond floor. It connects to every underground water, river and sea; that is why all 30 fish live in this one pond — they swim in through the hole. (Later, M5: rare fish/bottles near the hole, more at night/rain.)

## Pond — layers bottom → top
1. **Floor texture (static, bake once to a canvas):**
   - Cobble bed: Voronoi cells, ~1400 random points over the pond bounding box, y scaled ×1.25 (cells a bit wider than tall). Cell colour random from (150,140,122) (132,126,112) (162,150,128) (120,114,104) (140,132,118). Inside a cell: ×1.12 on the top-left side, ×0.86 on the bottom-right. Cell borders (second-nearest − nearest < 1.3 px) ×0.7.
   - Depth d = distance (px) from the nearest non-water pixel (treat the dock as water; rocks are objects).
   - Water colour by depth band, edges at d = 3, 8, 14, 22, with a 1-px checker dither on each band edge:
     B0 (128,196,150), B1 (82,172,150), B2 (40,140,148), B3 (34,112,134), B4 (30,94,122).
   - Final = floor × (1−k) + band × k, k = min(0.82, 0.48 + d/40).
2. **The hole:** at a deep, open spot (in the approved image: deep area left of the rock). Irregular outline: r(θ) = 17·(1 + 0.10 sin(2θ+1.1) + 0.07 sin(3θ+2.6) + 0.04 sin(5θ+0.4)), vertical scale 0.72. e = distance / r(θ): e < 0.42 colour (10,26,44); e < 0.5 (18,48,74); 0.5–1.6: darken the floor stone by stone toward the hole (5 steps ×0.28/0.42/0.58/0.76/1.0 per cobble, small random offset per cobble) so the stones slope into it.
3. **Bank shadow (static):** water within 5 px below / 3 px right of land gets darker, up to −42 % at the bank. Dock and rocks cast a shadow 2–5 px down-right (−55 %).
4. **Caustics (animated):** ~260 points drifting on small circles (±6 px x, ±4 px y, one loop per cycle); light where second-nearest − nearest < 1.1 px. Add +30 brightness × (1 − d/26, min 0.15), less inside bank shadow. Loop ~3.5 s.
5. **Cloud shadow (animated):** one soft ellipse 140×80 px crossing the pond slowly (~20–30 s), ×0.86, edge dithered with a 4×4 Bayer pattern.
6. **Surface sparkles (animated):** ~110 short light dashes (2–3 px, rgba 225,250,250) on d > 4; each fades in/out over its cycle and drifts 4 px right.
7. **Rock ripples:** two rings alternating, expanding from the rock base and fading.
8. **From the hole:** bubbles rising (1→2 px rings, wobble ±1 px, pop into a small flat ring), ~6 at a time. 2–3 dark fish silhouettes (rgba 10,30,50, alpha ≤ 160) swim out from the hole in different directions and fade out.
9. **Shore dressing (static sprites, can be baked):** ~35 small rounded stones on the water edge (r 2–3, fill (120,112,100), outline (70,62,56), 1-px highlight), occasional white glint where water touches them; ~15 reed clumps (three 8–12 px stalks + a brown cattail) that sway ±1 px.
10. **Lily pads:** groups of 3–4 near the banks, bob ±1 px, some with a pink flower.
Keep the old white dash pattern of the water tile hidden (the floor replaces it).

## Trees — style C (approved for all 4 big trees)
Files: `public/assets/world/fx/trees/tree_big_{0..3}_canopy_mask.png` and `_light_mask.png` (same size as the tree sprite; white = on).
- Draw the tree, then draw the canopy (canopy mask) again shifted by round(0.8·sin(t + phase)) px in x (so at most 1 px). The trunk stays still. Each tree gets its own phase (e.g. 0.9 × index or random) so neighbours don't move together. One cycle ≈ 2.5 s.
- Light twinkle: for pixels in the light mask, add +40 brightness where sin(2t + 0.7x + 0.5y + phase) > 0.6 (moves across the leaves like sun through foliage).
- Optional later: stronger sway on storm days.

## Order
Can wait until after the current fixes. Not tied to a milestone; fits with M5 (fishing/weather) if you prefer.
