# Design update B — 2026-11-01 (from the planning side)

This is newer than `docs/art_update_2026-11-01.md`, CLAUDE.md and the GDD, and wins where they disagree. Merge it into CLAUDE.md and the GDD (keep both in Thai). Nothing here needs PixelLab credits. Art that does not exist yet must use labelled placeholders.

Dialogue lines are in `docs/dialogue_zone1_draft.json`. They are a draft written in Thai. Load them from data; never hard-code them.

---

## B1. Speech bubbles (Kairosoft style) — monsters, pets, Gio

**Bubble look and rules**
- Short words pop above a character's head: a small white rounded bubble in the Mali font.
- Each bubble lasts 1–2 s, then fades.
- At most 2–3 bubbles on screen at once. When there are more speakers, they take turns.
- Normal lines are random, roughly a 30–50% chance per trigger. Key lines always show: "favourite", "set bonus" and "100%".
- All lines live in a data file keyed by character → trigger → affection tier, so the user can edit them without touching code.

**Monster triggers:** `appear` (out of the burrow), `browse` (walking along the tray), `dislike`, `like`, `favourite`, `eat`, `done`, `emptyTray`.

**Wording changes with affection**
- `hungry` (red eyes, low affection): short and blunt.
- `warm` (medium): polite.
- `close` (high, sweet eyes): calls the player "เชฟ".

**Personal voice:** each monster talks in the voice of its GDD personality (shy, cheerful, proud, lazy, elder).

**Pets:** they speak too. Triggers are `morning`, `produce`, `pet` (when stroked), `hungry` and `idle`.

**Gio** talks the most and is the face of the game. Triggers:
- `greet`, `news` (tells monster tips), `sale`, `idle`, `licky` (begging for Meow Lick), `sad`.
- `shy-monster` (for example "ชู่ว! อย่าขยับนะ น้องขี้ตกใจ" when Puinun is around).

## B2. Monster look & hunger states

- **Lore:** the tower's hunger seeps into its monsters. Red eyes do not mean evil. The monster is so hungry it has forgotten who it is, and food brings it back.
- **Progression across the tower:** low floors are small, weak-looking critters. Higher floors are bigger and more villainous. EVERY monster still turns from red hungry eyes into sweet eyes.
- **Hunger matches each monster's theme**, not just the eyes. Zone 1 examples:
  - Puinun: grass wool wilted to straw colour and a closed daisy → green fluffy wool and the daisy in bloom.
  - Toom-tia: faded cap with the spots gone → bright cap, sleeping happily.
  - Grandma Leaf: bare branches and dry moss beard → flowers on her head.
  - Wing-wing: frosted, cloudy wings → clear rainbow glass wings.
  - Scarecrow: birds gone and a torn hat → birds back on his shoulders.
- **Art per base body:** 2 states (hungry and sweet), 1 eating pose, and a walk.
  - In-between affection uses a code tween of eye colour and aura (dull purple → pink sparkle).
  - The run reuses the walk animation, played faster.
- **Not made yet.** Use placeholders. The planning side will deliver Puinun first.

## B3. Pet produce (check against the GDD pet table)

- **GDD functions stay.**
  - Kai Pok: eggs.
  - Nueb Nub: auto-waters 6–20 farm cells a day.
  - Boom Boom: honey and wax, plus pollination.
  - Bubble: cleanliness, and washing trays.
  - Mumu: milk, which becomes butter, cream and cheese.
- **Names (decided by the user):** show ปังป๊อก (was ไข่ป๊อก) / หนึบหนับ / บึ้มบึ้ม / บับเบิ้ล / มูมู่เมฆ. Keep the asset ids (`kai_pok_*`) as they are. Pangpok is a bread-loaf chicken with butter on its head; Mumu Mek is a marshmallow cow with a bell tail.
- **New, small:** Bubble also gives "fizzy bubble water", used for the soda-jelly drink.

## B4. Drinks — a new menu category

- **Menus now have 3 categories:** savory and dessert, both cooked in the kitchen, plus **drinks**.
- **Drinks are made at the drink bar.** They use no equipment slot and have a short brew time, so the player can make them while food cooks.
- **Zone-1 drinks (draft):**
  - Warm honey milk (moved from dessert)
  - Butter tea (butter from Mumu's milk)
  - Marshmallow milk (Mumu)
  - Soda jelly (Bubble's fizzy water)
  - Vanilla honey (Boom Boom)
  - 1–2 early drinks from starter crops, so drinks exist before the pets meadow unlocks. For example, strawberry juice.
- **Affection:** a drink gives less affection than food. A monster that takes a matching food + drink "set" gets a bonus and pops "เข้ากันสุดๆ!". Use placeholder numbers and keep them in data.
- **Favourite drink:** each monster can have one, and Gio's news can reveal it.
- **Rank requirements for drinks:** ask the user before deciding.

## B5. Recipe book (do NOT call it grandma's before chapter 9)

- **Day 1:** the player finds an old, **unsigned** recipe notebook in the house. The house was the previous chef's.
  - The first page is torn out.
  - The handwriting feels familiar.
  - The first recipe is kaprao: "เหมือนสูตรที่บ้านเลย… บังเอิญเหรอ".
- **Pages:**
  - The paper is old and cream-coloured, with handwriting and small pixel drawings of the food.
  - A locked recipe shows a silhouette, "???" and a handwritten hint.
  - A cooked recipe fills in with colour and gets a stamp for the best star rating achieved.
  - Fan stickers show the faces of monsters who love that dish.
  - Some pages hide secret notes signed with a small basil-leaf mark.
- **Tabs:** savory / dessert / drinks.
- **Chapter 9 reveal (matches the GDD):** the player finds the torn first page. It has grandma's name and a drawing of a pink kitten (Gio as a kitten). From then on the book's title becomes "สมุดสูตรของยาย".
- The handwriting is the same as in bottle letters 6, 8, 15 and 18, as the GDD already plans.

## B6. Restaurant team

- **The player** is the chef.
- **Gio** stands at the order counter as cashier: greets customers ("เมี้ยว! ยินดีต้อนรับ") and collects coins. Tips grow with Gio's happiness gauge.
- **Bubble** washes trays.
- **Monsters at 100%** sometimes volunteer to carry a plate.

## B7. Hiring staff (LATER milestone, after the core loop works)

- Befriended monsters can be hired as restaurant staff. **Only 3 are hireable at first:**
  - Puinun: slow, but never drops a plate.
  - Popcorn: a very fast flyer who sometimes sneaks a bite.
  - Tang-Krading: rings his bell to draw extra visitors.
- **Wage:** coins, or that monster's favourite dish, paid daily.
- **Staff slots:** start at 1 and can be expanded.
- **Art needed:** one carry-plate pose per hireable monster. The apron is a code overlay.

## B8. Gio's selling trip — a mini window (Kairosoft "send to dungeon" style)

- When Gio is sent to sell, a small window opens in a screen corner. The player can keep playing while it runs.
- **Inside the window,** this plays out over time:
  1. Gio pops out of a burrow.
  2. He hops along.
  3. He unfolds a little table and lays out the goods.
  4. Monsters come one by one and buy, with speech bubbles ("ขอสองอัน!").
  5. A coin pops up for each sale.
- **At the end:** a summary of items sold, coins earned, and which monsters "caught the smell", meaning they will visit tomorrow (GDD rule).
- **Art:** a mini backdrop and a folding stall. Not made yet, so use placeholders. Unknown customers can be dark silhouettes until the monster art exists.

## B9. One gate portal

- There is **one** gate portal, on the plateau. Interacting with it opens a **floor-select menu**. This replaces the GDD line "each floor's door appears in the yard".
- **Each unlocked floor shows:**
  - the zone weather icon
  - the floor monster's face in its sweet state
  - a dot if today's forage is still available
- **Locked floors** are dimmed, with a faint red-eyed face of the monster waiting there.
- **Sleepy system voice:** "[ระบบ] ชั้น 3… ฮ้าววว… เปิดแล้ว".
- **Portal colour:** the glow tints to the selected zone's colour in code (meadow green, desert orange, and so on).
- **Gate 10 reward:** the "wooden swing" stays a plain wooden home-decor swing. It is not part of the Sugar Stars playground costumes.

## B10. Player hairstyles (art not made yet)

- **Girl:** hime cut, wolf cut and short hair with bangs. Later: long straight. The existing braids stay.
- **Boy:** comma hair, two-block with fringe and wolf cut. The existing hair stays.
- **Hair colour** is a palette swap in code, so any hairstyle can take any colour.
- **Special outfits use hoods or hats** (chef hat, Puinun sheep hood, straw hat, cupcake hood). They cover the hair, so outfits do not multiply with hairstyles.
- Plain outfits are recoloured in code.
- **Build the character creator** so that adding a hairstyle is just a new registry entry. Use placeholders until the art arrives.

## B11. Phone UI (direction approved, final art not made yet)

Mockups: `docs/level/2026-11-01/ui12_wallet.png` and `ui10_flip_closed.png`, `ui11_flip_skins.png`.

- **Top bar:** only the portrait with its ring gauges (top left) and the coin pill (top right). **Remove the name/day pill.** The day, time and weather now live in the phone.
- **Closed phone = the menu button:** a square clamshell foldable in the bottom-right corner. Two round cameras on the left, a tall cover screen on the right showing the time and the day. A red badge shows unread letters.
- **Tap = open:** a short animation where the phone flips open and turns into a wide, book-style screen with a fold line in the middle.
  - The left page shows the app grid.
  - The right page shows the selected app.
  - The status bar shows time · day · weather.
- **Apps (11):** กระเป๋า, **กระเป๋าเงิน (new)**, ร้านค้า, สมุดสูตร, อัลบั้ม, สัตว์เลี้ยง, เกต, จดหมาย, ชุด/ทรงผม, ตั้งค่า, **สนับสนุนเดฟ (new; placeholder only, no details yet, no real-money flow)**.
- **Wallet app (กระเป๋าเงิน):**
  - Two balance cards: coins and Sugar Stars.
  - Tabs for today / this week / all, with the net total.
  - A transaction log listing each income and expense: what it was, the category (ร้านอาหาร, จีโอ, ร้านค้า, สัตว์เลี้ยง, ...) and the amount.
  - **Every coin or Sugar Star change must write a log entry.** Keep the log in the save data, capped (for example the last 200 entries plus daily totals).
- **Phone skins and cases (later, cosmetic):**
  - Body colour is a palette swap in code.
  - Ears, strap charms and case patterns are small overlay sprites.
  - Can be sold for Sugar Stars.
  - The default skin is lavender.
- **The vintage pink flip phone mock (`ui6`, `ui7`) is rejected.**
