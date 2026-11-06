New small task (after the current commit is pushed). Read docs/handoff/00_rules.md first. Commit locally and wait for her "ส่งขึ้นเลย" before pushing. Report back in Thai.

1. Batch cooking (her decision): she can cook SEVERAL plates of ONE recipe in one go.
   - In the cooking window, after choosing a recipe, add a quantity stepper "− n +" (same pink style as the other buttons). Default 1.
   - Max n = how many full sets of ingredients she has in the bag. No other cap.
   - Show the totals next to the stepper: ingredients needed (x n) and total cooking time.
   - Cooking time = recipe time x n (no discount). Ingredients are taken x n when cooking starts.
   - All plates in one batch get the same star quality (one roll for the batch). EXP and other per-dish rewards are counted per plate.
   - When done, all n plates are collected together into the bag.
   - Her earlier decision stays: if she presses stop / walks away, she stands up and the food keeps cooking at the campfire; she collects it later. With a batch, the whole batch keeps cooking.
   - Add unit tests for: max n from ingredients, time x n, ingredients x n, same stars for the batch.
2. UI change (her decision 2026-11-04 23:04): REMOVE the text label under the context action button for ALL actions (no pill, no "ตกปลา"/"อาบน้ำ"/... text). The round button with its icon alone is enough. Keep the label strings in i18n (accessibility / future tooltip), just don't draw them. Mock: art-src/ui_buttons_1104/mocks/talk_button_nolabel_mock_1104.png.

3. Rename (her decision): dish strawberry_skewer is now called "ถังหูลู่สตรอว์เบอร์รี" (strawberry tanghulu). Change only the Thai display name in src/i18n/th.json (dish.strawberry_skewer.name) and any other Thai text that shows the old name. KEEP the id strawberry_skewer, the icon files and the recipe (2 strawberries + 1 sugar) so old saves still work. GDD already updated.

Run the tests, commit locally, wait for "ส่งขึ้นเลย".
