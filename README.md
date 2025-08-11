## Object Life Sim (p5.js)

An autonomous life simulation where simple agents wander, work, eat, and reproduce across a minimal world. The piece emphasizes readable, soft visuals (halos, trails, particles) and clear feedback with a lightweight UI and performance-friendly architecture.

### Features
- Status-driven agents with simple needs and behaviors: doodle, eat, work, mate, age, die.
- Start panel with sliders to configure initial counts for objects, foods, and sites, plus a Draw paths toggle.
- Polished UI: gradient background, vignette, cached HUD, tooltip on hover, coherent palette by status.
- Visual effects: soft halos, motion trails, event particles (sparkles, confetti), ring pulses.
- Performance techniques: sprite caches for icons/halos, pooled particles with caps, trails on a faded layer, cached HUD, uniform spatial grid for neighbor queries.
- Game over and results: simulation ends when no Foods and no Sites remain, or when no Objects remain. A results panel shows Score and trend graphs with event markers.

### Quick start
1. Open a local server in the project root (recommended):
   - `npx serve` or `python -m http.server` or any static server.
2. Visit the served URL (do not use `file://`).
3. Adjust sliders on the start panel and press Start.

### Controls and interaction
- O/F/S + click: spawn Object/Food/Site at mouse.
- Hover near an object: see a highlight ring and a small info chip with age and hunger.
- Start panel: sliders for Objects/Foods/Sites and a Draw paths checkbox.
- After game over: press R to toggle the Results panel overlay. In the Results panel, click Hide Panel to view paths, or Back to Start to return to the start panel.

### Files
- `index.html`: loads p5.js and p5.sound, and includes `foods.js`, `sites.js`, `objects.js`, `sketch.js`.
- `style.css`: full-bleed canvas and page resets.
- `sketch.js`: main loop, start panel UI, HUD, effects (particles, ring pulses), background, trails layer, sprite caches, pooled particles, and the spatial grid.
- `objects.js`: `Objects` class and behaviors; eased motion, collision separation, event hooks, path trail drawing using the trails layer and cached sprites.
- `foods.js`: `Foods` class; cached soft halos and emoji icon rendering.
- `sites.js`: `Sites` class; production mechanic and cached halos.

### Simulation overview
- Objects (agents)
  - Need-driven status: doodle → eat/work → mate → doodle; aging and hunger affect life cycle.
  - Movement: eased direction toward target, separation from neighbors, soft rotation aligned to velocity.
  - Reaching targets triggers effects: sparkles on eat, ring pulses at sites, confetti on birth.
  - Optional trails: status-colored segments drawn to a persistent layer and faded via erase blending.
- Foods
  - Carry a utility value, restore hunger, and vanish when reached.
- Sites
  - Accumulate work; on thresholds, spawn new foods. Finite utility unless `siteInfinite` is set.

### Game over and results
- Game-over conditions:
  - When both Foods and Sites reach zero, or
  - When Objects reach zero.
- Results panel (shown on game over):
  - Score: total survival time in seconds.
  - Trend graphs: Objects, Foods, Sites over simulation time.
  - Event markers: ticks at times when you manually spawned O/F/S.
- Controls:
  - Hide Panel: temporarily hide the overlay to inspect paths on canvas.
  - Back to Start: resets the sim and returns to the start panel.

### Start panel configuration
- Objects: initial agent count.
- Foods: initial food count.
- Sites: initial site count.
- Draw paths: enable/disable motion trails.

### Performance/architecture
- Sprite caches: pre-rendered halo and icon sprites per status and size bucket to avoid per-frame text/shadow/stroke.
- Trails layer: offscreen `p5.Graphics` with erase-based fading; draws only short segments per frame.
- Pooled particles: cap of 200 with object reuse to limit allocations and spikes.
- HUD caching: HUD composited from a cached layer, redrawn every few frames.
- Spatial grid: uniform grid (`gridCellSize = 96`) for neighbor queries, reducing O(n^2) scans.

### Customization
- Colors: tweak the `statusColors` palette in `sketch.js`.
- Trail feel: edit `fadeTrailsLayer()` alpha and stroke logic in `objects.js::drawPath()`.
- Particle budget: change `MAX_PARTICLES` in `sketch.js`.
- Grid size: adjust `gridCellSize` in `sketch.js` to match typical object size/speeds.

### Build/run notes
- Requires no build step. Use any static file server to run locally.
- Tested with p5.js 1.10.x. `p5.sound` is loaded for potential future audio-reactive accents but is optional.

### Known toggles and shortcuts
- Start panel provides all runtime toggles currently: Draw paths and the initial counts.
- Spawning keys (O/F/S) work both pre- and post-start.
- After game over: R toggles the Results panel.

### License
This project is intended for educational/creative use. Use and modify freely for coursework and personal projects.

