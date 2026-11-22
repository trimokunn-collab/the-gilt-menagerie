# Dossier — The Gilt Menagerie

**Bounty:** make.fun, "Make the best heist game"
(`best-heist-game-20261122-0559`, $50 across 10 places).
**Entry:** *The Gilt Menagerie* — an original top-down stealth heist
game that plays offline in a desktop browser from static files.
**License:** MIT (see `LICENSE`). Every name, picture and sound in the
game is its own: drawn with canvas calls and synthesised with
WebAudio, in code, for this entry.

## The job

A private collector keeps a menagerie of jewelled animals behind
glass: a sapphire cat, an emerald serpent, a pearl kraken, and — deep
in the vault — the Star Crown. Tonight the museum is dark, the guards
are on their rounds, and the cameras are awake. You are the thief.

Lift at least **$40,000** of treasure and slip out the south door.
The door stays locked until your bag holds the goal; the Crown alone
is worth the whole $40,000, if you dare the vault. Every guard lantern
and camera eye that catches you fills one shared **alarm meter**;
when it fills, the night is over.

## How to play

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Hold Shift | Sneak — slower, and eyes fill the alarm at less than half rate |
| Walk onto a treasure | Steal it |
| R | Restart the night |
| M or the Sound button | Toggle sound |

The whole museum is on screen at once — six rooms in a single frame —
so the game is about reading patrols: watch a lantern cone sweep a
gallery, wait for a camera to blink away, then cross. Walls, cabinets
and display cases all block sight, so the furniture is cover, not
decoration. Treasure glows gilt so the route can be planned at a
glance.

Scoring rewards nerve and patience: the fence value of everything in
the bag, plus a time bonus that melts as the night wears on, plus a
$15,000 **ghost bonus** for never being spotted at all, minus $750 for
every time an eye lands on you. Win once and the next run is harder:
the guards walk — and the alarm fills — a little faster every time.

## The floor

One hand-designed floor, 30 × 25 tiles, six named rooms: Gallery
West, the Atrium and Gallery East across the top; a second row of
galleries beneath them; then the Vault Antechamber, the Vault, and
the Entrance Hall with the exit door.

- **5 guards**, each on a fixed patrol with pauses: the Atrium keeper,
  the west and east gallery beats, an entrance-hall guard, and a slow
  vault guard who never strays far from the Crown.
- **3 cameras** on wall mounts, each sweeping its cone back and forth
  on its own rhythm, covering the Atrium door, the east corridor and
  the antechamber door.
- **12 treasures**, $9,000–$18,000 each on the galleries, richer in the
  vault, and the $40,000 Star Crown on its plinth — $190,000 in all,
  against a $40,000 goal, so there are many routes to a winning bag:
  a gallery sweep, a vault raid, or anything between.

## Under the floorboards (how it is built)

- **`game/index.html`** — the page: header HUD (take, goal, the alarm
  meter, timer, spotted counter), the objective line, the canvas, and
  the start / caught / getaway cards.
- **`game/game.js`** — the engine. Movement is circle-versus-tile-grid
  with axis-separated sliding. Sight is honest: a vision cone is only
  real where a sampled line of sight reaches, so a thief behind a
  display case is genuinely hidden, and the drawn cones are clipped by
  the same walls (ray-marched fans), so what you see is exactly what
  the guards see. Detection strength grows as you get closer to an
  eye; one alarm meter is shared by every eye. Guards patrol
  waypoint loops with smooth turns and pauses; cameras sweep on sine
  curves. Rendering is all canvas: checkerboard marble, walnut
  cabinets, glass cases with a drawn glint, five kinds of treasure, a
  lantern glow per guard, and a red pulse at the screen's edge while
  the alarm runs hot.
- **`game/levels.js`** — the floor as tile rows plus the placed loot,
  guards, cameras and room labels. One source of truth: `main.ts`
  reads it too, so the run manifest always describes the level the
  browser plays.
- **`game/audio.js`** — a small WebAudio synth: a glassy ping for a
  lifted treasure, a chirp when an eye first lands on you, the klaxon
  when the alarm fills, the door sighing open, a getaway arpeggio. No
  audio files, no samples, nothing fetched.
- **`main.ts`** — the make.fun entrypoint. In the grader's sandbox it
  verifies the entry is whole (the vendored platform file, the game,
  3–4 screenshots, this dossier), inventories the level from
  `game/levels.js`, and writes a deterministic `manifest.json` and a
  copy of this dossier to the output directory. It reads no clock and
  uses no randomness, so two runs produce byte-identical output.
- **`vendor/makefun-game.ts`** — the platform file from the bounty
  kit, copied unchanged, as the brief requires.

No build step, no dependencies, no network requests: open
`game/index.html` and play.

## The screenshots

Under `screenshots/` — real renders of this game's own code, taken in
a desktop browser:

1. `1-start.jpg` — the title/start card over the dark museum floor.
2. `2-play.jpg` — live play mid-crossing: the thief, a guard's vision
   cone, a camera cone, a loot target and the alarm meter, all in one
   frame.
3. `3-end.jpg` — the getaway/win card after a successful escape.

Every element the brief asks to see in one frame — a room the thief is
crossing, guards with vision cones, cameras, a loot target and an
alarm meter — is visible in `2-play.jpg`.
