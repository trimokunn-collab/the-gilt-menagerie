// The Gilt Menagerie — a one-night museum heist.
// Level data: one hand-designed floor, drawn as rows of tiles.
//
// Tile legend:
//   #  wall            .  floor           D  doorway (open floor)
//   F  furniture       C  display case    (both block movement AND sight)
//   X  exit door       V  vault floor (the Crown's plinth stands here)
//   P  player start    (floor underneath)
// Loot, guards and cameras are placed by coordinates below the map.
"use strict";

const TILE = 48;               // pixels per tile
const MAP_ROWS = [
  "##############################",
  "#........#........#..........#",
  "#..C..C..#...C....#...C......#",
  "#........D........D.......C..#",
  "#........#...F....#..........#",
  "#..F.....#........#....F.....#",
  "#........#........#..........#",
  "########.####.##########.#####",
  "#........#........#..........#",
  "#...C....#...C....#....C.....#",
  "#........D........#..........#",
  "#..F.....#...F....D.....F....#",
  "#........#........#..........#",
  "#####.########.###############",
  "#........#...................#",
  "#...C....#..........F........#",
  "#........D..........C........#",
  "#............................#",
  "#.......V...........C........#",
  "##############################",
  "#............................#",
  "#....F......P...........F....#",
  "#............................#",
  "#.............XX.............#",
  "##############################",
];

// Room names, painted on the floor by the renderer. x/y are tile coords.
const ROOM_LABELS = [
  { x: 4.5,  y: 0.6,  text: "GALLERY WEST" },
  { x: 14.5, y: 0.6,  text: "ATRIUM" },
  { x: 24.5, y: 0.6,  text: "GALLERY EAST" },
  { x: 14.5, y: 13.6, text: "VAULT ANTECHAMBER" },
  { x: 8,    y: 19.6, text: "VAULT" },
  { x: 15,   y: 19.6, text: "ENTRANCE HALL" },
];

// Loot: tile coordinates, display name and fence value in dollars.
// kind picks the drawing: gem, gold, painting, crown, chalice, mask.
const LOOT = [
  { tx: 2,  ty: 2,  name: "Sapphire Cat",        value: 9000,  kind: "gem" },
  { tx: 6,  ty: 2,  name: "Emerald Serpent",     value: 11000, kind: "gem" },
  { tx: 13, ty: 2,  name: "Ivory Astrolabe",     value: 12000, kind: "chalice" },
  { tx: 23, ty: 2,  name: "Onyx Panther",        value: 10000, kind: "gem" },
  { tx: 27, ty: 3,  name: "Gilded Ibis",         value: 13000, kind: "mask" },
  { tx: 4,  ty: 9,  name: "Moon Moth Painting",  value: 15000, kind: "painting" },
  { tx: 13, ty: 9,  name: "Sun Falcon Painting", value: 15000, kind: "painting" },
  { tx: 24, ty: 9,  name: "Pearl Kraken",        value: 14000, kind: "chalice" },
  { tx: 4,  ty: 15, name: "Ruby Scarab",         value: 18000, kind: "gem" },
  { tx: 20, ty: 16, name: "Jade Tortoise",       value: 17000, kind: "mask" },
  { tx: 20, ty: 18, name: "Opal Octopus",        value: 16000, kind: "gem" },
  { tx: 8,  ty: 18, name: "The Star Crown",      value: 40000, kind: "crown" },
];

// Guards patrol between waypoints (tile coords, converted to pixels by
// the engine). speed is pixels/second; pause is seconds spent at each
// waypoint; fov/range describe the vision cone.
const GUARDS = [
  { // Atrium keeper, walks the central hall.
    waypoints: [[13, 5], [17, 5], [17, 1], [13, 1]],
    speed: 52, pause: 0.8, fov: 1.15, range: 205,
  },
  { // West gallery guard, slow north-south beat.
    waypoints: [[2, 1], [2, 11]],
    speed: 42, pause: 1.4, fov: 1.05, range: 185,
  },
  { // East gallery guard, crosses both east rooms.
    waypoints: [[27, 11], [21, 11], [21, 5], [27, 5]],
    speed: 48, pause: 1.0, fov: 1.1, range: 195,
  },
  { // Entrance hall guard, short beat near the door.
    waypoints: [[8, 21], [22, 21]],
    speed: 46, pause: 1.1, fov: 1.1, range: 190,
  },
  { // Vault guard, slow and close to the Crown.
    waypoints: [[12, 21], [12, 18], [5, 18]],
    speed: 38, pause: 1.6, fov: 1.2, range: 175,
  },
];

// Cameras sit on wall tiles and sweep a cone back and forth.
// base/sweep are angles in radians (0 = east, positive = clockwise,
// y-axis down); speed is radians/second.
const CAMERAS = [
  { tx: 10, ty: 0,  base: 1.05, sweep: 0.85, speed: 0.55, range: 215, fov: 0.62 },
  { tx: 25, ty: 7,  base: 2.2,  sweep: 0.8,  speed: 0.5,  range: 200, fov: 0.62 },
  { tx: 9,  ty: 13, base: 1.35, sweep: 0.95, speed: 0.62, range: 210, fov: 0.62 },
];

// The take needed before the exit door will open, in dollars.
const TARGET_TAKE = 40000;

