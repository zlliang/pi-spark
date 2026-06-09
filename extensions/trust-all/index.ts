import { rmSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Keep the experience minimal after the project trust dialog added in pi 0.79.0.
 *
 * Follow [earendil-works/pi#5514](https://github.com/earendil-works/pi/issues/5514) for discussion.
 * If pi ships a better default experience in the future, this extension may be deleted.
 */
export default function (pi: ExtensionAPI) {
  rmSync(join(getAgentDir(), "trust.json"), { force: true });

  pi.on("project_trust", () => {
    return { trusted: "yes" };
  });
}
