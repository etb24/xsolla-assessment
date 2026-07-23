#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { reviewRepository } from "./core.js";
import { GitInspectionError } from "./git.js";
import type { ReportFormat } from "./types.js";

export class UsageError extends Error {}

export type CliArgs = {
  command: string;
  repositoryPath?: string;
  baseRef?: string;
  format: ReportFormat;
  validations: readonly string[];
};

const USAGE = [
  "Usage: inspector review --repo <path> [options]",
  "",
  "Options:",
  "  --base-ref <ref>      Base ref to diff against (default: main)",
  "  --format <format>     Report format: markdown | json (default: markdown)",
  "  --validate <command>  Shell command to run in the repo; repeatable",
  "",
  "Writes review-report.md (or review-report.json) to the current directory.",
  "Exits with code 1 if any validation command fails.",
].join("\n");

const REPORT_FORMATS: readonly string[] = ["markdown", "json"];

function isReportFormat(value: string): value is ReportFormat {
  return REPORT_FORMATS.includes(value);
}

function requireValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index];
  if (value === undefined) {
    throw new UsageError(`Missing value for ${flag}.`);
  }
  return value;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const [command = "", ...rest] = argv;
  let repositoryPath: string | undefined;
  let baseRef: string | undefined;
  let format: ReportFormat = "markdown";
  const validations: string[] = [];

  for (let index = 0; index < rest.length; index++) {
    const token = rest[index] as string;
    if (token === "--repo") {
      repositoryPath = requireValue(rest, ++index, token);
    } else if (token === "--base-ref") {
      baseRef = requireValue(rest, ++index, token);
    } else if (token === "--format") {
      const value = requireValue(rest, ++index, token);
      if (!isReportFormat(value)) {
        throw new UsageError(`Invalid --format "${value}". Use markdown or json.`);
      }
      format = value;
    } else if (token === "--validate") {
      validations.push(requireValue(rest, ++index, token));
    } else {
      throw new UsageError(`Unknown argument: ${token}`);
    }
  }

  return { command, repositoryPath, baseRef, format, validations };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.command !== "review" || !args.repositoryPath) {
    throw new UsageError("The review command and --repo <path> are required.");
  }

  const { report, validationResults } = await reviewRepository({
    repositoryPath: args.repositoryPath,
    baseRef: args.baseRef,
    validationCommands: args.validations.map((command) => ({ kind: "shell" as const, command })),
    format: args.format,
  });

  const outputPath = args.format === "json" ? "review-report.json" : "review-report.md";
  writeFileSync(outputPath, report, "utf8");
  console.log(`Review report written to ${outputPath}`);

  if (validationResults.some((result) => result.status === "failed")) {
    process.exitCode = 1;
  }
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch((error: unknown) => {
    if (error instanceof UsageError) {
      console.error(`${error.message}\n\n${USAGE}`);
    } else if (error instanceof GitInspectionError) {
      console.error(error.message);
    } else {
      console.error("Fatal error:", error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
  });
}
