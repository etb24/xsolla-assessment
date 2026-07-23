import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import type { ChangedFile } from "./types.js";

/** A git inspection failure with a message safe to show to the end user. */
export class GitInspectionError extends Error {}

function git(repositoryPath: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repositoryPath,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function assertGitRepository(repositoryPath: string): void {
  if (!existsSync(repositoryPath)) {
    throw new GitInspectionError(`Path does not exist: ${repositoryPath}`);
  }
  try {
    git(repositoryPath, ["rev-parse", "--is-inside-work-tree"]);
  } catch {
    throw new GitInspectionError(`Not a git repository: ${repositoryPath}`);
  }
}

export function changedFiles(repositoryPath: string, baseRef?: string): ChangedFile[] {
  const base = baseRef ?? "main";
  const output = git(repositoryPath, ["diff", "--name-status", `${base}...HEAD`]);

  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [code, ...pathParts] = line.split("\t");
      const status = code === "A" ? "added" : code === "D" ? "deleted" : "modified";
      return { path: pathParts.join("\t"), status };
    });
}
