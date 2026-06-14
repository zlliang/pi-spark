import { defineActionFor, registerComposedTool } from "../../utils/tool";

import type { ExaClient } from "./client";
import type { Action } from "../../utils/tool";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface WebActionContext {
  exa: ExaClient;
}

export const defineAction = defineActionFor<WebActionContext>();

export function registerWebTool(pi: ExtensionAPI, exa: ExaClient, actions: Action<WebActionContext, any, any>[]): void {
  registerComposedTool<WebActionContext>(pi, {
    name: "web",
    label: "web",
    descriptionIntro: "Access the live web via Exa:",
    promptSnippet: "Search the web and fetch page content via Exa",
    actions,
    createContext: () => ({ exa }),
  });
}
