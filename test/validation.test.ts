import { describe, expect, it } from "vitest";
import { runValidation, runValidations } from "../src/validation.js";

const CWD = process.cwd();

describe("runValidation", () => {
  it("returns passed with captured output for a succeeding argv command", async () => {
    // Arrange
    const command = { kind: "argv", argv: ["node", "-e", "console.log('ok')"] } as const;

    // Act
    const result = await runValidation(command, CWD);

    // Assert
    expect(result.status).toBe("passed");
    expect(result.output).toContain("ok");
    expect(result.command).toBe("node -e console.log('ok')");
  });

  it("returns failed instead of throwing when the command exits non-zero", async () => {
    // Arrange
    const command = {
      kind: "argv",
      argv: ["node", "-e", "console.error('boom'); process.exit(3)"],
    } as const;

    // Act
    const result = await runValidation(command, CWD);

    // Assert
    expect(result.status).toBe("failed");
    expect(result.exitCode).toBe(3);
    expect(result.output).toContain("boom");
  });

  it("supports shell commands for the trusted CLI path", async () => {
    // Arrange
    const command = { kind: "shell", command: "echo shell-ok" } as const;

    // Act
    const result = await runValidation(command, CWD);

    // Assert
    expect(result.status).toBe("passed");
    expect(result.output).toContain("shell-ok");
  });

  it("returns failed with an explanatory message when the binary does not exist", async () => {
    // Arrange
    const command = { kind: "argv", argv: ["definitely-not-a-real-binary-xyz"] } as const;

    // Act
    const result = await runValidation(command, CWD);

    // Assert
    expect(result.status).toBe("failed");
    expect(result.output.length).toBeGreaterThan(0);
  });

  it("returns failed with a timeout note when the command exceeds the timeout", async () => {
    // Arrange
    const command = { kind: "argv", argv: ["node", "-e", "setTimeout(() => {}, 60000)"] } as const;

    // Act
    const result = await runValidation(command, CWD, { timeoutMs: 200 });

    // Assert
    expect(result.status).toBe("failed");
    expect(result.output).toContain("timed out");
  });

  it("returns failed when the empty argv list is provided", async () => {
    // Arrange
    const command = { kind: "argv", argv: [] } as const;

    // Act
    const result = await runValidation(command, CWD);

    // Assert
    expect(result.status).toBe("failed");
  });
});

describe("runValidations", () => {
  it("continues past a failing command and preserves order", async () => {
    // Arrange
    const commands = [
      { kind: "argv", argv: ["node", "-e", "process.exit(1)"] },
      { kind: "argv", argv: ["node", "-e", "console.log('second ran')"] },
    ] as const;

    // Act
    const results = await runValidations(commands, CWD);

    // Assert
    expect(results).toHaveLength(2);
    expect(results[0]?.status).toBe("failed");
    expect(results[1]?.status).toBe("passed");
    expect(results[1]?.output).toContain("second ran");
  });

  it("returns an empty array when no commands are given", async () => {
    // Act
    const results = await runValidations([], CWD);

    // Assert
    expect(results).toEqual([]);
  });
});
