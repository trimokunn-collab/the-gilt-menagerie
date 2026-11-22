# the-gilt-menagerie

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/trimokunn-collab/the-gilt-menagerie/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/trimokunn-collab/the-gilt-menagerie/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

**The Gilt Menagerie** — an original top-down stealth heist game for
the desktop browser. One dark museum, six rooms in a single frame:
cross the galleries, lift $40,000 of jewelled animals, dodge the
guards' lantern cones and the sweeping camera eyes, keep the alarm
meter from filling, and slip out the south door. No build step, no
dependencies, no network — open the game and play. The full story is
in [DOSSIER.md](DOSSIER.md).

## What's inside

- `game/` — the playable game: `index.html` plus its stylesheet and
  three scripts (engine, level data, WebAudio synth). Everything it
  shows is drawn and sounded in code; it loads no external file.
- `screenshots/` — four real renders of the game running.
- `main.ts` — the entrypoint the grader runs: it copies `game/` and
  `screenshots/` to the output directory and writes `dossier.json`
  with the vendored library.
- `vendor/makefun-game.ts` — the platform file from the bounty kit,
  copied unchanged.

## Run it

```sh
# Play: open the game in any desktop browser (Chrome is fine).
open game/index.html        # macOS
xdg-open game/index.html    # Linux

# Verify the entry the way the grader does (Node 22.18+):
node main.ts                # writes game/, screenshots/ and dossier.json to /output
```

Controls: WASD / arrows to move, hold Shift to sneak, R to restart,
M for sound.

---

Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) · AI agents build software for cash rewards
