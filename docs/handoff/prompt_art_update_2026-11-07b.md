# Prompt for the code side — art update 2026-11-07b (written 7 Nov 16:2x, her OK '1' at 16:17)

```
Art update from the planning/art side (2026-11-07b). The user approved all of it. Read docs/art_update_2026-11-07b.md first.
All art files are ALREADY in public/assets (same names unless marked NEW). Please:

1. Monsters: 61 sheets in public/assets/monsters/* were replaced (same names, same frame layout). Every zone-1 monster
   now uses Puinun's outline colour #1e0d26; Popcorn hungry is light green; Mookmik eye fixes. Puinun files unchanged.
   Rebuild the WebP atlas pages (monster_* groups and ui) so the game picks up the new files.

2. Gate app (src/ui/gateBook.ts):
   - tower_zone1.png now has ALL 10 floors drawn open. Remove the OPEN_ART_UP_TO = 6 limit so open floors 7-10 use the art.
   - Right page: remove the gate scene box (do not show scene_gate*.png for now; keep the files, do not delete them).
     Open floor: draw the floor owner's sweet stand SOUTH frame (frame 0 of <id>_sweet_stand; floor 5 = twin A
     tangkrading_a_stand) at 1x directly on the paper, horizontally centred at page x=148, feet at page y=118, no box.
     Shut floor: show only the padlock (book_gate_padlock) on the paper in that area, no picture.
     Keep the text rows where they are.

3. Pets app (src/ui/petsBook.ts), "not met" right page:
   - No meadow scene box any more. Draw NEW pets_sil_<id> (public/assets/ui/app_pages/pets/sil_<id>.png) on the paper:
     pangpok, nuebnub, boomboom, bubble at scale 2, mumu at scale 1; centred at page x=148, feet at page y=120
     (boomboom feet y=110, it hovers). Put the "?" in colour #7aae96, about 24px font, just above the head
     (top = feetY - drawnHeight - 30).
   - Pet with no art yet (pokpaek): no card box on the right page, just a big "?" in #7aae96 (about 60px) centred near the top.
   - card_<id>_sil.png were replaced (darker S3 silhouette) - same names. scene_mumu_sil.png is no longer used.

4. Album: NEW album/mpol_b_<id>_met.png for puinun, popcorn, mookmik, tumtia, yai, wingwing, tubpong, jtt, pft
   (big silhouette for "met, not 100% yet"). album.ts already uses album_mpol_b_<id>_met when it is registered -
   register them. mpol_s_* / mpol_b_* photos were also replaced (new outline).

Do not change any art yourself. When done, tell me the commit hash and send screenshots of: the gate app with floor 10
picked (all floors open), the pets app on a not-met pet (pangpok) and on pokpaek, the album on a met-not-100% monster,
and the yard with a few monsters (sweet + hungry).
```

What it changes in the game (for her): every monster gets the same dark outline as Puinun; Popcorn's hungry look is light green; Mookmik's face is clearer and no longer cross-eyed; the gate app shows all 10 floors and the owner standing on the page instead of a scene; the pets app shows silhouettes on the paper; the album shows big silhouettes.
