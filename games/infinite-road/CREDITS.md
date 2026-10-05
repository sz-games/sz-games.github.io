# Credits

## Player car

- Files: `models/race.glb` and `models/Textures/colormap.png`
- Pack: Kenney Car Kit, version 3.1
- Pack page: <https://kenney.nl/assets/car-kit>
- Download URL: <https://kenney.nl/media/pages/assets/car-kit/1a312ec241-1775131960/kenney_car-kit.zip>
- Retrieved: 2026-10-05
- Author: Kenney, <https://www.kenney.nl>
- Licence: Creative Commons Zero 1.0 (CC0), <https://creativecommons.org/publicdomain/zero/1.0/>
- Changes: none to the files. The game rotates the model 180 degrees and scales it in code.

The pack licence file says: "License: (Creative Commons Zero, CC0). You can use
this content for personal, educational, and commercial purposes."

## Libraries

These files live in `vendor/`:

| File | Library | Version | Licence |
| --- | --- | --- | --- |
| `vendor/three.min.js` | three.js | r128 | MIT, <https://github.com/mrdoob/three.js> |
| `vendor/GLTFLoader.js` | three.js GLTFLoader | r128 | MIT, part of three.js |
| `vendor/tweakpane.min.js` | Tweakpane | 3.1.0 | MIT, <https://github.com/cocopon/tweakpane> |

The game loads `vendor/tweakpane.min.js` only when the URL has `?debug=1`.
All other pages do not request the file.
