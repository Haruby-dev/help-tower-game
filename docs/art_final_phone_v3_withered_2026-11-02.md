# Final art: phone v3 + withered crops (2026-11-02)

0 PixelLab credits. All PNGs are 1x native pixels. Scale only by whole numbers with nearest-neighbour (CSS `image-rendering: pixelated`).
Preview sheets: `docs/level/2026-11-02/ui39_final_v3_sheet.png`, `docs/level/2026-11-02/withered_preview.png`.

## Phone v3 — `public/assets/ui/phone_v3/`
These replace the placeholders in `ui/placeholder/` and the matching files in `ui/phone/`. Add registry ids (suggested: `ui_v3_<filename>`).

| file | size | use |
|---|---|---|
| cat_orange / cat_calico / cat_gio / cat_grey | 19×15 | sleeping loaf cats on the wallpaper. Big lock screen: all 4 (2 of them mirrored). Mini lock: orange + gio. |
| weather_sun / cloud / rain / storm | 25×18–24 | weather cat icon, lock screen + mini lock |
| wallpaper_sky, wallpaper_gio | 108×138 | lock / folded screen wallpaper (cosmetic slot, sky = default) |
| wallpaper_sky_wide, wallpaper_gio_wide | 216×138 | same wallpaper for the unfolded phone |
| case_back_pink / gio / straw / mint | 111×140 | whole back of the phone incl. ears, 2 cameras and strap charm. pink = default. Shown after the flip. |
| phone_case_9slice | 32×32 | pink case frame, 9-slice with 12px borders, centre is transparent (screen goes behind) |
| lock_rim_9slice | 16×16 | cream rim for the corner mini lock button, 9-slice 6px |
| note_card_9slice | 16×16 | white card with pink border (encouragement card, widgets), 9-slice 6px, opaque |
| phone_ear | 17×11 | cat ear on top of the front case (left + right) |
| phone_camera | 11×11 | single lens, if the back is ever drawn in parts |
| punch_hole | 5×5 | front camera hole |
| paw_button | 16×16 | round paw button on the lock screen |

Text (time, day, weather name, encouragement line) stays live Mali text with a dark/blue outline as in the mockups.

## Withered regrow crops — `public/assets/farm/crops/withered/`
`withered_<crop>.png`, 32×40, same canvas and anchor as one stage of `final_<crop>.png`.
Crops: chili, basil, tomato, cucumber, corn, soybean, strawberry.
Show it after the last regrow harvest (see docs/economy_balance_2026-11-02.md). Replaces the "dry tint" placeholder.
