# Prompt to the code side — answers to your zone-1 questions (her picks 2026-11-07 02:06)

> ⚠️ 2026-11-07 05:38 (planning): items about Wingwing (W1) and twin B likes (B2) are SUPERSEDED by the new zone-1 preference table (GDD "รสนิยมอาหาร", docs/zone1_menu_expansion_2026-11-07.md). Rewrite this prompt from that table before sending. Still ON HOLD.

```
Her answers to your report (GDD and docs/dialogue_zone1_draft.json are updated):
1. Twin B general lines: twin B now has its own lines, block `twins.B_general` in docs/dialogue_zone1_draft.json. Merge it into src/data/dialogue.json and use it whenever tangkrading_b visits (before and after the reveal). Before the reveal its dislike line still comes from dislike_B_pre.
2. Twin quiz: keep BOTH speech bubbles visible above the two twins during the whole choice, until the player taps one.
3. wingwing: favourite -> ["honey_pancake"], likes -> ["strawberry_skewer", "warm_honey_milk"] (favouriteDrink stays strawberry_juice, so "เข้ากันสุดๆ!" = honey pancake + strawberry juice). Dialogue: her favourite line becomes "แพนเค้กน้ำผึ้ง…!".
4. tangkrading_b: likes -> ["boiled_egg", "honey_pancake"] (warm_honey_milk stays its favourite drink).
Run the tests/validate. Show ONE screenshot of the quiz with both bubbles visible. Commit with the GDD and draft changes.
```

What this changes: twin B talks in its own voice ("คิกๆ"), the quiz keeps both lines on screen while you choose, Wingwing can now get the combo set, and twin B's second "like" slot counts.
