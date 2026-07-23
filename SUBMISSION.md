# Submission

## What did you investigate first, and why?

I read README.md first to understand what the tool was supposed to do. Then I read through all the source files, starting with `src/core.ts` since both `cli.ts` and `mcp-server.ts` depend on it and anything wrong there would be wrong for both interfaces. From there I worked outward to each adapter, then `git.ts` and `validation.ts`, and wrote down everything that looked broken before changing anything.

## What did you choose to implement or fix?

In commit order:

- **validation.ts**: a failing validation command used to reject the promise and crash the whole report. Now every outcome (non-zero exit, missing binary, timeout, too much output) becomes a `status: "failed"` result with a note saying why. I also split commands into shell strings (CLI) vs argv arrays (MCP).
- **mcp-server.ts**: the tool schema declared `repo_path` but the handler read `input.repoPath`, so the MCP tool never actually worked. Made git failures come back as tool errors instead of crashing the server and capped validation output at 10k characters per command so a command can't flood the calling agent's context. Also added JSON output, since the `format` field already existed in the types but nothing used it.
- **cli.ts**: `--repo` paths with spaces were cut at the first space. Rewrote the arg parsing, added clear errors for unknown flags and missing values, made `--format json` actually write `review-report.json`, and made the CLI exit 1 if any validation fails so it can be used in CI.
- **git.ts**: renamed files were parsed wrong (a rename line has two paths: old and new). Also, a bad base ref now throws a clear error naming the ref instead of crashing with raw git stderr.

Each area got tests first, and I ran typecheck and the test suite before moving to the next one.

## What did you intentionally not do?

- The MCP tool always returns markdown; I didn't expose `format` in its input schema.
- No size cap on the changed-files list for huge diffs.

## Interface decision

- Decision: hybrid.
- Primary user and execution environment: a developer running the CLI locally; an AI agent calling the MCP tool over stdio.
- Trust boundary and allowed capabilities: the CLI trusts its user, `--validate` takes a shell string, same as typing it into a terminal. The MCP caller is semi-trusted: `validation_commands` only accepts argv arrays and runs through `execFile` with no shell, so shell metacharacters do nothing. There's a test proving `$HOME` doesn't expand.
- Reliability, discoverability, latency/context, and output tradeoffs: the CLI can write a file of any size and signal failure with exit codes; the MCP report goes into a model's context, so validation output is capped. For discoverability, the MCP schema describes itself (including the no-shell rule) and the CLI prints usage help.
- How supported interfaces remain consistent: both adapters call the same `reviewRepository()` in `core.ts` and render through the same report functions; nothing interface-specific lives in the core.
- Evidence that would change this decision: if nobody actually drives this from an agent, I'd drop MCP. If agents mostly want structured data, I'd make JSON the MCP default and expose `format` there.

## How did you use an AI coding agent?

I used Claude Code. I read the starter code myself first and made my own list of what looked broken, so I could check its findings against mine instead of trusting it blind. We worked one area at a time (validation, MCP, CLI, git) with tests written first, and I ran the checks and did the manual testing myself (the CLI by hand, the MCP server through MCP Inspector) before letting it move on. I also made every commit myself so each one was a state I had verified.

## Where did you check, correct, or reject an AI suggestion? (required)

- I manually checked all changes and asked about edits I was uncertain of or didn't understand. When the agent wanted to make large changes (new files, big blocks of code, etc.) I would push back and ask how necessary the change was, so I understood the logic behind it and could cut unnecessary boilerplate.
- The agent wanted to split the MCP server into two files (a server factory plus a small stdio entry) so tests could import it without side effects. That felt like too much structure for a ~70-line server, so I pushed back and we kept one file, with a check for whether it's being run directly so tests can still import it.
- Its first version of `validation.ts` typed the child-process error as `ExecException`, which doesn't cover `execFile` errors (`error.code` can be a string like `"ENOENT"`). `npm run typecheck` caught it, and the fix was widening the type to `ExecFileException` rather than casting around it.

## Commands used to verify the result, with outcomes

- `npm run typecheck` -> clean.
- `npm run build` -> clean, and `dist/cli.js` now exists at the path `package.json`'s `bin` points to (it didn't originally).
- `npm test` -> 28 tests passing across 5 files.
- `node dist/cli.js review --repo . --base-ref 67fbba7 --format json` -> wrote `review-report.json`, exit 0, and its file list matched `git diff --name-status 67fbba7...HEAD` by eye.
- Same command with `--validate "exit 1"` -> report still written, and exit code 1, so CI gating works instead of always returning 0.

## A blocker you hit and how you approached it

At one point `npm test` said 41 tests passed across 7 files, but I only had 4 test files. The extra ones were old compiled copies of my tests sitting in the `dist/` build folder, `npm run build` was compiling the test files along with the source code, and Vitest was running those copies too. That worried me, because an outdated copy could pass while the real test failed, so I stopped to figure it out before moving on.

The build config was compiling everything (`src/` and `test/`) into `dist/`. That also explained a second bug: `package.json` says the installed command lives at `dist/cli.js`, but the build actually put it at `dist/src/cli.js`, so the file it pointed to never existed. I fixed both by giving the build its own config (`tsconfig.build.json`) that only compiles `src/`, and telling Vitest (`vitest.config.ts`) to only look for tests in the `test/` folder. Then I deleted `dist/`, rebuilt, and checked that the test count was back to 28 and `dist/cli.js` was really there.

## Known limitations and the next three things you would do

1. Expose `format` (and maybe the output cap) in the MCP tool schema so agents can ask for JSON.
2. Cap the changed-files list for very large diffs with an "…and N more" line.
3. Add a subprocess test that runs the built `dist/cli.js` end to end.

## Approximate focused-work time

- Start: ~2:30 PM
- Finish: ~3:50 PM (about 80 minutes; the rest went to SUBMISSION.md write-up)