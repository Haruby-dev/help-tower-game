# Gio talk dialog (M6 item b) — APPROVED by her 2026-11-05 01:54

Not sent to the code side yet. It goes into the M6 code prompt together with the shop / consignment screens.

## Flow
1. Gio is at home all day, except 12:00–18:00 on a consign day; while walking to or from the burrow he cannot be talked to (updated 2026-11-05). Walking up to him turns the context action button into the **talk** icon: `art-src/ui_buttons_1104/action_icons/action_talk.png`, a cat-ear bubble with a heart. No text label (her rule: no labels under the action button).
2. Pressing it opens a **dialog box docked at the bottom centre** of the screen. The world dims slightly behind it (about 25% plum overlay).
3. Four big choices are laid out 2×2: ฝากขาย (consign) / ให้แมวเลีย (give a cat treat) / ลูบหัว (pat Gio's head) / ข่าววันนี้ (today's news).
4. To close: press the × coin at the top-right, or tap outside the box.

## Why a bottom dialog (her decision 23:21)
The first design was a list bubble above Gio's head. Its rows were about 3 mm tall on an iPhone, so one fingertip covered 3 rows. She chose a bottom dialog with big buttons, each about 7 mm tall and 3 cm wide. See `mocks/why_bottom_dialog_finger_check.png`.

## Built only from APPROVED HUD parts
She said the plain box "looked pasted on". It now uses the HUD material.

| Part | File | How |
|---|---|---|
| Box | `art-src/ui_buttons_1104/tool_tray_9slice.png` | 9-slice, corner 9 px, size 420×92 game px |
| Choice button | `art-src/ui_buttons_1104/tool_slot.png` | 9-slice, corner 9 px, 162×28, gap 6 (x) / 4 (y), first one at (70, 24) inside the box |
| Pressed button | `parts/tool_slot_pressed.png` | Same slot but deeper pink (#f696b4, shadow #de7094). Label turns white while pressed |
| Portrait | `art-src/ui_buttons_1104/portrait_frame_empty.png` (46×46) | Placed at (10, centred). Gio bust = `art-src/gio_v2/faces/gio_face_happy.png` crop (5,4)-(43,38), clipped to the inner circle, bottom-aligned 5 px above the frame bottom. Later: the face can follow Gio's mood (gio_v2 faces) |
| Cat ears | `parts/talk_ear_left.png` (16×15) | Left ear at box x 13; right ear = horizontal mirror at x 47. Both start 10 px above the box top, and the bottom 4 rows go behind the rim (draw the ears BEFORE the box) |
| Close | `parts/talk_close_btn.png` (18×18) | Top-right, x = boxW − 24, y = 4 px above the box top |
| Icons | `parts/talk_icon_{sell,treat,pat,news}_12.png` | 12×12, at (9, 8) inside each button |

## Text (Mali Bold, plum #5c304c)
- Name "จีโอ" in pink #d65484 at (72, 6). Gio's line follows it on the same row, e.g. "ว่าไงเชฟ~ วันนี้มีอะไรให้ช่วยเมี้ยว?". The line can change by time, mood or heart level (code picks from a list).
- Button labels start at x 27 inside the button and are vertically centred.

## Extras (her choice "1a")
- ให้แมวเลีย shows how many treats are in the bag, "×3", in small mauve #b26e8c at the right end of the button (×0 → grey button, see Button states).
- ข่าววันนี้ shows a pink dot #f06892 at the right end until the news has been read today.

## Button states (her decisions 2026-11-05 01:57)
- **No treats in the bag**: the ให้แมวเลีย button turns fully GREY (slot, icon and label desaturated, label #aa9ca8) and shows "×0". It cannot be pressed.
- **Already patted today**: the ลูบหัว button stays normal but shows a green check mark `parts/talk_check_done.png` (11×8, mint #68ba80 with plum outline) at its right end, 20 px from the edge, 10 px from the top. Pressing it again: Gio says a line such as "วันนี้ลูบไปแล้วนะเชฟ~" (suggestion), no extra happiness.
- Mock: `mocks/dialog_states_treats0_patted_4x.png`.

## Notes
- ลูบหัว is once per day (GDD: +3 happiness).
- Mock scale in the files = 4× (iPhone Pro Max 2796×1290). Positions above are in game px.
- Scripts: `art-src/gio_talk_1105/scripts/dialog2.py` (uses `menu.py` for the icons).
