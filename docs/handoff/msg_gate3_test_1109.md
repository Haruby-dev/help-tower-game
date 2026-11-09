# ข้อความฝั่งโค้ด: ทดลองเล่นเกต 3 (9 พ.ย. 16:0x · เธออยากลองในเกม)

```
Gate 3 playable test (her request: she wants to walk around one gate in the game now). New approach for gate maps: each gate is ONE painted background image (made with GPT, pixelised by us) + a foreground layer + a collision grid + sprites. Not Tiled tiles.

Files (copy to public, keep names): art-src/gate_maps_1109/gate3_final/
- gate3_bg.png 896x512 (28x16 tiles of 32px, same pixel density as the yard, 1:1, nearest). jade_tone: false (do NOT jade-tone gate art).
- gate3_fg.png 896x512 RGBA: draw ABOVE player and sprites (bottom hedge edge so the player's feet tuck behind it).
- gate3_map.json: size, spawn, exit_zone (tiles x0,y0,x1,y1), owner, reward_chest, forage points, kin (count, variants, wander_area, home_burrows), burrows, blocked (list of [x,y] tile cells the player cannot enter). All positions are in TILES; a sprite position = its feet (bottom centre).
- sprites/: mookmik_kin_{brown,grey,cream}_{stand,walk,eat}.png (same frame layout as public/assets/monsters/mookmik/mookmik_sweet_*), wild_cloud_lettuce.png (forage, feet = bottom centre), gate_reward_chest.png (the house chest art).
- gate3_preview.png / gate3_debug.png show where everything goes (red = blocked, yellow = interact, blue box = exit, blue dot = spawn).

Scope (test only, keep it small, reuse existing code where possible):
1. A generic GateScene driven by gate3_map.json (so gates 1-10 can reuse it later). Layers: bg (bottom), y-sorted sprites (player, owner, kin, chest, forage), fg (top). Camera like the yard.
2. Entry: a test button in Settings "เข้าเกต 3 (ทดสอบ)". (Hooking the yard gate portal + floor menu can come with M8 proper.)
3. Exit: player walks into exit_zone -> back to the yard in front of the gate portal. Stay limit from gates.json stayHours (2 game hours) -> auto return with a short line.
4. Owner Mookmik stands at owner.pos (sweet stand anim). E near = one short line from existing Mookmik lines (any).
5. Kin: 3 rabbits (brown, grey, cream) wander slowly inside wander_area, avoid blocked cells, idle sometimes; no talk.
6. Reward chest at reward_chest.pos: first visit only, E = open -> cloud lettuce seed x5 (use the existing item id if there is one; if not, add a placeholder item and tell me). After opening, chest disappears (or stays opened) and never refills. Save the flag.
7. Forage: wild cloud lettuce at the 4 points, E = pick 1 each, respawn next day. Item: add "wild_cloud_lettuce" as a placeholder ingredient if missing (icon = sprites/wild_cloud_lettuce.png) and tell me.
8. Interaction button on mobile = the generic paw icon, keyboard E (as decided).
Optional if cheap: slow drifting soft cloud shadow overlay (multiply, low alpha) for the "cloud shadows" theme.
Not in scope: floor select menu, pets, other gates, balancing.
Please report what you decided yourself (with screenshots) when done.
```
