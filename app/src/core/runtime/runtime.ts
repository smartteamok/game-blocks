import type { Op, Program } from "../compiler/ast";

export type RuntimeAdapter<AppState> = {
  applyOp: (op: Op, state: AppState) => Promise<AppState> | AppState;
  reset: (state: AppState) => AppState;
};

export type RuntimeHooks = {
  onStep?: (blockId: string) => void;
  onStatus?: (text: string) => void;
  onDone?: () => void;
  onError?: (error: unknown) => void;
};

export type RunOptions<AppState> = {
  initialState: AppState;
};

export type RuntimeController = {
  stop: () => void;
  isRunning: () => boolean;
};

// Executes a program sequentially using a game-specific adapter.
export const runProgram = <AppState>(
  program: Program,
  adapter: RuntimeAdapter<AppState>,
  hooks: RuntimeHooks = {},
  opts: RunOptions<AppState>
): RuntimeController => {
  let running = true;
  let stopped = false;
  let state = adapter.reset(opts.initialState);
  const pendingTimers: Array<{ id: number; resolve: () => void }> = [];

  const clearTimers = () => {
    for (const timer of pendingTimers) {
      window.clearTimeout(timer.id);
      timer.resolve();
    }
    pendingTimers.length = 0;
  };

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const id = window.setTimeout(() => {
        const index = pendingTimers.findIndex((timer) => timer.id === id);
        if (index >= 0) {
          pendingTimers.splice(index, 1);
        }
        resolve();
      }, ms);
      pendingTimers.push({ id, resolve });
    });

  const runOps = async (ops: Op[]): Promise<void> => {
    for (const op of ops) {
      if (stopped) {
        return;
      }
      hooks.onStep?.(op.blockId);
      if (op.kind === "repeat") {
        const times = Math.max(0, Math.floor(op.times));
        for (let i = 0; i < times; i += 1) {
          if (stopped) {
            return;
          }
          await runOps(op.body);
        }
        continue;
      }
      state = await adapter.applyOp(op, state);
      if (op.kind === "wait") {
        await sleep(Math.max(0, op.ms));
      }
    }
  };

  const run = async () => {
    hooks.onStatus?.("Ejecutando...");
    try {
      await runOps(program.ops);
      if (!stopped) {
        hooks.onDone?.();
        hooks.onStatus?.("Finalizado.");
      }
    } catch (error) {
      hooks.onError?.(error);
    } finally {
      running = false;
    }
  };

  void run();

  return {
    stop: () => {
      if (!running) {
        return;
      }
      stopped = true;
      running = false;
      clearTimers();
      hooks.onStatus?.("Detenido.");
    },
    isRunning: () => running
  };
};
