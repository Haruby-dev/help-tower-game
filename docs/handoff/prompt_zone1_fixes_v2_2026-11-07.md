# Prompt to the code side — zone-1 small fixes v2 (2026-11-07 05:45)

Replaces prompt_zone1_fixes_SUPERSEDED_2026-11-07.md (its Wingwing and twin-B-likes items were replaced by the new taste table, which waits for the menu expansion).

```
Two small zone-1 fixes (her picks 2026-11-07). GDD and docs/dialogue_zone1_draft.json are already updated.
1. Twin B general lines: merge ONLY the block `twins.B_general` from docs/dialogue_zone1_draft.json into src/data/dialogue.json, and use it whenever tangkrading_b visits (before and after the reveal). Before the reveal its dislike line still comes from dislike_B_pre.
2. Twin quiz: keep BOTH speech bubbles visible above the two twins during the whole choice, until the player taps one.
Do NOT change monster preferences in monsters.json, and do NOT merge the other changed lines in the draft (favourite lines of puinun, popcorn, yaibaimai, wingwing, tubpong, and gio.news[0]). They belong to a zone-1 menu expansion whose dishes do not exist yet; a separate prompt will come when those dishes are ready. FYI only, no work now: the new taste table is in GDD "รสนิยมอาหาร" and docs/zone1_menu_expansion_2026-11-07.md.
Run the tests/validate. Show ONE screenshot of the quiz with both bubbles visible. Commit together with my doc changes (docs/GDD.md, docs/dialogue_zone1_draft.json, docs/zone1_menu_expansion_2026-11-07.md, docs/handoff/).
```
