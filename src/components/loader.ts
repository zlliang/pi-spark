import { Loader as BaseLoader } from "@earendil-works/pi-tui";

/** The built-in loader hardcodes 1 column of horizontal padding, which is private. */
const PADDING_X = 1;

export class Loader extends BaseLoader {
  override render(width: number): string[] {
    // Inflate the width so the base loader keeps full content width, then strip its padding.
    return super.render(width + PADDING_X * 2).map((line) => {
      if (line.length === 0) {
        return line;
      }

      return line.slice(PADDING_X, line.length - PADDING_X);
    });
  }
}
