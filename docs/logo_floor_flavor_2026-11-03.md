# Logo — Floor & Flavor (2026-11-03)

The final game logo. It replaces any text title. The look matches the recipe book: soft cream-to-peach letters with a warm brown outline.
- The first O in FLOOR is a pink sprinkle donut.
- The O in FLAVOR is a smiling tomato.
- The "&" is gold.
- Two basil leaves sit on the first F.

Files are in `public/assets/ui/title/` and are native pixel art (base 640×360). Show them at the game's integer scale only.

| File | Size | Use |
|---|---|---|
| `logo_floor_flavor.png` | 389×57 | Static logo (title screen, loading screen, About) |
| `logo_floor_flavor_8f.png` | 8 frames of 389×60 (sheet 3112×60) | Animated title-screen logo. The donut and tomato take turns bouncing, with 3 small sparkles. Play with `steps(8)` at about 6–7 fps, infinite. Falls back to the static logo when reduced-motion is on. |
| `logo_tagline_th.png` | 276×24 | Thai tagline "ติดหอคอยทั้งที ขอเปิดร้านข้าวก่อนนะ!" on a soft rounded label |

Title screen placement (640×360 base):
- Centre the logo horizontally at y ≈ 64.
- Put the Thai tagline label centred 6 px below the logo.
- The English line "Cook your way up 100 floors." may be added as small text below the label (game font, cream with a dark outline). It is optional.

The frame sheet's frames are 3 px taller than the static image (bounce headroom), so align them by the bottom edge.

Previews: `docs/previews/logo_title_preview.png` and `logo_title_anim.gif`.
