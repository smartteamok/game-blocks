import type {
  AppDefinition,
  AppRenderContext,
  ConstraintResult,
  LevelInfo,
  RuntimeAdapter
} from "../types";
import { levels, type Direction, type MazeLevel } from "./levels";

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

const GAME_COLOR = "#4C97FF";
const GAME_ICON_SIZE = 42;
const CELL = 48;
const PADDING = 12;

const ICON_MOVE = "/game-icons/move-right.svg";
const ICON_BACK = "/game-icons/move-left.svg";
const ICON_TURN_LEFT = "/game-icons/turn-left.svg";
const ICON_TURN_RIGHT = "/game-icons/turn-right.svg";
const WAIT_ICON = "/vendor/scratch-blocks/media/icons/control_wait.svg";
const REPEAT_ICON = "/vendor/scratch-blocks/media/icons/control_repeat.svg";

const DIR_ORDER: Direction[] = ["N", "E", "S", "W"];
const DIR_DELTAS: Record<Direction, { x: number; y: number }> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 }
};

let ui: MazeUI | null = null;

const getLevel = (levelId: number): MazeLevel =>
  levels.find((level) => level.id === levelId) ?? levels[0];

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
  if (state.message) {
    return state.message;
  }
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
  label.htmlFor = "maze-level-select";
  const select = document.createElement("select");
  select.id = "maze-level-select";
  select.className = "maze-level-select";
  for (const level of levels) {
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
  if (!canvasCtx) {
    throw new Error("No se pudo crear el canvas del laberinto.");
  }

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
  if (!ui) {
    return;
  }
  const level = getLevel(state.levelId);
  const width = level.gridW * CELL + PADDING * 2;
  const height = level.gridH * CELL + PADDING * 2;
  if (ui.canvas.width !== width || ui.canvas.height !== height) {
    ui.canvas.width = width;
    ui.canvas.height = height;
  }

  const ctx = ui.ctx;
  ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ui.canvas.width, ui.canvas.height);

  ctx.strokeStyle = "#e0e0e0";
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

  ctx.fillStyle = "#3b3b3b";
  for (const wall of level.walls) {
    ctx.fillRect(
      PADDING + wall.x * CELL + 4,
      PADDING + wall.y * CELL + 4,
      CELL - 8,
      CELL - 8
    );
  }

  ctx.fillStyle = "#4caf50";
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

export const registerMazeLikeBlocks = (Blockly: any) => {
  Blockly.Blocks["game_move"] = {
    init: function () {
      this.appendDummyInput().appendField(
        new Blockly.FieldImage(ICON_MOVE, GAME_ICON_SIZE, GAME_ICON_SIZE, "Mover")
      );
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setInputsInline(true);
      this.setTooltip("Mover hacia adelante");
      this.setColour(GAME_COLOR);
    }
  };

  Blockly.Blocks["game_back"] = {
    init: function () {
      this.appendDummyInput().appendField(
        new Blockly.FieldImage(ICON_BACK, GAME_ICON_SIZE, GAME_ICON_SIZE, "Atrás")
      );
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setInputsInline(true);
      this.setTooltip("Mover hacia atrás");
      this.setColour(GAME_COLOR);
    }
  };

  Blockly.Blocks["game_turn_left"] = {
    init: function () {
      this.appendDummyInput().appendField(
        new Blockly.FieldImage(ICON_TURN_LEFT, GAME_ICON_SIZE, GAME_ICON_SIZE, "Girar izquierda")
      );
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setInputsInline(true);
      this.setTooltip("Girar a la izquierda");
      this.setColour(GAME_COLOR);
    }
  };

  Blockly.Blocks["game_turn_right"] = {
    init: function () {
      this.appendDummyInput().appendField(
        new Blockly.FieldImage(ICON_TURN_RIGHT, GAME_ICON_SIZE, GAME_ICON_SIZE, "Girar derecha")
      );
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setInputsInline(true);
      this.setTooltip("Girar a la derecha");
      this.setColour(GAME_COLOR);
    }
  };

  Blockly.Blocks["game_repeat"] = {
    init: function () {
      this.appendStatementInput("SUBSTACK");
      this.appendDummyInput()
        .appendField(new Blockly.FieldImage(REPEAT_ICON, GAME_ICON_SIZE, GAME_ICON_SIZE, "Repetir"))
        .appendField(new Blockly.FieldNumber(4, 1, 20, 1), "TIMES");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setInputsInline(true);
      this.setTooltip("Repetir varias veces");
      this.setColour(Blockly.Colours?.control?.primary ?? "#FFAB19");
    }
  };

  Blockly.Blocks["game_wait"] = {
    init: function () {
      this.appendDummyInput()
        .appendField(new Blockly.FieldImage(WAIT_ICON, GAME_ICON_SIZE, GAME_ICON_SIZE, "Esperar"))
        .appendField(new Blockly.FieldNumber(500, 50, 5000, 50), "MS");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setInputsInline(true);
      this.setTooltip("Esperar milisegundos");
      this.setColour(Blockly.Colours?.control?.primary ?? "#FFAB19");
    }
  };
};

export const MAZE_LIKE_TOOLBOX_XML = `
<xml>
  <category name="Control">
    <block type="game_repeat"></block>
    <block type="game_wait"></block>
  </category>
  <category name="Game">
    <block type="game_move"></block>
    <block type="game_back"></block>
    <block type="game_turn_left"></block>
    <block type="game_turn_right"></block>
  </category>
</xml>
`;

const adapter: RuntimeAdapter<MazeState> = {
  applyOp: (op, state) => {
    const level = getLevel(state.levelId);
    if (state.status === "win" || state.status === "error") {
      return state;
    }

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

    if (op.kind === "wait") {
      return state;
    }

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

const checkConstraints = (workspace: unknown, state: MazeState): ConstraintResult => {
  const level = getLevel(state.levelId);
  const constraints = level.constraints;
  if (!constraints) {
    return { ok: true };
  }
  const workspaceBlocks = (workspace as { getAllBlocks?: (ordered: boolean) => { type: string }[] })
    .getAllBlocks?.(false) ?? [];
  const blockTypes = workspaceBlocks
    .map((block) => block.type)
    .filter(
      (type) =>
        !type.startsWith("dropdown_") &&
        !type.startsWith("math_") &&
        type !== "event_whenflagclicked"
    );
  if (constraints.maxBlocks !== undefined && blockTypes.length > constraints.maxBlocks) {
    return { ok: false, message: `Usá máximo ${constraints.maxBlocks} bloques.` };
  }
  if (constraints.mustUseRepeat) {
    const hasRepeat = blockTypes.some((type) => type === "game_repeat");
    if (!hasRepeat) {
      return { ok: false, message: "Tenés que usar un bloque de repetir." };
    }
  }
  return { ok: true };
};

const levelInfos: LevelInfo[] = levels.map((l) => ({ id: l.id, title: l.title }));

export const mazeApp: AppDefinition<MazeState> = {
  id: "maze",
  title: "Laberinto",
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
  checkConstraints,
  serializeState: (state) => ({
    levelId: state.levelId,
    player: state.player,
    status: state.status,
    message: state.message
  }),
  deserializeState: (raw) => {
    if (!raw || typeof raw !== "object") {
      return makeInitialState(1);
    }
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
