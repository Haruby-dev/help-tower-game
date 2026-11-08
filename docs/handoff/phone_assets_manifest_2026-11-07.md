# Phone app art -> public/ (7 Nov 2026). All approved by her, 0 PixelLab credits. Copy as is (no resize), register every file in assets-src/registry.json.
Source root: art-src/phone_ui_1106/   Target root: public/assets/ui/app_pages/

| From | To | Notes |
| --- | --- | --- |
| album/parts/album_*.png, padlock.png | album/ | book pieces (pink). frame = 9-slice 8, tab = 9-slice 5 |
| album/parts/polaroid_{tuna,chicken,salmon,special}.png | album/ | Gio photos 64x76 (photo 56x52 at 4,4; caption strip y 58-74) |
| album/parts/polaroid_special_locked.png | album/polaroid_locked.png | flavour never fed (same for every flavour) |
| album/parts/mpol_s_<id>.png, mpol_s_<id>_met.png, mpol_s_unknown.png, mpol_s_locked.png | album/ | monster slot 50x62 (photo 44x46 at 3,3) |
| album/parts/mpol_b_<id>.png, mpol_b_hangkradueng_met.png | album/ | monster detail 64x80, shown at 2x |
| album/parts/mpol_s_selfie.png, mpol_b_selfie.png | album/ | twins after the reveal. DO NOT copy mpol_*_twins (superseded) |
| pets/parts/pet_*.png, heart_*.png, check_*.png | pets/ | book pieces (mint) + bond hearts 9x8 + check 9x9 |
| pets/parts/card_*.png | pets/ | list cards 44x38: <pet>, <pet>_sick, <pet>_sil, unknown, locked |
| pets/parts/scene_*.png | pets/ | right-page scenes 253x100 at 1x (home scenes + scene_boomboom_heal + scene_mumu_sil). DO NOT copy plate_* (rejected variant) |
| gate/parts/*.png | gate/ | book pieces (lavender), tower_zone1 / tower_locked 170x208, scene_gate1..10 253x100 |
| mail/parts/*.png | mail/ | book pieces (sea blue), bottle / bottle_sil 16x24 |
| sugar_star/sugar_star_A_jelly5.png | ../icons/sugar_star.png | Sugar Star currency icon (FINAL). Beside numbers: the same icon at 2x |
| eat_slot/spoon_fork.png | ../hud_v2/icon_spoon_fork.png | 22x22 hand pixels: food-mode switch icon on the tool bar |
| ../strawberry_juice_1106/* | see its README | new dish strawberry_juice, 4 files, register like tomato_juice |

Monster ids: puinun popcorn mookmik tumtia hangkradueng yai wingwing tubpong jtt pft (floors 1-10).
Pet ids: pangpok nuebnub boomboom bubble mumu.
The recipe book already uses public/assets/ui/book (v4) — nothing new to copy.
