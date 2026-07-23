import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type FixtureRepo = {
  path: string;
  cleanup: () => void;
};

export function runGit(repositoryPath: string, args: readonly string[]): string {
  return execFileSync(
    "git",
    ["-c", "user.email=test@example.com", "-c", "user.name=Test", ...args],
    { cwd: repositoryPath, encoding: "utf8" },
  ).trim();
}

/**
 * Creates a throwaway git repo with a `main` branch (base.txt committed) and a
 * checked-out `feature` branch where base.txt is modified and added.txt is new.
 */
export function createFixtureRepo(): FixtureRepo {
  const path = mkdtempSync(join(tmpdir(), "inspector-fixture-"));

  runGit(path, ["init", "-b", "main"]);
  writeFileSync(join(path, "base.txt"), "base\n", "utf8");
  runGit(path, ["add", "."]);
  runGit(path, ["commit", "-m", "initial"]);

  runGit(path, ["checkout", "-b", "feature"]);
  writeFileSync(join(path, "base.txt"), "base changed\n", "utf8");
  writeFileSync(join(path, "added.txt"), "new file\n", "utf8");
  runGit(path, ["add", "."]);
  runGit(path, ["commit", "-m", "feature work"]);

  return {
    path,
    cleanup: () => rmSync(path, { recursive: true, force: true }),
  };
}
