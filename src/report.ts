import type { ChangedFile, ValidationResult } from "./types.js";

export type ReportInput = {
  repositoryPath: string;
  baseRef?: string;
  changedFiles: readonly ChangedFile[];
  validationResults: readonly ValidationResult[];
};

const MIN_FENCE_LENGTH = 3;

/** A fence one backtick longer than any backtick run in the content it wraps. */
function fenceFor(content: string): string {
  const longestRun = (content.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length), 0);
  return "`".repeat(Math.max(MIN_FENCE_LENGTH, longestRun + 1));
}

export function markdownReport(input: ReportInput): string {
  const lines = [`# Review Report: ${input.repositoryPath}`, "", "## Changed files"];

  if (input.changedFiles.length === 0) {
    lines.push("No changed files.");
  }
  for (const file of input.changedFiles) {
    lines.push(`- ${file.path} (${file.status})`);
  }

  lines.push("", "## Validation output");
  if (input.validationResults.length === 0) {
    lines.push("No validation commands were run.");
  }
  for (const result of input.validationResults) {
    const fence = fenceFor(result.output);
    lines.push(`### ${result.command} — ${result.status}`, fence, result.output, fence);
  }
  return lines.join("\n");
}

export function jsonReport(input: ReportInput): string {
  const passed = input.validationResults.filter((result) => result.status === "passed");
  return JSON.stringify(
    {
      repositoryPath: input.repositoryPath,
      baseRef: input.baseRef,
      changedFiles: input.changedFiles,
      validations: input.validationResults,
      summary: {
        filesChanged: input.changedFiles.length,
        validationsPassed: passed.length,
        validationsFailed: input.validationResults.length - passed.length,
      },
    },
    null,
    2,
  );
}
