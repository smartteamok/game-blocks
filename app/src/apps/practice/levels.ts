import type { Direction, MazeLevel } from "../maze/levels";

export type { Direction, MazeLevel };

/** Niveles para Práctica: más simples, sin restricciones. */
export const practiceLevels: MazeLevel[] = [
  {
    id: 1,
    title: "Recta",
    gridW: 4,
    gridH: 4,
    walls: [],
    start: { x: 0, y: 1, dir: "E" as Direction },
    goal: { x: 3, y: 1 }
  },
  {
    id: 2,
    title: "Esquina",
    gridW: 4,
    gridH: 4,
    walls: [],
    start: { x: 0, y: 3, dir: "E" as Direction },
    goal: { x: 3, y: 0 }
  },
  {
    id: 3,
    title: "Un muro",
    gridW: 5,
    gridH: 5,
    walls: [{ x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }],
    start: { x: 0, y: 2, dir: "E" as Direction },
    goal: { x: 4, y: 2 }
  },
  {
    id: 4,
    title: "Laberinto simple",
    gridW: 5,
    gridH: 5,
    walls: [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 3, y: 3 },
      { x: 3, y: 4 }
    ],
    start: { x: 0, y: 0, dir: "E" as Direction },
    goal: { x: 4, y: 4 }
  }
];
