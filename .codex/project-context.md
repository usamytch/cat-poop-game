# Codex Project Context

This note is working memory for future Codex sessions in this repo.
It does not replace README.md, ARCHITECTURE.md, or AGENTS.md.

## Mandatory First Steps

1. Always read README.md before any task.
2. Read ARCHITECTURE.md when touching mechanics, AI, rendering, tests, or balance.
3. Read only task-relevant source files after that.
4. Use git-aware file operations for added, removed, or renamed files:
   - new files: create, then `git add path`
   - deleted files: `git rm path`
   - renamed/moved files: `git mv old new`
5. Preserve Vanilla JS, Canvas 2D, Web Audio API, localStorage, and deterministic LCG generation.

## Project Shape

Cat Poop Game is a browser arcade game:
- The cat must reach the litter tray before urgency reaches 100%.
- The owner chases the cat and can catch it.
- Poop shots can slow pressure and hit the owner.
- Three consecutive hits trigger combo and owner flee.
- Bonuses alter speed, owner behavior, urgency, lives, or catnip behavior.

Runtime is deliberately simple:
- No runtime frameworks.
- Game modules are loaded through index.html.
- Global objects and functions are an intentional style choice.
- Tests run with Vitest and mocked browser APIs.

## Core Module Map

- `js/config.js`: constants only; WORLD, DIFF, GRID, bonus/catalog data.
- `js/utils.js`: RNG, geometry, collision, drawing helpers, font/cache helpers.
- `js/audio.js` and `js/melody-data.js`: procedural Web Audio and melody data.
- `js/particles.js`: confetti, puddles, combo popups, emoji cache.
- `js/bonuses.js`: bonus pickup, effects, timers.
- `js/pathfinding.js`: MinHeap and A*.
- `js/level.js`: grid, deterministic level generation, moving obstacles, basement.
- `js/player.js`: cat movement, urgency, litter tray, panic.
- `js/owner.js`: owner AI, grid-node navigation, flee, hesitation, catnip.
- `js/projectiles.js`: poop shots, movement, hits, combo.
- `js/renderer-bg.js`: cached/offscreen background and static scenery.
- `js/renderer-hud.js`: HUD, start screen, overlays, tray.
- `js/renderer.js`: main draw orchestrator and debug steering flag.
- `js/touch.js`: mobile controls.
- `js/game.js`: canvas init, state, input, main loop.

## Gameplay Invariants

- Urgency grows every frame as `urgeRate / 60 * (1 + (level - 1) * 0.08)`, capped around x1.8.
- Panic starts when `player.urge / player.maxUrge > 0.75`.
- Accident happens when `player.urge >= player.maxUrge`.
- Combo happens after 3 consecutive owner hits and calls `owner.flee()`.
- `hitUrgeReduce` must stay lower than the urgency gained over the firing cooldown, so shooting cannot solve urgency by itself.
- Easy, normal, and chaos should differ mostly by pressure, owner speed, first owner level, hesitation, and player breathing room.

## Owner Navigation Invariants

Current architecture favors one grid-node movement engine for all levels:
- AI plans in cells with A*.
- Rendering uses pixel interpolation between adjacent nodes.
- `moveProgress` is monotonic from 0 to 1.
- `currentNode` and `nextNode` must not be the same node.
- `nextNode` should be adjacent to `currentNode`.
- Repath should happen at nodes or very early in a segment to avoid visual teleporting.
- `lastRepathGoalCell` is the last goal used for replanning, not merely the current player cell.
- Repath hysteresis uses Chebyshev distance via `DIFF[difficulty].repathMinDist`.
- `plannedGoalStillClose` prevents needless replans when the current path still ends near the player.
- No path smoothing: adjacent-node paths preserve movement invariants.

Historical warning from plans:
- Continuous steering, wall sliding, thresholds, and path smoothing caused freezes or oscillation.
- Do not casually reintroduce steering thresholds, diagonal corridor movement, random unstuck nudges, or line-of-sight path smoothing.

## Basement Notes

- Basement appears from level 9; Shift+B is a cheat shortcut.
- Corridor mode and DFS maze mode need guaranteed reachability.
- Owner and cat are both 36x36; GRID is 40, so both fit through 1-cell gaps.
- A* uses the real owner footprint.
- `_ensureBasementReachable()` removes decorative blockers if they obstruct the route.
- DFS blocked columns and owner spawn spiral search are part of maze safety.

## Test Orientation

Use tests according to blast radius:
- `npm test` for broad confidence.
- `tests/owner-grid.test.js` for owner movement, repath, grid-node regressions.
- `tests/owner.test.js` for owner behavior, activation, flee, catnip, speed caps.
- `tests/level.test.js` and `tests/grid.test.js` for generation/pathfinding.
- Integration tests cover combo, urgency, and level progression.

plans/test-plan.md is the remaining active planning checklist; ARCHITECTURE.md has the current module and test map.

## Growth Areas To Discuss

- Documentation drift should be guarded: README, AGENTS, ARCHITECTURE, config, and tests should agree on difficulty and bonus facts.
- Historical navigation plans were removed after grid-node unification; ARCHITECTURE.md is the source of truth for owner movement.
- The game has strong regression coverage, but visual/play-feel checks still need lightweight repeatable QA.
- Owner navigation is the architectural heart; changes there deserve small diffs and targeted tests.
- The project has charming scope control: keep runtime dependency-free unless a tool is test-only and justified.
