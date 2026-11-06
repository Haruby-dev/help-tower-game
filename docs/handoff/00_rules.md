# 00 — Working rules (read first in every new chat)

> **Also read `04_us.md` before starting. It explains HOW to work with her: show → explain → ask → wait. Don't rush, don't decide for her, and don't send prompts before she approves.**


## People and roles
- The user is Thai and not a programmer. She does planning and art direction and enjoys the work, so don't push her to rest.
- **She does not draw.** Never offer "you draw it yourself". She brings reference images (often AI illustrations) and Claude turns them into game art.
- Claude (this chat type) is the **art/planning side**: it makes art, docs and English prompts.
- A separate "Claude Code" (the **code side**) builds the game. It never generates images.

## Communication
- Reply in **Thai**, short and friendly. **ALWAYS Thai, every single reply, including after long tool runs and late at night. Never switch to English** (2026-11-06: a chat slipped into English 4 times and she had to ask "ขอไทย" / "ไทยๆ"; she explicitly asked that this never happens again). Only the English prompts for the code side are in English, inside a code block. Prompts for the code side are written in **English** inside a code block.
- Show numbered options with one recommendation marked ⭐. Always offer a cheaper option.
- Show art inside the real game scene or a mock whenever possible.
- She sometimes sends half a sentence by accident. Guess 2–3 meanings and ask.

## PixelLab credits (very important)
- **Always quote the credit cost and wait for a clear OK before every generation.** Hand-drawn or code-drawn work costs 0 credits and needs no approval.
- Never paste the PixelLab API token in chat; it lives only in `.env`, which is never committed.
- Prices:
  - pixen: 1 credit.
  - pro 48px: 10 credits.
  - edit_image_pixen: 1 credit.
  - pro_flash edit/inpaint: 5–6 credits.
  - create_character v3 with a reference image: 1 credit; importing all directions: 0.25 credits.
  - animate_character template: 1 credit per direction; v3 custom: about 1 credit per direction at 56–72px.
- The container cannot reach backblaze/pixellab directly (curl returns 403). Workarounds:
  - Downloading: use `pixelart_workbench join <urls> --as sheet` and read the returned blob. It has an 18px header (crop `offset = height − rows·size`), and the background colour (31,37,44) must be keyed out.
  - Sending an image in: pass it as small base64 (<4KB PNG). Uploads are blocked.
- Run at most 10 jobs at once. Use `wait_for_jobs` instead of polling.

## Art rules
- Use integer nearest-neighbour scaling only. Never scale an individual sprite. Draw any new size natively.
- The game never calls PixelLab at runtime.
- Style: soft, cute, pastel (kawaii), not gritty or retro.
  - Savory food sits on a banana-leaf boat tray (there are no plates in the dungeon).
  - Desserts have no tray.
  - Drinks come in bamboo cups.
  - Eggs are Pangpok eggs (bread-coloured shell with butter on top).

- Preview GIFs must be colour-exact: build the GIF palette from all sprite colours (no quantize/dither) and verify (2026-11-06: a quantized GIF turned colours wrong and she noticed).

## Delivering to the user's PC (device bridge)
- Project folder on the device: `~/mnt/help-tower-game/help-tower-game` (Windows path `C:\Users\Railg\Desktop\help-tower-game\help-tower-game`).
- Steps:
  1. Zip the files into `/mnt/user-data/outputs/` with a **new name every time**.
  2. Call `device_commit_files`.
  3. Unzip on the device with python `zipfile`.
- Give the code side a zip + a doc in `docs/` + an English prompt.
- Krita is on her PC (MCP `krita__*`). Layered `.kra` source files live in `art-src/`.

## Token budget
- Long chats get expensive. When a chat grows long, write a handoff to `docs/handoff/` and start a new chat.
- Open images only when needed.
