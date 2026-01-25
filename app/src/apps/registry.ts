import { mazeApp } from "./maze/mazeApp";
import { practiceApp } from "./practice/practiceApp";
import type { AppDefinition } from "./types";

export const apps: AppDefinition<unknown>[] = [mazeApp, practiceApp] as AppDefinition<unknown>[];

export const getDefaultApp = (): AppDefinition<unknown> => apps[0];

export const getAppById = (id: string): AppDefinition<unknown> | undefined =>
  apps.find((app) => app.id === id);
