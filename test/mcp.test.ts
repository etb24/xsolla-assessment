import { mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInspectorServer } from "../src/mcp-server.js";
import { createFixtureRepo, type FixtureRepo } from "./helpers/fixture-repo.js";

type TextContent = { type: "text"; text: string };

async function callReviewTool(args: Record<string, unknown>) {
  const server = createInspectorServer();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  const result = await client.callTool({ name: "review_repository", arguments: args });
  await client.close();
  const text = (result.content as TextContent[]).map((item) => item.text).join("\n");
  return { isError: result.isError === true, text };
}

describe("review_repository MCP tool", () => {
  let fixture: FixtureRepo;

  beforeAll(() => {
    fixture = createFixtureRepo();
  });

  afterAll(() => {
    fixture.cleanup();
  });

  it("reviews the repo at repo_path and reports its changed files", async () => {
    // Act
    const { isError, text } = await callReviewTool({ repo_path: fixture.path, base_ref: "main" });

    // Assert — regression for the repo_path/repoPath seam bug (path must flow through)
    expect(isError).toBe(false);
    expect(text).toContain(fixture.path);
    expect(text).toContain("added.txt");
    expect(text).toContain("base.txt");
  });

  it("reports a failing validation command instead of crashing", async () => {
    // Act
    const { isError, text } = await callReviewTool({
      repo_path: fixture.path,
      base_ref: "main",
      validation_commands: [["node", "-e", "process.exit(1)"]],
    });

    // Assert
    expect(isError).toBe(false);
    expect(text).toContain("failed");
  });

  it("passes argv arguments literally instead of expanding them in a shell", async () => {
    // Arrange: under a shell, $HOME would expand to the real home directory
    const validationCommands = [["node", "-p", "process.argv[1]", "$HOME"]];

    // Act
    const { isError, text } = await callReviewTool({
      repo_path: fixture.path,
      base_ref: "main",
      validation_commands: validationCommands,
    });

    // Assert
    expect(isError).toBe(false);
    expect(text).not.toContain(homedir());
  });

  it("returns a clear tool error for a path that is not a git repository", async () => {
    // Arrange
    const nonRepoDir = mkdtempSync(join(tmpdir(), "not-a-repo-"));

    try {
      // Act
      const { isError, text } = await callReviewTool({ repo_path: nonRepoDir });

      // Assert
      expect(isError).toBe(true);
      expect(text.toLowerCase()).toContain("not a git repository");
    } finally {
      rmSync(nonRepoDir, { recursive: true, force: true });
    }
  });
});
