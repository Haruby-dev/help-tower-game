# 03 — Tools cheat-sheet

## PixelLab (MCP `pixxellab`)
| Task | Tool | Settings / notes |
|---|---|---|
| Item or food icon | `create_image_pixen` | 48×48 or 32×32, `no_background`, `detail="low detail"`, `outline="single color outline"`. Prompt words that work: "cute kawaii … soft pastel colors, gentle shading, few colors, soft dark brown outline … no plate, no background". Make 2 per item (the second with `seed=2024`). |
| Pose or detail change on a sprite | `edit_image_pixen` | `image_base64` small PNG, 1 credit |
| Character directions | `create_character` | `mode=v3`, `reference_image_base64` (south) + `direction_images` for the rest. Supplying all directions = import at 0.25. Quadruped: `body_type=quadruped`, `template=cat`. |
| Animations | `animate_character` | Template (e.g. `idle`) 1 credit per direction. Custom v3 needs `custom_start_frame_base64` for a new pose (a single direction per call). |
| Getting images | `pixelart_workbench join gallery:<asset_id> … --as sheet` or with backblaze URLs | The tool result saves the sheet as a PNG under `/root/.claude/projects/.../tool-results/mcp-pixxellab-blob-*.png` (path printed in the result). Crop the 18px header and key out (31,37,44) in python. Neither the container nor device_bash can curl pixellab (proxy 403). |

## Device (her PC)
| Tool | Use |
|---|---|
| `device_bash` | Python on the device; the project is under `$HOME/mnt/help-tower-game/help-tower-game` |
| `device_stage_files` | Copy device files into `/mnt/user-data/uploads/...` |
| `device_commit_files` | Copy files from `/mnt/user-data/outputs/...` back to the device |
| `krita__run_python` | Build layered `.kra` files (QImage → `setPixelData`) |

## Game preview
- Tar the device's `dist`, stage it, serve it at `/help-tower-game/` with `python -m http.server 8765`, then use playwright `?test` (`window.__state`, `window.__game`).
- npm is unreachable from the container.
