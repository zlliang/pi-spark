import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { TextContent } from "@earendil-works/pi-ai";

/** Exa's hosted MCP endpoint (Streamable HTTP). No API key required for the free tier. */
const EXA_MCP_URL = "https://mcp.exa.ai/mcp";

/** Collapse an MCP tool call result's content into plain text content for the model. */
function sanitizeContent(content: unknown): TextContent[] {
  const blocks = (Array.isArray(content) ? content : []) as { type: string; text?: string}[];
  const result: TextContent[] = blocks.map((block) =>
    block.type === "text" && typeof block.text === "string"
      ? { type: "text", text: block.text }
      : { type: "text", text: JSON.stringify(block) },
  );

  return result;
}

/**
 * Thin, session-scoped wrapper over Exa's remote MCP server using the official MCP client.
 *
 * The MCP connection (one `initialize` handshake) is established lazily on the first call and
 * reused for the rest of the session; `close()` tears it down on `session_shutdown`.
 */
export class ExaClient {
  private client: Client | undefined;
  private connecting: Promise<Client> | undefined;

  async call(toolName: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<TextContent[]> {
    const client = await this.getClient();
    const result = await client.callTool({ name: toolName, arguments: args }, undefined, signal ? { signal } : undefined);
    const content = sanitizeContent(result.content);

    if (result.isError && content.length > 0) {
      const text = content.map((block) => block.text).join("\n");
      throw new Error(`Exa request failed: ${text}`);
    }

    if (result.isError) throw new Error(`Exa request failed: no content returned`);
    if (content.length === 0) throw new Error(`No content returned`);

    return content;
  }

  async close(): Promise<void> {
    const current = this.client;
    this.client = undefined;
    this.connecting = undefined;
    await current?.close().catch(() => {});
  }

  private getClient(): Promise<Client> {
    if (this.client) return Promise.resolve(this.client);

    if (!this.connecting) {
      this.connecting = (async () => {
        // The MCP SDK is heavy to import (~40 ms cold); load it lazily so startup never pays for
        // it unless a web action actually runs.
        const [{ Client }, { StreamableHTTPClientTransport }] = await Promise.all([
          import("@modelcontextprotocol/sdk/client/index.js"),
          import("@modelcontextprotocol/sdk/client/streamableHttp.js"),
        ]);

        const next = new Client({ name: "pi-spark", version: "0" });
        const transport = new StreamableHTTPClientTransport(new URL(EXA_MCP_URL));
        await next.connect(transport as Parameters<Client["connect"]>[0]);
        this.client = next;
        return next;
      })().catch((error) => {
        this.connecting = undefined;
        throw error;
      });
    }

    return this.connecting;
  }
}
