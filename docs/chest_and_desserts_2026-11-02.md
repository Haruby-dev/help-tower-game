# Treasure chests + dessert menu (planning side, 2026-11-02)

All numbers are placeholders to keep in data files. Build in the fishing milestone (M5) and the cooking milestone (M4). Art for chests, toys, charms and outfits is NOT made yet: use placeholders.

## Part 1 — Treasure chests (from fishing)

### Drop chance per cast
| rod | chance |
|---|---|
| bamboo | 3% |
| iron | 5% |
| silver | 7% |
| star | 10% |
Rain or night: +2%. Fishy the otter never brings chests. A chest replaces the fish for that cast.

### Chest tiers
| tier | roll chance | rolls | guarantee | coins inside |
|---|---|---|---|---|
| wooden | 75% | 2 | – | 10–30 |
| silver | 20% | 3 | 1 roll is uncommon or better | 30–80 |
| golden | 5% | 3 | 1 roll is a cosmetic | 100–200 |

### Category weights per roll
| category | wooden | silver | golden |
|---|---|---|---|
| seasoning / ingredient | 45% | 35% | 20% |
| items | 35% | 30% | 25% |
| toys | 12% | 20% | 20% |
| cosmetics | 8% | 15% | 35% |

- **Pity:** 8 chests in a row with no cosmetic → the next chest gives one.
- **Duplicates:** a cosmetic the player already owns turns into Sugar Stars (wooden 2, silver 5, golden 10).
- Chests go into the bag (stack 99). Open from the bag; items pop out one by one; every coin/Sugar Star gain is logged in the wallet.

### Pools
**Seasoning / ingredient:** salt, sugar, fish sauce ×2–3 · honey, vanilla, cocoa, cherry ×1–2 · rare: "tower pink salt" (kept for a later recipe).
**Items:** normal bait ×3–5 · special bait ×1 (silver+) · 1 random shop seed bag · lick treat for Gio ×1.
**Toys (for Gio and home pets; NOT the Sugar Star monster playground):** feather wand, yarn ball, toy mouse, cardboard box, fish plush (golden only). Using one: Gio happiness +10, once per toy per day.
**Cosmetics:**
- Watering-can skins: mint, lavender, yellow, peach (pink is shop-only, blue is default).
- "Tower gardener" outfit, 5 pieces: straw hat with bow (covers hair), denim overalls, veggie-print apron, garden gloves, rubber boots. Cosmetic only. Full set: small leaf-sparkle effect on harvest.
- Phone strap charms ×6: pink bow, gold bell, little fish, strawberry, basil leaf, star.
- Phone cases: mint choc-chip (chest), Gio face (golden chest only). Strawberry milk is sold for Sugar Stars. Pink cat = default.
- Wallpaper: Gio pattern (golden chest only). Sky = default.
- Hair clips ×4: cherry, star, cat, bow.

Item rarity inside a category: common 70% / uncommon 25% / rare 5%. Mark each entry's rarity in data.

## Part 2 — Dessert menu (15)
Icons are ready (0 credits): `public/assets/food/desserts/food_*.png`, 48×48, plate included. Full data: `docs/desserts_2026-11-02.json`.
Price rule = economy_balance: max(rank base, 2× ingredient value). Rank bases C 200 / B 350 are placeholders.

| rank | dessert | icon | ingredients | price |
|---|---|---|---|---|
| F | whip cream Mumu | slime24 | cream, sugar | 40 |
| F | strawberry jelly | slime2 | strawberry, slime jelly scrap, sugar | 50 |
| F | caramel pudding | slime9 | egg, milk, sugar ×2 | 50 |
| E | berry pudding | slime8 | egg, milk, blueberry ×2, sugar | 105 |
| E | soda jelly | slime1 | fizzy water, slime jelly scrap, cherry | 60 |
| E | soda ice cream | slime12 | milk, cream, fizzy water, sugar | 80 |
| E | honey macaron | bee22 | golden wheat, egg, honey | 80 |
| D | cherry cream macaron | bee7 | golden wheat, egg, cream, cherry | 120 |
| D | blueberry macaron | bee12 | golden wheat, egg, blueberry ×2, sugar | 120 |
| D | cream puff | bee6 | golden wheat, egg ×2, cream, butter | 150 |
| D | chocolate donut | bee13 | golden wheat ×2, egg, cocoa, sugar | 125 |
| C | chocolate macaron | bee17 | golden wheat, egg, cocoa ×2, cream | 200 |
| C | swiss roll | bee14 | golden wheat ×2, egg ×2, cream ×2, strawberry | 220 |
| B | strawberry parfait | slime23 | strawberry ×3, cream ×2, milk, cherry, golden wheat | 350 |
| B | chocolate parfait | slime22 | cocoa ×2, cream ×2, milk, cherry, honey | 350 |

New ingredient values: cream 18, butter 20 (both from Mumu's milk), cocoa 15, cherry 10, slime jelly scrap 5, fizzy water 10 (Bubble), vanilla 15 (Boom Boom), blueberry 15 (**farm crop**, user decision: regrow crop, seed bag 50 in the shop; crop art not made yet).
**Sources (user decision 2026-11-02):** cocoa and cherry are sold in the shop for now. Agar is replaced by **slime jelly scrap (เศษวุ้นสไลม์)**, a drop from slime gate floors only; not sold in the shop.
The drink "soda jelly" in design_update B4 is renamed **"โซดาเจลลี่ดึ๋งดึ๋ง"** (id `soda_jelly_boing`) to avoid a clash with the dessert "เจลลี่โซดา".
