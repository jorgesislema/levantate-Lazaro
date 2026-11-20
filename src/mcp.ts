import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { branches, dependencyHealth, gitHistory, lastActivity, resolveRoot } from "./mcp-tools.js";

const text = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v, null, 2) }] });
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export function buildServer(dir: string): McpServer {
  const root = resolveRoot(dir); // fixed at start; no tool accepts a path
  const server = new McpServer({ name: "lazarus-git", version: "0.1.0" });

  server.registerTool(
    "git_history",
    {
      description: "Recent commits (hash, date, redacted subject) of the repository this server was started in. Read-only.",
      inputSchema: { limit: z.number().int().min(1).max(100).default(30) },
      annotations: readOnly,
    },
    ({ limit }) => text(gitHistory(root, limit)),
  );

  server.registerTool(
    "branches",
    {
      description: "Local branches with last commit date and commits ahead of the current branch. Unfinished work shows up here.",
      annotations: readOnly,
    },
    () => text(branches(root)),
  );

  server.registerTool(
    "last_activity",
    {
      description: "Last commit date, whole days inactive and branch list. Uses the current clock.",
      annotations: readOnly,
    },
    () => text(lastActivity(root)),
  );

  server.registerTool(
    "dependency_health",
    {
      description: "Declared runtime, lockfile presence, unpinned direct dependencies and script names. Never runs scripts or installs anything.",
      annotations: readOnly,
    },
    () => text(dependencyHealth(root)),
  );

  return server;
}

export async function serve(dir: string): Promise<void> {
  const server = buildServer(dir);
  await server.connect(new StdioServerTransport());
}
