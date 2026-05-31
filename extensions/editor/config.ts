import Type from "typebox";

import { SpinnerPresetSchema } from "./spinner";

export const EditorConfigSchema = Type.Object({
  spinner: Type.Optional(SpinnerPresetSchema),
});
