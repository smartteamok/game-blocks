// src/main.ts
import "./style.css";
import { createWorkspace, destroyWorkspace } from "./core/editor/workspace";
import { loadXmlTextIntoWorkspace, workspaceToXmlText } from "./core/editor/serialization";
import { compileWorkspaceToAst } from "./core/compiler/compile";
import { validateProgram } from "./core/compiler/validate";
import { runProgram, type RuntimeController } from "./core/runtime/runtime";
import { loadProject, saveProject } from "./core/storage/projectStore";
import { apps, getDefaultApp, getAppById } from "./apps/registry";
import type { AppDefinition, AppRenderContext } from "./apps/types";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="layout">
    <div class="toolbar">
      <label for="game-select" class="toolbar-label">Juego</label>
      <select id="game-select" class="game-select"></select>
      <div class="toolbar-sep"></div>
      <button id="btnRun">Run</button>
      <button id="btnStop">Stop</button>
      <button id="btnSave">Save</button>
      <button id="btnLoad">Load</button>
      <span id="status" class="status"></span>
    </div>

    <div class="main">
      <div id="stage" class="stage"></div>
      <div class="editor">
        <div id="blocklyArea" class="blocklyArea"></div>
        <div id="blocklyDiv" class="blocklyDiv"></div>
      </div>
    </div>
  </div>
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Blockly = (window as any).Blockly;
if (!Blockly) {
  throw new Error("Blockly no está cargado. Revisá index.html y la carpeta public/vendor.");
}

// Registrar bloques de todos los juegos (mismo set para maze-like)
apps.forEach((a) => a.registerBlocks(Blockly));

const stageEl = document.getElementById("stage") as HTMLDivElement;
const blocklyDiv = document.getElementById("blocklyDiv") as HTMLDivElement;
const gameSelect = document.getElementById("game-select") as HTMLSelectElement;
const statusEl = document.getElementById("status") as HTMLSpanElement;

const setStatus = (text: string) => {
  statusEl.textContent = text;
};

const WORKSPACE_OPTS = {
  horizontalLayout: true,
  toolboxPosition: "end" as const,
  mediaPath: "/vendor/scratch-blocks/media/",
  trashcan: true,
  scrollbars: true,
  fixedStartBlock: { type: "event_whenflagclicked", x: 40, y: 30 }
};

// Populate game selector
apps.forEach((app) => {
  const opt = document.createElement("option");
  opt.value = app.id;
  opt.textContent = app.title;
  if (app.levels?.length) {
    opt.textContent += ` (${app.levels.length} niveles)`;
  }
  gameSelect.appendChild(opt);
});

let currentApp: AppDefinition<unknown> = getDefaultApp();
let workspace: unknown = createWorkspace(
  Blockly,
  blocklyDiv,
  currentApp.toolboxXml,
  WORKSPACE_OPTS
);
let appState: unknown = currentApp.createInitialState();
let runtimeController: RuntimeController | null = null;

gameSelect.value = currentApp.id;
setStatus("Editor listo ✅");

const buildContext = (): AppRenderContext<unknown> => ({
  getWorkspace: () => workspace,
  setStatus,
  updateState: (nextState) => {
    appState = nextState;
    currentApp.render(stageEl, appState, buildContext());
  },
  getState: () => appState
});

currentApp.render(stageEl, appState, buildContext());

function switchGame(appId: string): void {
  const next = getAppById(appId);
  if (!next || next.id === currentApp.id) return;

  runtimeController?.stop();
  destroyWorkspace(workspace, blocklyDiv);
  currentApp = next;
  workspace = createWorkspace(
    Blockly,
    blocklyDiv,
    currentApp.toolboxXml,
    WORKSPACE_OPTS
  );
  appState = currentApp.createInitialState();

  const project = loadProject(currentApp.id);
  if (project && project.appId === currentApp.id) {
    loadXmlTextIntoWorkspace(Blockly, workspace as { clear?: () => void }, project.workspaceXml);
    appState = currentApp.deserializeState
      ? currentApp.deserializeState(project.appState)
      : (project.appState as unknown);
    setStatus(`Cargado ${currentApp.title} ✅`);
  } else {
    setStatus(`${currentApp.title} listo`);
  }

  gameSelect.value = currentApp.id;
  currentApp.render(stageEl, appState, buildContext());
}

gameSelect.addEventListener("change", () => {
  switchGame(gameSelect.value);
});

document.getElementById("btnSave")!.addEventListener("click", () => {
  const workspaceXml = workspaceToXmlText(Blockly, workspace);
  const appStateRaw = currentApp.serializeState
    ? currentApp.serializeState(appState)
    : appState;
  saveProject({
    schemaVersion: 1,
    appId: currentApp.id,
    workspaceXml,
    appState: appStateRaw
  });
  setStatus("Guardado ✅");
});

document.getElementById("btnLoad")!.addEventListener("click", () => {
  const project = loadProject(currentApp.id);
  if (!project) {
    setStatus("No hay nada guardado para este juego");
    return;
  }
  if (project.appId !== currentApp.id) {
    setStatus(`Proyecto de otro juego: ${project.appId}`);
    return;
  }
  loadXmlTextIntoWorkspace(Blockly, workspace as { clear?: () => void }, project.workspaceXml);
  appState = currentApp.deserializeState
    ? currentApp.deserializeState(project.appState)
    : (project.appState as unknown);
  currentApp.render(stageEl, appState, buildContext());
  setStatus("Cargado ✅");
});

document.getElementById("btnRun")!.addEventListener("click", () => {
  try {
    const program = compileWorkspaceToAst(
      Blockly,
      workspace as { getTopBlocks: (ordered: boolean) => { type: string; id: string }[] },
      currentApp.compileOptions
    );
    validateProgram(program);

    if (currentApp.checkConstraints) {
      const constraint = currentApp.checkConstraints(workspace, appState);
      if (!constraint.ok) {
        if (typeof appState === "object" && appState) {
          (appState as { status?: string; message?: string }).status = "error";
          (appState as { message?: string }).message = constraint.message;
        }
        currentApp.render(stageEl, appState, buildContext());
        setStatus(constraint.message);
        return;
      }
    }

    runtimeController?.stop();
    appState = currentApp.adapter.reset(appState);
    if (typeof appState === "object" && appState) {
      (appState as { status?: string; message?: string }).status = "running";
      (appState as { message?: string }).message = "Jugando...";
    }
    currentApp.render(stageEl, appState, buildContext());
    runtimeController = runProgram(
      program,
      currentApp.adapter,
      {
        onStatus: (text) => {
          if (text !== "Finalizado.") setStatus(text);
        },
        onDone: () => {
          currentApp.render(stageEl, appState, buildContext());
          setStatus("Finalizado ✅");
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : String(error);
          if (typeof appState === "object" && appState) {
            const statusValue = (appState as { status?: string }).status;
            const stateMessage = (appState as { message?: string }).message;
            if (statusValue === "win") {
              currentApp.render(stageEl, appState, buildContext());
              setStatus(stateMessage ?? "Ganaste ✅");
              return;
            }
            if (statusValue === "error") {
              currentApp.render(stageEl, appState, buildContext());
              setStatus(stateMessage ?? `Error: ${message}`);
              return;
            }
          }
          setStatus(`Error: ${message}`);
        }
      },
      { initialState: appState }
    );
    setStatus("Ejecutando...");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Error: ${message}`);
  }
});

document.getElementById("btnStop")!.addEventListener("click", () => {
  runtimeController?.stop();
  if (typeof appState === "object" && appState) {
    (appState as { status?: string; message?: string }).status = "idle";
    (appState as { message?: string }).message = "Detenido";
  }
  currentApp.render(stageEl, appState, buildContext());
  setStatus("Detenido.");
});
