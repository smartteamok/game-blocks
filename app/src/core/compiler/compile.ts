import type { Op, Program } from "./ast";

export type CompileOptions = {
  START_TYPES: string[];
  MOVE_TYPES: string[];
  BACK_TYPES?: string[];
  TURN_LEFT_TYPES: string[];
  TURN_RIGHT_TYPES: string[];
  REPEAT_TYPES: string[];
  WAIT_TYPES: string[];
};

type BlockLike = {
  id: string;
  type: string;
  getNextBlock?: () => BlockLike | null;
  getInputTargetBlock?: (name: string) => BlockLike | null;
  getFieldValue?: (name: string) => string | number | null | undefined;
};

const FALLBACK_NUMBER_KEYS = ["NUM", "N", "VALUE", "TIMES", "DURATION", "STEPS", "SECS", "MS"];

const tryReadNumber = (block: BlockLike | null | undefined, keys: string[]): number | null => {
  if (!block?.getFieldValue) {
    return null;
  }
  for (const key of keys) {
    const raw = block.getFieldValue(key);
    if (raw !== null && raw !== undefined && raw !== "") {
      const value = Number(raw);
      if (!Number.isNaN(value)) {
        return value;
      }
    }
  }
  return null;
};

const readNumberField = (block: BlockLike, keys: string[], fallback: number): number => {
  const direct = tryReadNumber(block, keys);
  if (direct !== null) {
    return direct;
  }
  for (const key of keys) {
    const target = block.getInputTargetBlock?.(key);
    const fromTarget = tryReadNumber(target, FALLBACK_NUMBER_KEYS);
    if (fromTarget !== null) {
      return fromTarget;
    }
  }
  return fallback;
};

// Compiles a horizontal workspace into a simple AST for the selected app.
export const compileWorkspaceToAst = (
  Blockly: unknown,
  workspace: { getTopBlocks: (ordered: boolean) => BlockLike[] },
  opts: CompileOptions
): Program => {
  void Blockly;

  const startTypes = new Set(opts.START_TYPES);
  const moveTypes = new Set(opts.MOVE_TYPES);
  const backTypes = new Set(opts.BACK_TYPES ?? []);
  const turnLeftTypes = new Set(opts.TURN_LEFT_TYPES);
  const turnRightTypes = new Set(opts.TURN_RIGHT_TYPES);
  const repeatTypes = new Set(opts.REPEAT_TYPES);
  const waitTypes = new Set(opts.WAIT_TYPES);

  const topBlocks = workspace.getTopBlocks(true);
  const startBlock = topBlocks.find((block) => startTypes.has(block.type));
  if (!startBlock) {
    throw new Error("Falta bloque start.");
  }

  const compileChain = (first: BlockLike): Op[] => {
    const ops: Op[] = [];
    let current: BlockLike | null | undefined = first;
    while (current) {
      ops.push(compileBlock(current));
      current = current.getNextBlock?.();
    }
    return ops;
  };

  const compileBlock = (block: BlockLike): Op => {
    const { type } = block;
    if (startTypes.has(type)) {
      return { kind: "start", blockId: block.id };
    }
    if (moveTypes.has(type)) {
      const steps = readNumberField(block, ["STEPS", "NUM", "N"], 1);
      return { kind: "move", steps, blockId: block.id };
    }
    if (backTypes.has(type)) {
      const steps = readNumberField(block, ["STEPS", "NUM", "N"], 1);
      return { kind: "move", steps: -Math.abs(steps), blockId: block.id };
    }
    if (turnLeftTypes.has(type)) {
      return { kind: "turn", direction: "left", blockId: block.id };
    }
    if (turnRightTypes.has(type)) {
      return { kind: "turn", direction: "right", blockId: block.id };
    }
    if (waitTypes.has(type)) {
      const msRaw = readNumberField(block, ["MS"], Number.NaN);
      const secsRaw = readNumberField(block, ["SECS"], Number.NaN);
      let ms = msRaw;
      if (Number.isNaN(ms) && !Number.isNaN(secsRaw)) {
        ms = secsRaw * 1000;
      }
      if (Number.isNaN(ms)) {
        ms = readNumberField(block, ["NUM", "N", "DURATION"], 500);
      }
      return { kind: "wait", ms, blockId: block.id };
    }
    if (repeatTypes.has(type)) {
      const times = readNumberField(block, ["TIMES", "NUM", "N"], 2);
      const bodyStart =
        block.getInputTargetBlock?.("SUBSTACK") || block.getInputTargetBlock?.("DO");
      const body = bodyStart ? compileChain(bodyStart) : [];
      return { kind: "repeat", times, body, blockId: block.id };
    }
    throw new Error(`Bloque no soportado aún: ${type}`);
  };

  return { ops: compileChain(startBlock) };
};
