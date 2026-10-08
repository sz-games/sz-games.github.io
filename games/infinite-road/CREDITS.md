# Credits

## Player car

- Files: `models/race.glb` and `models/Textures/colormap.png`
- Pack: Kenney Car Kit, version 3.1
- Pack page: <https://kenney.nl/assets/car-kit>
- Download URL: <https://kenney.nl/media/pages/assets/car-kit/1a312ec241-1775131960/kenney_car-kit.zip>
- Retrieved: 2026-10-05
- Author: Kenney, <https://www.kenney.nl>
- Licence: Creative Commons Zero 1.0 (CC0), <https://creativecommons.org/publicdomain/zero/1.0/>
- Changes: the game scales the model to 1.3, turns it to face the driving
  direction, drives each wheel from the physics, and uses only the meshes and
  the colormap from the pack.

The pack licence file says: "License: (Creative Commons Zero, CC0). You can use
this content for personal, educational, and commercial purposes."

## Libraries

These files live in `vendor/`. Everything is local: the game never asks a CDN
for anything, and the smoke test fails if it does.

| File | Library | Version | Licence |
| `vendor/three/three.module.min.js` | three.js (ES module build) | r160 | MIT, <https://github.com/mrdoob/three.js> |
| `vendor/three/addons/loaders/GLTFLoader.js` | three.js GLTFLoader | r160 | MIT, part of three.js |
| `vendor/three/addons/utils/BufferGeometryUtils.js` | three.js BufferGeometryUtils | r160 | MIT, part of three.js |
| `vendor/cannon-es/cannon-es.js` | cannon-es | 0.20.0 | MIT, <https://github.com/pmndrs/cannon-es> |
| `vendor/tweakpane.min.js` | Tweakpane | 3.1.0 | MIT, <https://github.com/cocopon/tweakpane> |

Source packages, retrieved 2026-10-05 from the npm registry:

- `three@0.160.1` (`build/three.module.min.js`, `examples/jsm/loaders/GLTFLoader.js`,
  `examples/jsm/utils/BufferGeometryUtils.js`). The `LICENSE` file from the
  package is kept at `vendor/three/LICENSE`.
- `cannon-es@0.20.0` (`dist/cannon-es.js`). The `LICENSE` file from the
  package is kept at `vendor/cannon-es/LICENSE`.

`three.module.min.js` is loaded through the import map in `drive.html`, so the
game code can `import * as THREE from 'three'` without a bundler.

The game loads `vendor/tweakpane.min.js` only when the URL has `?debug=1`.
All other pages do not request the file.

## Everything else

- Road, terrain, sky, trees, bushes, rocks, road posts and signs, rain, skid
  marks, dust, coins, engine note, wind, skid and rain sound are generated in
  code. No textures, no audio files and no models ship besides the car above.