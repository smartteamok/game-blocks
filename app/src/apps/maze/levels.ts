export type Direction = "N" | "E" | "S" | "W";

export type MazeLevel = {
  id: number;
  title: string;
  gridW: number;
  gridH: number;
  walls: Array<{ x: number; y: number }>;
  start: { x: number; y: number; dir: Direction };
  goal: { x: number; y: number };
  constraints?: { maxBlocks?: number; mustUseRepeat?: boolean };
};

export const levels: MazeLevel[] = [
  {
    id: 1,
    title: "Recta",
    gridW: 5,
    gridH: 5,
    walls: [],
    start: { x: 0, y: 2, dir: "E" },
    goal: { x: 4, y: 2 }
  },
  {
    id: 2,
    title: "Un giro",
    gridW: 5,
    gridH: 5,
    walls: [],
    start: { x: 0, y: 4, dir: "E" },
    goal: { x: 4, y: 0 }
  },
  {
    id: 3,
    title: "Dos giros",
    gridW: 5,
    gridH: 5,
    walls: [
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 }
    ],
    start: { x: 0, y: 0, dir: "E" },
    goal: { x: 4, y: 4 }
  },
  {
    id: 4,
    title: "Repetir",
    gridW: 5,
    gridH: 5,
    walls: [],
    start: { x: 0, y: 2, dir: "E" },
    goal: { x: 4, y: 2 },
    constraints: { maxBlocks: 8, mustUseRepeat: true }
  },
  {
    id: 5,
    title: "Muro central",
    gridW: 6,
    gridH: 6,
    walls: [
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 2, y: 4 },
      { x: 2, y: 5 },
      { x: 4, y: 1 },
      { x: 4, y: 2 }
    ],
    start: { x: 0, y: 5, dir: "N" },
    goal: { x: 5, y: 0 }
  },
  {
    id: 6,
    title: "Puente",
    gridW: 6,
    gridH: 6,
    walls: [
      { x: 0, y: 3 },
      { x: 1, y: 3 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 4, y: 3 }
    ],
    start: { x: 1, y: 5, dir: "N" },
    goal: { x: 5, y: 0 },
    constraints: { mustUseRepeat: true }
  },
  {
    id: 7,
    title: "Pasillo",
    gridW: 6,
    gridH: 6,
    walls: [
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 3, y: 5 },
      { x: 1, y: 4 },
      { x: 2, y: 4 }
    ],
    start: { x: 5, y: 5, dir: "W" },
    goal: { x: 0, y: 0 }
  },
  {
    id: 8,
    title: "Zigzag",
    gridW: 6,
    gridH: 6,
    walls: [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 4, y: 3 },
      { x: 1, y: 5 },
      { x: 2, y: 5 },
      { x: 3, y: 5 },
      { x: 4, y: 5 }
    ],
    start: { x: 0, y: 0, dir: "E" },
    goal: { x: 5, y: 4 },
    constraints: { maxBlocks: 14 }
  }
];
