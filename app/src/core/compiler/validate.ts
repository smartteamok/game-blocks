import type { Op, Program } from "./ast";

const MAX_OPS = 200;

const countOps = (ops: Op[]): number => {
  let count = 0;
  for (const op of ops) {
    count += 1;
    if (op.kind === "repeat") {
      count += countOps(op.body);
    }
  }
  return count;
};

// Validates basic program constraints before execution.
export const validateProgram = (program: Program): void => {
  if (program.ops.length === 0) {
    throw new Error("El programa está vacío.");
  }
  if (program.ops[0].kind !== "start") {
    throw new Error("El programa debe empezar con start.");
  }
  const totalOps = countOps(program.ops);
  if (totalOps > MAX_OPS) {
    throw new Error(`Programa demasiado largo (máximo ${MAX_OPS} ops).`);
  }
};
