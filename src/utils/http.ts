import ky from "ky";

import type { KyInstance } from "ky";

const REQUEST_RETRY_LIMIT = 2;
const REQUEST_TIMEOUT_MS = 30_000;

export const http = ky.create({
  headers: { Accept: "application/json" },
  retry: REQUEST_RETRY_LIMIT,
  timeout: REQUEST_TIMEOUT_MS,
});

export function withAuth(client: KyInstance, apiKey: string): KyInstance {
  return client.extend({ headers: { Authorization: `Bearer ${apiKey}` } });
}
