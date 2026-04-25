# Cat Poop Game — Plan: Modularisation + Homing Poops + Owner Unstick

## 1. Module Split

### Proposed file structure

```
cat-poop-game/
├── index.html          ← adds <script> tags in order
├── style.css
├── js/
│   ├── config.js       ← constants, WORLD, DIFF, location themes, obstacle catalog
│   ├── utils.js        ← pure helpers: RNG, clamp, rect/circle collision, drawSprite, rrect
│   ├── audio.js        ← Web Audio API: getAC(), tone(), sndMeow/Fart/Hit/…
│   ├── level.js        ← generateObstacle(), placeLitterBox(), generateLevel()
│   ├── entities.js     ← player object, owner object
│   ├── projectiles.js  ← poops array, shootPoop(), updatePoops(), drawPoops()
│   ├── bonuses.js      ← bonuses array, applyBonus(), updateBonuses(), drawBonuses()
│   ├── particles.js    ← overlayParticles, spawnConfetti(), spawnPuddle(), update/draw
│   ├── renderer.js     ← drawBg(), drawObstacle(), drawLitterBox(), drawUI(),
│   │                      drawStartScreen(), drawOverlay(), drawComboPopups()
│   └── game.js         ← game state, stats, keys, startGame(), update(), draw(), gameLoop()
```

### Why this split?

| Module | Responsibility | Depends on |
|---|---|---|
| `config.js` | Pure data — no logic | nothing |
| `utils.js` | Pure functions | nothing |
| `audio.js` | Sound only | nothing |
| `level.js` | Level generation | config, utils |
| `entities.js` | Player + Owner logic | config, utils, audio, level |
| `projectiles.js` | Poop shooting + homing | config, utils, audio, entities |
| `bonuses.js` | Bonus pickup + effects | config, utils, audio, entities |
| `particles.js` | Visual particles | nothing |
| `renderer.js` | All canvas drawing | config, utils, entities, particles |
| `game.js` | Orchestration + loop | everything |

### index.html script loading order

```html
<script src="js/config.js"></script>
<script src="js/utils.js"></script>
<script src="js/audio.js"></script>
<script src="js/level.js"></script>
<script src="js/entities.js"></script>
<script src="js/projectiles.js"></script>
<script src="js/bonuses.js"></script>
<script src="js/particles.js"></script>
<script src="js/renderer.js"></script>
<script src="js/game.js"></script>
```

No bundler needed — plain `<script>` tags share the global scope, which matches the existing architecture.

---

## 2. Homing Poops on Easy and Normal

### Design

On **Easy** and **Normal** difficulty, fired poops gently steer toward the owner.
On **Chaos** they fly straight (current behaviour) — the player must aim manually.

### Algorithm — Soft Homing

Each frame, instead of keeping `dx/dy` fixed, we rotate the velocity vector slightly toward the owner:

```
// pseudocode inside updatePoops()
if (difficulty !== "chaos" && owner.active) {
  const toOwnerX = (owner.x + owner.width/2)  - p.x;
  const toOwnerY = (owner.y + owner.height/2) - p.y;
  const toOwnerLen = Math.sqrt(toOwnerX*toOwnerX + toOwnerY*toOwnerY);
  if (toOwnerLen > 0) {
    const tx = toOwnerX / toOwnerLen;
    const ty = toOwnerY / toOwnerLen;
    const turnRate = difficulty === "easy" ? 0.10 : 0.055;  // radians/frame
    p.dx += (tx * POOP_SPEED - p.dx) * turnRate;
    p.dy += (ty * POOP_SPEED - p.dy) * turnRate;
    // re-normalise to constant speed
    const len = Math.sqrt(p.dx*p.dx + p.dy*p.dy);
    p.dx = p.dx/len * POOP_SPEED;
    p.dy = p.dy/len * POOP_SPEED;
  }
}
```

**Turn rates:**
| Difficulty | `turnRate` | Feel |
|---|---|---|
| Easy | 0.10 | Strong homing — very forgiving |
| Normal | 0.055 | Gentle curve — still requires rough aim |
| Chaos | 0 (off) | Straight shot — skill-based |

### Visual feedback

- On Easy/Normal, draw a faint dotted arc from the poop toward the owner so the player can see the homing is active.
  Implementation: draw 3–4 small semi-transparent 💩 emojis along the predicted path (simple linear interpolation toward owner, no physics needed).

### Where the code lives

All homing logic goes inside `updatePoops()` in **`projectiles.js`**.
It reads `difficulty` (from `config.js` / `game.js`) and `owner` (from `entities.js`).

---

## 3. Owner Obstacle-Sticking Fix

### Root cause

Current [`owner.update()`](game.js:471) moves X and Y independently:

```js
if (!hitsObstacles(nr) && nx>=b.left && nx<=b.right-this.width) this.x=nx;
if (!hitsObstacles(nr) && ny>=b.top  && ny<=b.bottom-this.height) this.y=ny;
```

The collision check uses the **combined** `nr = {x:nx, y:ny, …}` for both axes.
When the owner is blocked diagonally, **both** axes are rejected even if only one is actually blocked — the owner freezes against the obstacle corner.

### Fix — Separate-axis collision (same as player)

```js
const nrX = {x:nx, y:this.y, width:this.width, height:this.height};
const nrY = {x:this.x, y:ny, width:this.width, height:this.height};
if (!hitsObstacles(nrX) && nx>=b.left && nx<=b.right-this.width)  this.x = nx;
if (!hitsObstacles(nrY) && ny>=b.top  && ny<=b.bottom-this.height) this.y = ny;
```

This mirrors how [`player.update()`](game.js:377) already works and lets the owner slide along obstacle edges.

### Steering nudge (secondary fix)

Even with separate-axis collision, the owner can still get stuck in a concave corner.
Add a small random lateral nudge when the owner hasn't moved for N frames:

```js
// in owner object
stuckTimer: 0,
lastX: 0, lastY: 0,

// in update():
const moved = Math.abs(this.x - this.lastX) + Math.abs(this.y - this.lastY);
if (moved < 0.5) {
  this.stuckTimer++;
  if (this.stuckTimer > 30) {          // stuck for 0.5 s
    this.stuckNudge = { x: (Math.random()-0.5)*2, y: (Math.random()-0.5)*2 };
    this.stuckTimer = 0;
  }
} else {
  this.stuckTimer = 0;
  this.stuckNudge = null;
}
this.lastX = this.x; this.lastY = this.y;

// apply nudge to dx/dy before movement:
if (this.stuckNudge) { dx += this.stuckNudge.x; dy += this.stuckNudge.y; }
```

### Where the code lives

All changes go inside the `owner` object in **`entities.js`**.

---

## 4. Implementation Order (for Code mode)

1. **Create `js/` directory and split files** — mechanical extraction, no logic changes.
2. **Update `index.html`** — replace single `<script src="game.js">` with the ordered list above.
3. **Implement separate-axis collision for owner** — one-line change in `entities.js`.
4. **Add stuck-timer nudge to owner** — ~15 lines in `entities.js`.
5. **Add homing logic to `updatePoops()`** — ~15 lines in `projectiles.js`.
6. **Add homing visual hint** — ~10 lines in `drawPoops()` in `renderer.js`.
7. **Update README** — reflect new file structure.

---

## 5. What does NOT change

- Game logic, scoring, difficulty values, level generation — untouched.
- No bundler, no TypeScript, no framework — stays vanilla JS.
- All assets (`cat.png`, `master.png`) stay at root.
