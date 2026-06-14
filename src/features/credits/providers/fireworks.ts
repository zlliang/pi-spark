import { fileURLToPath } from "node:url";

import { toNumber } from "../../../utils/format";

import type { ClientUnaryCall, Metadata, ServiceClientConstructor, ServiceError } from "@grpc/grpc-js";
import type { Credits, CreditsProvider } from "../types";

type GatewayClient = InstanceType<ServiceClientConstructor>;

const PROVIDER = "fireworks";

/**
 * The control-plane gateway is a gRPC service, distinct from the inference API at
 * `api.fireworks.ai`. Credit balance lives here, behind the `x-api-key` header.
 */
const TARGET = "gateway.fireworks.ai:443";
const DEADLINE_MS = 20_000;

interface Money {
  currency_code?: string;
  units?: string | number;
  nanos?: string | number;
}

interface Balance {
  money?: Money | null;
}

interface Account {
  name?: string;
}

interface ListAccountsResponse {
  accounts?: Account[] | null;
}

/** gRPC clients are reusable and multiplex over one connection, so build once. */
let client: GatewayClient | undefined;

/** The API key maps to a fixed account, so cache the resolved resource name. */
const accountByKey = new Map<string, string>();

async function getClient(): Promise<GatewayClient> {
  if (client) return client;

  // @grpc/* is heavy to import (~45 ms cold); load it lazily so startup never pays for it unless
  // Fireworks credits are actually fetched.
  const [{ credentials, loadPackageDefinition }, { loadSync }] = await Promise.all([
    import("@grpc/grpc-js"),
    import("@grpc/proto-loader"),
  ]);

  const protoPath = fileURLToPath(new URL("./fireworks.proto", import.meta.url));
  const definition = loadSync(protoPath, { keepCase: true, longs: String, defaults: true });
  const proto = loadPackageDefinition(definition) as unknown as { gateway: { Gateway: ServiceClientConstructor } };
  client = new proto.gateway.Gateway(TARGET, credentials.createSsl());

  return client;
}

async function unary<T>(method: string, request: object, apiKey: string, signal: AbortSignal): Promise<T> {
  const grpc = await import("@grpc/grpc-js");
  const gateway = await getClient();

  return new Promise<T>((resolve, reject) => {
    const metadata = new grpc.Metadata();
    metadata.set("x-api-key", apiKey);

    const deadline = new Date(Date.now() + DEADLINE_MS);
    const invoke = gateway[method] as (
      request: object,
      metadata: Metadata,
      options: { deadline: Date },
      callback: (error: ServiceError | null, response: T) => void,
    ) => ClientUnaryCall;

    const call = invoke.call(gateway, request, metadata, { deadline }, (error, response) => {
      if (error) reject(new Error(error.details || error.message));
      else resolve(response);
    });

    if (signal.aborted) call.cancel();
    else signal.addEventListener("abort", () => call.cancel(), { once: true });
  });
}

async function resolveAccount(apiKey: string, signal: AbortSignal): Promise<string> {
  const cached = accountByKey.get(apiKey);
  if (cached) return cached;

  const response = await unary<ListAccountsResponse>("ListAccounts", {}, apiKey, signal);
  const name = response.accounts?.[0]?.name;
  if (!name) throw new Error("no account found");

  accountByKey.set(apiKey, name);
  return name;
}

function moneyToNumber(money: Money | null | undefined): number | undefined {
  if (!money) return undefined;

  const units = toNumber(money.units) ?? 0;
  const nanos = toNumber(money.nanos) ?? 0;
  return units + nanos / 1e9;
}

export const fireworksProvider: CreditsProvider = {
  id: PROVIDER,
  label: "Fireworks",

  async fetch(_ctx, apiKey, signal): Promise<Credits> {
    const name = await resolveAccount(apiKey, signal);
    const balance = await unary<Balance>("GetBalance", { name }, apiKey, signal);

    return { type: "balance", remaining: moneyToNumber(balance.money) };
  },
};
