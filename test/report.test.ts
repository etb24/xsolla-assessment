import { describe, expect, it } from "vitest";
import { jsonReport, markdownReport } from "../src/report.js";

const BASE_INPUT = {
  repositoryPath: "/work/sample",
  baseRef: "main",
  changedFiles: [{ path: "src/index.ts", status: "modified" }],
  validationResults: [{ command: "npm test", status: "passed", output: "ok", exitCode: 0 }],
} as const;

describe("markdownReport", () => {
  it("lists changed files and validation output", () => {
    // Act
    const report = markdownReport({ ...BASE_INPUT });

    // Assert
    expect(report).toContain("src/index.ts (modified)");
    expect(report).toContain("npm test");
    expect(report).toContain("ok");
  });

  it("shows the failed status of a validation command", () => {
    // Arrange
    const input = {
      ...BASE_INPUT,
      validationResults: [{ command: "npm test", status: "failed", output: "1 test failed", exitCode: 1 }],
    } as const;

    // Act
    const report = markdownReport(input);

    // Assert
    expect(report).toContain("failed");
  });

  it("keeps the code fence intact when validation output contains backtick fences", () => {
    // Arrange
    const hostileOutput = "```\nfake heading\n```";
    const input = {
      ...BASE_INPUT,
      validationResults: [{ command: "npm test", status: "passed", output: hostileOutput, exitCode: 0 }],
    } as const;

    // Act
    const report = markdownReport(input);

    // Assert: the wrapping fence must be longer than any fence inside the output
    expect(report).toContain("````");
    expect(report).toContain(hostileOutput);
  });

  it("renders explicit empty states instead of empty sections", () => {
    // Act
    const report = markdownReport({ ...BASE_INPUT, changedFiles: [], validationResults: [] });

    // Assert
    expect(report).toContain("No changed files");
    expect(report).toContain("No validation commands");
  });
});

describe("jsonReport", () => {
  it("produces parseable JSON with files, validations, and summary counts", () => {
    // Arrange
    const input = {
      ...BASE_INPUT,
      validationResults: [
        { command: "npm test", status: "passed", output: "ok", exitCode: 0 },
        { command: "npm run lint", status: "failed", output: "boom", exitCode: 1 },
      ],
    } as const;

    // Act
    const parsed = JSON.parse(jsonReport(input));

    // Assert
    expect(parsed.repositoryPath).toBe("/work/sample");
    expect(parsed.baseRef).toBe("main");
    expect(parsed.changedFiles).toEqual([{ path: "src/index.ts", status: "modified" }]);
    expect(parsed.validations).toHaveLength(2);
    expect(parsed.summary).toEqual({ filesChanged: 1, validationsPassed: 1, validationsFailed: 1 });
  });
});
