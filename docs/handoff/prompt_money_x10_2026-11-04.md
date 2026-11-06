New task (her decision): make every money number 10x bigger, purely cosmetic. The economy must stay exactly the same (all ratios the same). Read docs/handoff/00_rules.md first. Commit locally and wait for her "ส่งขึ้นเลย" before pushing. Report back in Thai.

- Multiply every coin value in the data by 10: crop sell prices and seed prices (crops.json, balance.json, the starter seed prices 8/8/10/30/30/35 → 80/80/100/300/300/350), dish prices (recipes.json), fish prices, cat-treat prices, shop/equipment prices, farm upgrades, chest coin rewards, and any other coin numbers (search the data and code for coins/price/money).
- Percentages and counts do NOT change (Gio commission 10-30%, star multipliers x1.2/x1.5, item counts, times).
- Starting coins and any coin thresholds: x10 too.
- Save version bump with a migration: existing saves get their coin balance x10 (and any stored prices), so an old save keeps the same buying power.
- Prefer one shared constant if the code formats money in many places, but the stored data should hold the real (x10) numbers, not a display trick.
- Update tests for the new numbers and add a test that the migration multiplies coins by 10 exactly once.
- GDD.md now has a note that every coin number in the document is x10 in the game.
