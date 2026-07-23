import { describe, expect, it } from "vitest";
import { GitInspectionError, changedFiles, parseNameStatus } from "../src/git.js";
import { createFixtureRepo } from "./helpers/fixture-repo.js";

describe("parseNameStatus", () => {
  it("maps added, modified, and deleted lines", () => {
    // Arrange
    const output = "A\tnew.ts\nM\tchanged.ts\nD\tgone.ts";

    // Act
    const files = parseNameStatus(output);

    // Assert
    expect(files).toEqual([
      { path: "new.ts", status: "added" },
      { path: "changed.ts", status: "modified" },
      { path: "gone.ts", status: "deleted" },
    ]);
  });

  it("reports the new path for a rename line", () => {
    // Act
    const files = parseNameStatus("R100\told/name.ts\tnew/name.ts");

    // Assert
    expect(files).toEqual([{ path: "new/name.ts", status: "renamed" }]);
  });

  it("returns an empty list for empty diff output", () => {
    // Act + Assert
    expect(parseNameStatus("")).toEqual([]);
  });
});

describe("changedFiles", () => {
  it("throws a GitInspectionError naming the base ref when it does not exist", () => {
    // Arrange
    const fixture = createFixtureRepo();

    try {
      // Act + Assert
      expect(() => changedFiles(fixture.path, "no-such-ref")).toThrow(GitInspectionError);
      expect(() => changedFiles(fixture.path, "no-such-ref")).toThrow(/no-such-ref/);
    } finally {
      fixture.cleanup();
    }
  });
});
