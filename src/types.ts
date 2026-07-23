export type ChangedFile = {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
};

export type ValidationCommand =
  | { kind: "shell"; command: string }
  | { kind: "argv"; argv: readonly string[] };

export type ValidationResult = {
  command: string;
  status: "passed" | "failed";
  output: string;
  exitCode?: number | null;
};

export type ReportFormat = "markdown" | "json";

export type ReviewRequest = {
  repositoryPath: string;
  baseRef?: string;
  validationCommands?: ValidationCommand[];
  format?: ReportFormat;
};
