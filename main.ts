// The Gilt Menagerie — make.fun entrypoint.
//
// What a run of this program hands in, when the grader runs
// `node /bot/main.ts`:
//
//   - game/         the game itself: "The Gilt Menagerie", an original
//                   top-down stealth heist that plays offline in a
//                   desktop browser from static files. Copied whole.
//   - screenshots/  stills of the game running, copied alongside it.
//   - dossier.json  the dossier the judge reads, built from the
//                   copied output by the platform's own library
//                   (vendor/makefun-game.ts), under the scorer's caps.
//
// The program only copies what the repository holds and writes the
// one file the library builds, so a run is deterministic: it reads
// no clock, uses no randomness and fetches nothing.
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

// `here` is this file's own directory — the repository root, wherever
// the sandbox mounts it. `out` is the writable hand-in directory.
const here = fileURLToPath(new URL(".", import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

// The hand-in directory itself, and the folder the stills land in.
mkdirSync(out, { recursive: true });
mkdirSync(join(out, "screenshots"), { recursive: true });

// The game travels whole: everything under game/ lands in out/game,
// exactly as the repository holds it.
cpSync(join(here, "game"), join(out, "game"), { recursive: true });

// The screenshots travel too, when the repository carries them.
const shots = join(here, "screenshots");
if (existsSync(shots)) {
  cpSync(shots, join(out, "screenshots"), { recursive: true });
}

// Last, the dossier: the vendored library reads the copied output and
// describes it — its text, its screenshots and its game files alike —
// under the caps the scorer dictates. What it returns is the file's
// content, written as out/dossier.json.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, "dossier.json"), dossier, "utf8");

console.log("The Gilt Menagerie: game, screenshots and dossier handed in.");
