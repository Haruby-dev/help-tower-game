# Till (hoe) animation replaced (2026-11-02 night)

User feedback: the old till looked like a sickle from the front and used one hand from the side. New files replace `public/assets/farm/anims/till_{south,east,north}.png` (same format: 9 frames of 88×88 in a row; frame 0 = rest pose; west = mirrored east).
- south / north: new two-handed hoe swing (PixelLab, 3 credits). **South: play frames 3–8 only** in the loop (frames 1–2 have no hoe yet).
- east: posed with a custom skeleton so both hands hold the handle in front (3 credits): raise over the head, hold, chop into the ground, pull back. Frames 1–8 all usable. The frame already shows a few dirt clods at the hit; keep the dirt-puff effect light on that frame.
- Feet are aligned to the old frames, so no offset change is needed.
Previews: docs/level/2026-11-02/till_compare.gif, east_skel.gif.
