# Economy balance — 2026-11-02

Source of truth for numbers: `docs/economy_balance_2026-11-02.json`. This replaces the crop sell prices, seed prices and dish prices in the GDD / balance.json. Put every number in data files (balance.json / crops.json / recipes), never hard-code.

## Rules
- 1 seed bag plants 1 cell.
- Single-harvest crop: 3 units per harvest, then the cell is empty.
- Regrow crop: first harvest 3 units, then regrows **3 more times** at 2 units each (total 9). After the last harvest the plant **withers** (dry sprite / tint); hoe clears it (no confirm needed when withered; the confirm stays for a living regrow plant).
- Farmer skill rank S: harvest ×2 (passive), applies to every harvest.
- Seed bag price: single crop ≈ 1 veg; regrow crop ≈ 3.5 veg (regrow plants pay off over their lifetime).
- Raw veg sell price roughly halved vs GDD. Every dish sells for at least 2× its ingredient value, so cooking always beats selling raw.
- Target: about 5–9 coins per cell per game day for all crops; single crops slightly more per day, regrow crops less labour.

## Crops (sell / seed bag)
| crop | grow d | regrow d | sell old→new | bag old→new |
|---|---|---|---|---|
| scallion | 3 | – | 15→8 | start |
| chili | 5 | 3 | 10→8 | start |
| basil | 4 | 3 | 12→8 | start |
| tomato | 6 | 3 | 20→10 | start |
| garlic | 5 | – | 25→8 | start |
| rice | 8 | – | 30→10 | start |
| carrot | 4 | – | 30→15 | 15→15 |
| cabbage | 6 | – | 50→25 | 25→25 |
| cucumber | 5 | 2 | 20→10 | 30→35 |
| corn | 7 | 4 | 35→18 | 40→65 |
| potato | 6 | – | 40→25 | 20→25 |
| pumpkin | 10 | – | 120→45 | 60→45 |
| soybean | 6 | 3 | 15→12 | 30→40 |
| strawberry | 8 | 3 | 40→18 | 70→65 |
| blueberry (NEW, art pending) | 7 | 3 | –→15 | –→50 |

Other ingredients (buy/sell value): egg 10, pork 15, fish F 8, milk 12, honey 12, salt/sugar/fish sauce 1, honey apple 20, golden wheat 18.

## Dishes (price old→new)
grilled fish 30→30 · boiled egg 30→30 · baked potato 30→50 · grilled corn 30→40 · strawberry skewer 30→75 (recipe now strawberry ×2 + sugar ×1) · home kaprao 60→120 · scallion omelet 60 · tomato soup 60 · honey apple grill 60→65 · warm honey milk 60 · fish congee 120 · corn egg fried rice 120 · potato carrot stew 120→180 · honey pancake 120 · strawberry milk pudding 120.
Full ingredient lists are in the JSON.
