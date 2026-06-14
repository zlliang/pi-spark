import { ExaClient } from "./client";
import { fetchAction } from "./actions/fetch";
import { searchAction } from "./actions/search";
import { registerWebTool } from "./registry";
import { loadConfig } from "../../config";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Web actions exposed by the web tool, ordered to match the description (search before fetch). */
const ACTIONS = [
  searchAction,
  fetchAction,
];

export function registerWeb(pi: ExtensionAPI): void {
  const exa = new ExaClient();

  pi.on("session_start", (_event, ctx) => {
    const config = loadConfig(ctx).web;
    if (!config) return;

    registerWebTool(pi, exa, ACTIONS);
  });

  pi.on("session_shutdown", () => {
    exa.close();
  });
}
