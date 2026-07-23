#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { reviewRepository } from "./core.js";
import { GitInspectionError } from "./git.js";

export const MCP_COMMAND_OUTPUT_LIMIT_CHARS = 10_000;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

export function createInspectorServer(): McpServer {
  const server = new McpServer({ name: "repository-inspector", version: "2.0.0" });

  server.registerTool(
    "review_repository",
    {
      title: "Review repository",
      description:
        "Inspects a Git repository and returns a review report: files changed " +
        "versus a base ref, plus the results of optional validation commands. " +
        "Validation commands are argv arrays executed without a shell, so " +
        "shell syntax (pipes, variables, redirection) is not interpreted.",
      inputSchema: {
        repo_path: z.string().describe("Absolute path to the Git repository to inspect."),
        base_ref: z.string().optional().describe("Base ref to diff against (default: main)."),
        validation_commands: z
          .array(z.array(z.string()).nonempty())
          .optional()
          .describe('Commands as argv arrays, e.g. [["npm", "test"]]. Run without a shell.'),
      },
    },
    async ({ repo_path, base_ref, validation_commands }) => {
      try {
        const { report } = await reviewRepository({
          repositoryPath: repo_path,
          baseRef: base_ref,
          validationCommands: (validation_commands ?? []).map((argv) => ({
            kind: "argv" as const,
            argv,
          })),
          outputLimitChars: MCP_COMMAND_OUTPUT_LIMIT_CHARS,
        });
        return { content: [{ type: "text" as const, text: report }] };
      } catch (error: unknown) {
        const message =
          error instanceof GitInspectionError
            ? error.message
            : `Review failed: ${getErrorMessage(error)}`;
        return { isError: true, content: [{ type: "text" as const, text: message }] };
      }
    },
  );

  return server;
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  try {
    await createInspectorServer().connect(new StdioServerTransport());
  } catch (error) {
    console.error("Failed to start MCP server:", getErrorMessage(error));
    process.exit(1);
  }
}
