export type ProjectRecord = {
  schemaVersion: 1;
  appId: string;
  workspaceXml: string;
  appState: unknown;
};

const STORAGE_PREFIX = "game-blocks.project.";

const storageKey = (appId: string) => `${STORAGE_PREFIX}${appId}`;

/** Persists a project snapshot in localStorage (one per game). */
export const saveProject = (project: ProjectRecord): void => {
  localStorage.setItem(storageKey(project.appId), JSON.stringify(project));
};

/** Restores the saved project for the given game, or null if none. */
export const loadProject = (appId: string): ProjectRecord | null => {
  const raw = localStorage.getItem(storageKey(appId));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as ProjectRecord;
  } catch {
    return null;
  }
};

/** Returns appIds that have a saved project. */
export const listProjectAppIds = (): string[] => {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k?.startsWith(STORAGE_PREFIX)) {
      keys.push(k.slice(STORAGE_PREFIX.length));
    }
  }
  return keys;
};

/** Clears the saved project for a specific game. */
export const clearProject = (appId: string): void => {
  localStorage.removeItem(storageKey(appId));
};
