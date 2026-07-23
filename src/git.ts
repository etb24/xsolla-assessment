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

export function parseNameStatus(output: string): ChangedFile[] {
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [code = "", ...pathParts] = line.split("\t");
      if (code.startsWith("R") || code.startsWith("C")) {
        // Rename/copy lines carry two paths (old, new); report the new one.
        return { path: pathParts[1] ?? pathParts[0] ?? "", status: "renamed" as const };
      }
      const status = code === "A" ? "added" : code === "D" ? "deleted" : "modified";
      return { path: pathParts.join("\t"), status };
    });
}

export function changedFiles(repositoryPath: string, baseRef?: string): ChangedFile[] {
  const base = baseRef ?? "main";
  try {
    return parseNameStatus(git(repositoryPath, ["diff", "--name-status", `${base}...HEAD`]));
  } catch (error) {
    const stderr =
      error instanceof Error && "stderr" in error
        ? String((error as { stderr?: unknown }).stderr ?? "").split("\n")[0]
        : "";
    throw new GitInspectionError(
      `Could not diff against base ref "${base}" — pass --base-ref to change it. ${stderr}`.trim(),
    );
  }
}
