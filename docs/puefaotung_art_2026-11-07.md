# ผู้เฝ้าทุ่ง (floor 10, zone 1) — art spec 2026-11-07

Status: ART APPROVED by her 2026-11-07 00:44 (pick "1"). Not in `public/` yet, no code prompt yet (zone 1 is sent all at once).

## Look (her picks)
A **wooden nutcracker / peg-doll toy grandpa** (from her own small nutcracker reference; her pick B "follow the ref, swap the hat + add a bird",
then ก "wooden toy, not a person" after round 1 looked "เหมือนคนไปหน่อย"). One smooth wooden body with **no legs** on a round wooden base,
painted peach face, round glasses, white moustache, white curly hair puffs, dark fringe under the brim (kept as AI made — her pick "เอาก่อนแก้"),
**wide golden straw hat with a red band**, red soldier jacket with gold buttons + white collar + dark belt, round wooden knob hands,
**tiny light blue bird on his left shoulder** (my default colour; she did not ask to change it). Used AS THE AI MADE IT (pixen 96f33908, her pick G),
only the outline moved to the gang plum #4a073e (glasses/eye lines stay dark). Canvas **64x64**, stand bbox (13,3)-(50,61): **last opaque row y=60**.

## Movement (her pick M1)
He hops like a wooden toy instead of walking. Hand-made 0 cr (`scripts/hop.py`): the whole sprite + base lifts **0,2,3,3,2,0 px**, 6 frames,
durations **140/100/100/140/100/160 ms**. The bird lags on take-off (0,1,2,3,2,0) on S and N; on W the bird overlaps the face/collar so it moves
with the body; E shows no bird. Max lift is 3 px because the hat top reaches row 0 (64 canvas). The code moves his position; this loop plays while moving.

## Files — `art-src/puefaotung_1106/final/` (64x64 cells)
| File | Size | Layout | Timing |
|---|---|---|---|
| `pft_sweet_stand_4dir.png` / `pft_hungry_stand_4dir.png` | 256x64 | S, E, N, W | — |
| `pft_sweet_hop_4dir.png` / `pft_hungry_hop_4dir.png` | 384x256 | rows S, E, N, W × 6 frames | 140/100/100/140/100/160 ms |
| `pft_sweet_eat_south.png` / `pft_hungry_eat_south.png` | 512x64 | 8 frames, south only | 150 ms |

Rotation = AI as made, all 4 dirs (no mirror: the bird is on one shoulder; AI placed it correctly — hidden on E, visible on W, left side on N).
Eat = AI frames as made: raises the left wooden hand to the mouth under the moustache, happy squint/wink, body/hat/bird never move.

## Hungry state (her picks C1 + S1) — from his line "นกหนีไปหมดแล้ว…"
**The bird is gone** (S/N: the other shoulder mirrored over it, x' = 62 − x; W: patch from mirrored E; eat frames: patch from the hungry stand).
Coat + hat band **dusty rose** (hue 350, sat ×0.45), straw hat / wooden hands / base / gold buttons faded (sat ×0.6, val ×0.93),
orange coat highlights faded too, face highlights kept. South eyes get a flat lid line and no shine (no mouth visible under the moustache);
side eyes unchanged (too small). Scripts `scripts/hungry_pft.py`, `scripts/eat_hungry_pft.py` (frame-0 check: 0 px diff vs the hungry stand outside the eye rows).

## Source / history
- Round 1 pixen (3 cr: 04b85240 / dcc11b5a / 7eb3ca7e) = human grandpas with legs → rejected ("เหมือนคนไปหน่อย").
- Round 2 (3 cr: 4040632a / 06be99c0 / 6ccc2af2) wooden toy, still drew boots; D got hand fixes (legs removed, face swatches) then she asked to regenerate.
- Round 3 (2 cr: G 96f33908 / H 3ae89357) "wooden peg doll, nutcracker x kokeshi, NO legs" → her pick G.
- PixelLab character `3ee5b78a-a505-4259-b8f1-02d957fc4cbf` "puefaotung v1 (rotate)" (1 cr). Eat v3 custom group 66af71b4 (1 cr). **Total 10 cr.**
