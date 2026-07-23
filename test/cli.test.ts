import { describe, expect, it } from "vitest";
import { parseArgs, UsageError } from "../src/cli.js";

describe("parseArgs", () => {
  it("keeps a repository path containing spaces intact", () => {
    // Act
    const args = parseArgs(["review", "--repo", "/tmp/my repo"]);

    // Assert
    expect(args.repositoryPath).toBe("/tmp/my repo");
  });

  it("collects repeated --validate commands in order", () => {
    // Act
    const args = parseArgs(["review", "--repo", "/r", "--validate", "npm test", "--validate", "npm run lint"]);

    // Assert
    expect(args.validations).toEqual(["npm test", "npm run lint"]);
  });

  it("defaults the format to markdown", () => {
    // Act
    const args = parseArgs(["review", "--repo", "/r"]);

    // Assert
    expect(args.format).toBe("markdown");
  });

  it("accepts --format json", () => {
    // Act
    const args = parseArgs(["review", "--repo", "/r", "--format", "json"]);

    // Assert
    expect(args.format).toBe("json");
  });

  it("throws a usage error for an unknown flag", () => {
    // Act + Assert
    expect(() => parseArgs(["review", "--repo", "/r", "--frmat", "json"])).toThrow(UsageError);
  });

  it("throws a usage error for an invalid --format value", () => {
    // Act + Assert
    expect(() => parseArgs(["review", "--repo", "/r", "--format", "xml"])).toThrow(UsageError);
  });

  it("throws a usage error when a flag is missing its value", () => {
    // Act + Assert
    expect(() => parseArgs(["review", "--repo"])).toThrow(UsageError);
  });
});
