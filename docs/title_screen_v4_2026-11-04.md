# Title screen v4 — clean white (planning side, 2026-11-04)

She asked for a simple, exact title: a white background, the logo board, and two buttons. This **replaces v3**, which is parked because it had messy areas. It cost 0 credits.

- **Preview:** `docs/previews/title_v4_preview.gif`. It shows the logo animating, then the hover state on each button.
- **Still:** `public/assets/ui/title/v4/title_still.png`.

## Files: `public/assets/ui/title/v4/`
- Native resolution is 640×360. Show it at integer zoom only, with nearest-neighbour filtering. The background is plain `#FFFFFF`.
- All positions are in **`title_layout.json`**.

| File | Size | Use |
|---|---|---|
| `title_board.png` | 520×197 | Wooden vine board. Sampled from her reference at its true 7.5 px pixel grid, so it is not resampled. It was widened only by repeating plain wood columns. Draw at (60,16). |
| `../logo_floor_flavor_8f.png` (existing) | 8 frames of 389×60 | The official logo, unchanged. Draw at (129,64), 6.5 fps loop. With reduced motion, use `../logo_floor_flavor.png` at y+3. |
| `title_tagline.png` | 333×33 | "ติดหอคอยทั้งที ขอเปิดร้านข้าวก่อนนะ!" in Mali-Bold 18 px, pixel-clean. Draw at (157,124). |
| `btn_start_3state.png` / `btn_load_3state.png` | 3 frames of 172×49 (normal / hover / pressed) | Start at (234,227); Load at (234,282). Hit area is the top 172×46. The pressed frame already moves the face down 1 px. |

## Behaviour
- Start → start the game. Load → open the save slots.
- Swap to the hover frame on pointer-over or keyboard focus, and to the pressed frame on pointer-down.
- Keep it static apart from the logo animation.

## Update: board motion (she asked for "ป้ายขยับนิดหน่อย", i.e. "make the sign move a little")
- **Gentle bob:** the board, logo, tagline and twinkles move together as one group.
  - Offset: `offset_y = round(2 * sin(2π t / 4.0))`, so ±2 px over a 4 s period.
  - Integer pixels only.
  - The buttons stay still.
- **Twinkles:** `twinkle_4f.png` has 4 frames of 7×7 (off / small / big cross / small).
  - Play it once at 10 fps over each baked sparkle on the board, then wait a random 1.5–4 s before the next.
  - The centres, in board coordinates, are in `title_layout.json` under `twinkles.centers_in_board`.
- **Reduced motion:** no bob and no twinkles.
- **Preview:** `docs/previews/title_v4_anim.gif`.
