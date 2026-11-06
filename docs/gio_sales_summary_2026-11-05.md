# Gio evening sales summary ("Gio's receipt", M6 item c) — APPROVED by her 2026-11-05 02:13

Not sent to the code side yet. It goes into the M6 prompt.

## When it appears
On a consign day Gio leaves at 12:00 and comes back at 18:00 (updated 2026-11-05: on other days Gio stays home all day). As built by the code side, the popup opens when Gio sits back down in the basket.
- The game clock pauses. The HUD (toolbar, action buttons, joystick) is **hidden** while it is open. The mocks still show the HUD only because they reuse an old screenshot.
- The world dims with an evening plum overlay of about 47% (60,30,70,120).

## Layout (game px; the mocks are 4×)
- **Receipt paper**: 204 px wide, centred slightly right of the screen centre. Cream #fffcf4, plum 1 px outline, torn zig-zag bottom (period 8, depth 4), soft shade on the right edge. Drop shadow (plum, alpha about 30%) offset 3,4.
- **Washi tape**: pink, on the top centre of the paper → `parts/receipt_washi_tape.png`.
- **Gio**: stands left of the receipt in the paw-rubbing pose `art-src/shop_1104/gio_shop_rubpaws_64.png`, with a small speech bubble. The line depends on the result, for example:
  - normal: "ขายดีมากเลยเชฟ~ เมี้ยว!"
  - big day: "วันนี้ขายดีสุดๆ เลยเชฟ! เมี้ยว~"
  - Write more lines later for a bad day or for low happiness.

## Content, top to bottom
1. **Title**: "ใบสรุปยอดขาย" (40px Mali at 4×). Under it, in small mauve: "จีโอกลับมาแล้ว · วันที่ N".
2. Dashed divider.
3. **Sold list**, one row per item kind, 18 px tall:
   - 16 px icon (`public/assets/food/ingredients_mini/*`), then the name, then "×n" in mauve.
   - Right-aligned price total, followed by the 12 px paw coin `art-src/ui_buttons_1104/coin_paw_12.png`.
   - **Her rule (02:11): when there are more than 3 kinds, the list SCROLLS inside the receipt.**
     - The window shows about 3.6 rows. The last visible row fades into the paper.
     - A pink hint sits at the bottom of the window: "▼ เลื่อนดูอีก N รายการ".
     - A thin pink scrollbar runs on the right (track #f6dee6, thumb #f078a0).
     - The receipt height stays the same no matter how many items there are.
     - With 3 or fewer kinds there is no scrollbar and no hint.
4. Dashed divider.
5. **ยอดขาย** (gross) and **ค่าคอมจีโอ X%** (commission, in pink, negative). X comes from Gio's happiness: 10, 20 or 30% (GDD).
6. Double pink line.
7. **ได้รับ** (net amount) in big text, with two paw coins stacked. The paw stamp `parts/receipt_paw_stamp.png` (semi-transparent pink) sits between the label and the number, like a "paid" stamp.
8. Dashed divider.
9. **Gift row** (only when Gio brings a strange gift, at happiness 70+, 20% chance): a light-pink rounded band with a 16 px item icon, the text "ของฝากจากจีโอ! <item> ×n" in pink, and 2 tiny yellow sparkles.
10. **Notes** (25px at 4×, colour #92607c):
    - "ขายไม่ออก คืนเข้ากระเป๋า: <item> ×n" with the item icon. This only appears at low happiness, when half the bag comes back.
    - "พรุ่งนี้มอนสเตอร์มาเยี่ยม N ตัว" (N = 1 + sold ÷ 4, max 6).
    - "มีข่าวใหม่ N ข้อ" followed by the pink unread dot. It is the same dot as on the talk dialog.
11. **"รับเงิน!" button** inside the receipt: `parts/receipt_take_button_120x28.png`, a 9-sliced pressed-pink tool slot with a coin, white text. Pressing it adds the coins (coin sound + count-up), closes the popup and shows the HUD again.

## Numbers in the mocks (×10 money)
3 kinds: strawberry 5×400 + corn 2×350 + tomato 3×200 = 3,300. Commission 20% = −660. Received 2,640.

## Files
- `art-src/gio_summary_1105/parts/`: stamp, washi tape, take button.
- `mocks/`: receipt_short_4x, receipt_long_scroll_gift_4x, summary_scene_short_vs_long, long_list_options_A_vs_B (the B grid option was rejected).
- `scripts/summary.py` + `long.py`: build the mocks. They use `art-src/gio_talk_1105/scripts` helpers.
