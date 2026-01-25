import type {
  AppDefinition,
  AppRenderContext,
  LevelInfo,
  RuntimeAdapter
} from "../types";
import { MAZE_LIKE_TOOLBOX_XML, registerMazeLikeBlocks } from "../maze/mazeApp";
import type { Direction, MazeLevel } from "../maze/levels";
import { practiceLevels } from "./levels";

type MazeStatus = "idle" | "running" | "win" | "error";

type MazeState = {
  levelId: number;
  player: { x: number; y: number; dir: Direction };
  status: MazeStatus;
  message?: string;
};

type MazeUI = {
  rootEl: HTMLElement;
  container: HTMLElement;
  selectEl: HTMLSelectElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  statusEl: HTMLDivElement;
};

const GAME_COLOR = "#9B59B6";
const CELL = 48;
const PADDING = 12;

const DIR_ORDER: Direction[] = ["N", "E", "S", "W"];
const DIR_DELTAS: Record<Direction, { x: number; y: number }> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 }
};

let ui: MazeUI | null = null;

const getLevel = (levelId: number): MazeLevel =>
  practiceLevels.find((level) => level.id === levelId) ?? practiceLevels[0];

const makeInitialState = (levelId: number): MazeState => {
  const level = getLevel(levelId);
  return {
    levelId: level.id,
    player: { ...level.start },
    status: "idle",
    message: undefined
  };
};

const turnLeft = (dir: Direction): Direction => {
  const index = DIR_ORDER.indexOf(dir);
  return DIR_ORDER[(index + 3) % DIR_ORDER.length];
};

const turnRight = (dir: Direction): Direction => {
  const index = DIR_ORDER.indexOf(dir);
  return DIR_ORDER[(index + 1) % DIR_ORDER.length];
};

const isBlocked = (level: MazeLevel, x: number, y: number): boolean =>
  level.walls.some((wall) => wall.x === x && wall.y === y);

const inBounds = (level: MazeLevel, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < level.gridW && y < level.gridH;

const updateStatusText = (state: MazeState): string => {
  if (state.message) return state.message;
  switch (state.status) {
    case "running":
      return "Jugando...";
    case "win":
      return "¡Llegaste!";
    case "error":
      return "¡Choque!";
    default:
      return "Listo.";
  }
};

const ensureUI = (rootEl: HTMLElement, ctx: AppRenderContext<MazeState>): MazeUI => {
  if (ui && ui.rootEl === rootEl && rootEl.contains(ui.container)) {
    return ui;
  }
  rootEl.innerHTML = "";

  const container = document.createElement("div");
  container.className = "maze-stage";

  const header = document.createElement("div");
  header.className = "maze-header";
  const label = document.createElement("label");
  label.textContent = "Nivel";
  label.htmlFor = "practice-level-select";
  const select = document.createElement("select");
  select.id = "practice-level-select";
  select.className = "maze-level-select";
  for (const level of practiceLevels) {
    const option = document.createElement("option");
    option.value = String(level.id);
    option.textContent = `${level.id}. ${level.title}`;
    select.appendChild(option);
  }
  header.appendChild(label);
  header.appendChild(select);

  const canvas = document.createElement("canvas");
  canvas.className = "maze-canvas";
  const canvasCtx = canvas.getContext("2d");
  if (!canvasCtx) throw new Error("No se pudo crear el canvas.");

  const statusEl = document.createElement("div");
  statusEl.className = "maze-status";

  container.appendChild(header);
  container.appendChild(canvas);
  container.appendChild(statusEl);
  rootEl.appendChild(container);

  select.addEventListener("change", () => {
    const nextId = Number(select.value);
    const nextState = makeInitialState(nextId);
    ctx.updateState(nextState);
    ctx.setStatus(`Nivel ${nextState.levelId} listo`);
  });

  ui = { rootEl, container, selectEl: select, canvas, ctx: canvasCtx, statusEl };
  return ui;
};

const drawMaze = (state: MazeState): void => {
  if (!ui) return;
  const level = getLevel(state.levelId);
  const width = level.gridW * CELL + PADDING * 2;
  const height = level.gridH * CELL + PADDING * 2;
  if (ui.canvas.width !== width || ui.canvas.height !== height) {
    ui.canvas.width = width;
    ui.canvas.height = height;
  }

  const ctx = ui.ctx;
  ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
  ctx.fillStyle = "#faf5ff";
  ctx.fillRect(0, 0, ui.canvas.width, ui.canvas.height);

  ctx.strokeStyle = "#e9d5ff";
  ctx.lineWidth = 1;
  for (let x = 0; x <= level.gridW; x += 1) {
    const xPos = PADDING + x * CELL;
    ctx.beginPath();
    ctx.moveTo(xPos, PADDING);
    ctx.lineTo(xPos, PADDING + level.gridH * CELL);
    ctx.stroke();
  }
  for (let y = 0; y <= level.gridH; y += 1) {
    const yPos = PADDING + y * CELL;
    ctx.beginPath();
    ctx.moveTo(PADDING, yPos);
    ctx.lineTo(PADDING + level.gridW * CELL, yPos);
    ctx.stroke();
  }

  ctx.fillStyle = "#7c3aed";
  for (const wall of level.walls) {
    ctx.fillRect(
      PADDING + wall.x * CELL + 4,
      PADDING + wall.y * CELL + 4,
      CELL - 8,
      CELL - 8
    );
  }

  ctx.fillStyle = "#10b981";
  ctx.beginPath();
  ctx.arc(
    PADDING + level.goal.x * CELL + CELL / 2,
    PADDING + level.goal.y * CELL + CELL / 2,
    CELL * 0.25,
    0,
    Math.PI * 2
  );
  ctx.fill();

  const playerX = PADDING + state.player.x * CELL + CELL / 2;
  const playerY = PADDING + state.player.y * CELL + CELL / 2;
  const size = CELL * 0.28;
  ctx.fillStyle = GAME_COLOR;
  ctx.beginPath();
  if (state.player.dir === "N") {
    ctx.moveTo(playerX, playerY - size);
    ctx.lineTo(playerX - size, playerY + size);
    ctx.lineTo(playerX + size, playerY + size);
  } else if (state.player.dir === "S") {
    ctx.moveTo(playerX, playerY + size);
    ctx.lineTo(playerX - size, playerY - size);
    ctx.lineTo(playerX + size, playerY - size);
  } else if (state.player.dir === "E") {
    ctx.moveTo(playerX + size, playerY);
    ctx.lineTo(playerX - size, playerY - size);
    ctx.lineTo(playerX - size, playerY + size);
  } else {
    ctx.moveTo(playerX - size, playerY);
    ctx.lineTo(playerX + size, playerY - size);
    ctx.lineTo(playerX + size, playerY + size);
  }
  ctx.closePath();
  ctx.fill();

  ui.statusEl.textContent = updateStatusText(state);
};

const adapter: RuntimeAdapter<MazeState> = {
  applyOp: (op, state) => {
    const level = getLevel(state.levelId);
    if (state.status === "win" || state.status === "error") return state;

    if (op.kind === "turn") {
      state.player.dir = op.direction === "left" ? turnLeft(state.player.dir) : turnRight(state.player.dir);
      drawMaze(state);
      return state;
    }

    if (op.kind === "move") {
      const delta = DIR_DELTAS[state.player.dir];
      const steps = Math.abs(op.steps);
      const sign = op.steps >= 0 ? 1 : -1;
      for (let i = 0; i < steps; i += 1) {
        const nextX = state.player.x + delta.x * sign;
        const nextY = state.player.y + delta.y * sign;
        if (!inBounds(level, nextX, nextY) || isBlocked(level, nextX, nextY)) {
          state.status = "error";
          state.message = "¡Choque!";
          drawMaze(state);
          throw new Error("CHOQUE");
        }
        state.player.x = nextX;
        state.player.y = nextY;
        if (state.player.x === level.goal.x && state.player.y === level.goal.y) {
          state.status = "win";
          state.message = "¡Llegaste!";
          drawMaze(state);
          throw new Error("WIN");
        }
      }
      drawMaze(state);
      return state;
    }

    if (op.kind === "wait") return state;
    return state;
  },
  reset: (state) => {
    const next = makeInitialState(state.levelId);
    state.levelId = next.levelId;
    state.player = { ...next.player };
    state.status = next.status;
    state.message = next.message;
    drawMaze(state);
    return state;
  }
};

const levelInfos: LevelInfo[] = practiceLevels.map((l) => ({ id: l.id, title: l.title }));

export const practiceApp: AppDefinition<MazeState> = {
  id: "practice",
  title: "Práctica",
  levels: levelInfos,
  toolboxXml: MAZE_LIKE_TOOLBOX_XML,
  registerBlocks: registerMazeLikeBlocks,
  createInitialState: () => makeInitialState(1),
  render: (rootEl, state, ctx) => {
    const level = getLevel(state.levelId);
    if (level.id !== state.levelId) {
      ctx.updateState(makeInitialState(level.id));
      return;
    }
    const currentUi = ensureUI(rootEl, ctx);
    currentUi.selectEl.value = String(level.id);
    drawMaze(state);
  },
  adapter,
  compileOptions: {
    START_TYPES: ["event_whenflagclicked"],
    MOVE_TYPES: ["game_move"],
    BACK_TYPES: ["game_back"],
    TURN_LEFT_TYPES: ["game_turn_left"],
    TURN_RIGHT_TYPES: ["game_turn_right"],
    REPEAT_TYPES: ["game_repeat"],
    WAIT_TYPES: ["game_wait"]
  },
  serializeState: (state) => ({
    levelId: state.levelId,
    player: state.player,
    status: state.status,
    message: state.message
  }),
  deserializeState: (raw) => {
    if (!raw || typeof raw !== "object") return makeInitialState(1);
    const record = raw as Partial<MazeState>;
    const level = getLevel(record.levelId ?? 1);
    const state = makeInitialState(level.id);
    if (record.player && typeof record.player.x === "number" && typeof record.player.y === "number") {
      state.player.x = record.player.x;
      state.player.y = record.player.y;
      if (record.player.dir && DIR_ORDER.includes(record.player.dir)) {
        state.player.dir = record.player.dir;
      }
    }
    state.status = "idle";
    state.message = record.message;
    return state;
  }
};
