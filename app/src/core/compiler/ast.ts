// Shared AST types for block programs.
export type StartOp = {
  kind: "start";
  blockId: string;
};

export type MoveOp = {
  kind: "move";
  steps: number;
  blockId: string;
};

export type TurnOp = {
  kind: "turn";
  direction: "left" | "right";
  blockId: string;
};

export type RepeatOp = {
  kind: "repeat";
  times: number;
  body: Op[];
  blockId: string;
};

export type WaitOp = {
  kind: "wait";
  ms: number;
  blockId: string;
};

export type Op = StartOp | MoveOp | TurnOp | RepeatOp | WaitOp;

export type Program = {
  ops: Op[];
};
