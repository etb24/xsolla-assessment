import { exec, execFile, type ExecFileException } from "node:child_process";
import type { ValidationCommand, ValidationResult } from "./types.js";

export const VALIDATION_TIMEOUT_MS = 120_000;
export const MAX_OUTPUT_BYTES = 1_000_000;

export type ValidationOptions = {
  timeoutMs?: number;
};

export function describeCommand(command: ValidationCommand): string {
  return command.kind === "shell" ? command.command : command.argv.join(" ");
}

function combineOutput(stdout: string, stderr: string): string {
  return [stdout, stderr].map((part) => part.trim()).filter(Boolean).join("\n");
}

function toResult(
  command: ValidationCommand,
  timeoutMs: number,
  error: ExecFileException | null,
  stdout: string,
  stderr: string,
): ValidationResult {
  const output = combineOutput(stdout, stderr);
  if (!error) {
    return { command: describeCommand(command), status: "passed", output, exitCode: 0 };
  }

  const notes: string[] = [];
  if (error.killed || error.signal) {
    notes.push(`Command timed out after ${timeoutMs}ms and was killed (signal: ${error.signal ?? "unknown"}).`);
  } else if (error.message.includes("maxBuffer")) {
    notes.push(`Command output exceeded the ${MAX_OUTPUT_BYTES}-byte cap and was killed.`);
  } else if (typeof error.code !== "number") {
    notes.push(error.message);
  }

  return {
    command: describeCommand(command),
    status: "failed",
    output: [output, ...notes].filter(Boolean).join("\n"),
    exitCode: typeof error.code === "number" ? error.code : null,
  };
}

export function runValidation(
  command: ValidationCommand,
  cwd: string,
  options: ValidationOptions = {},
): Promise<ValidationResult> {
  const timeoutMs = options.timeoutMs ?? VALIDATION_TIMEOUT_MS;
  const execOptions = { cwd, timeout: timeoutMs, maxBuffer: MAX_OUTPUT_BYTES, encoding: "utf8" } as const;

  return new Promise((resolve) => {
    const onComplete = (error: ExecFileException | null, stdout: string, stderr: string) =>
      resolve(toResult(command, timeoutMs, error, stdout, stderr));

    if (command.kind === "shell") {
      exec(command.command, execOptions, onComplete);
      return;
    }

    const [file, ...args] = command.argv;
    if (!file) {
      resolve({
        command: describeCommand(command),
        status: "failed",
        output: "Validation command has an empty argv list.",
        exitCode: null,
      });
      return;
    }
    execFile(file, args, execOptions, onComplete);
  });
}

export async function runValidations(
  commands: readonly ValidationCommand[],
  cwd: string,
  options: ValidationOptions = {},
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  for (const command of commands) {
    results.push(await runValidation(command, cwd, options));
  }
  return results;
}
