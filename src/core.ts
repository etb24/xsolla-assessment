import { assertGitRepository, changedFiles } from "./git.js";
import { jsonReport, markdownReport } from "./report.js";
import type { ReviewRequest, ValidationResult } from "./types.js";
import { runValidations, truncateOutput } from "./validation.js";

export type ReviewOutcome = {
  report: string;
  validationResults: readonly ValidationResult[];
};

function capOutputs(
  results: readonly ValidationResult[],
  limitChars: number | undefined,
): readonly ValidationResult[] {
  if (limitChars === undefined) {
    return results;
  }
  return results.map((result) => ({
    ...result,
    output: truncateOutput(result.output, limitChars),
  }));
}

export async function reviewRepository(request: ReviewRequest): Promise<ReviewOutcome> {
  assertGitRepository(request.repositoryPath);
  const files = changedFiles(request.repositoryPath, request.baseRef);
  const validations = await runValidations(
    request.validationCommands ?? [],
    request.repositoryPath,
  );

  const reportInput = {
    repositoryPath: request.repositoryPath,
    baseRef: request.baseRef,
    changedFiles: files,
    validationResults: capOutputs(validations, request.outputLimitChars),
  };
  const report =
    request.format === "json" ? jsonReport(reportInput) : markdownReport(reportInput);
  return { report, validationResults: validations };
}
