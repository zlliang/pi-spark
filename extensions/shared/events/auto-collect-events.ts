import type { ExtensionAPI, EventBus } from "@earendil-works/pi-coding-agent";

export class EventCollector {
  private pi: ExtensionAPI;
  private collected: Set<() => void> = new Set();

  constructor(pi: ExtensionAPI) {
    this.pi = pi;
  }

  on(...args: Parameters<EventBus["on"]>): ReturnType<EventBus["on"]> {
    const unsubscribe = this.pi.events.on(...args);
    this.collected.add(unsubscribe);

    return this.wrap(unsubscribe);
  }

  dispose(): void {
    this.collected.forEach((unsubscribe) => unsubscribe());
    this.collected.clear();
  }

  private wrap(unsubscribe: () => void): () => void {
    return () => {
      if (this.collected.delete(unsubscribe)) {
        unsubscribe();
      }
    };
  }
}

export function autoCollectEvents(pi: ExtensionAPI): EventCollector {
  const collector = new EventCollector(pi);

  pi.on("session_shutdown", () => {
    collector.dispose();
  });

  return collector;
}
