# Contributing to SpotyCloud

Thanks for your interest in contributing. This document covers the ground rules.

## Before You Start

- Check [existing issues](https://github.com/aasm3535/SpotyCloud/issues) to avoid duplicates
- For large changes, open an issue first to discuss the approach
- Keep PRs focused — one feature or fix per pull request

## Development Setup

```bash
git clone https://github.com/aasm3535/SpotyCloud.git
cd SpotyCloud
bun install
bun run tauri dev
```

Requirements: Rust (stable), Bun (or Node 18+).

## Code Standards

- Run `bun run check` before submitting — zero errors required
- No `any` types in TypeScript unless absolutely unavoidable
- Follow the existing code style — no reformatting of unrelated code
- No unused imports, variables, or dead code
- Keep dependencies minimal — justify any new package in the PR description

## Commit Messages

Use clear, descriptive commit messages. Format:

```
type: short description

Optional longer explanation.
```

Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `style`, `test`

## Pull Requests

1. Fork the repo and create a branch from `master`
2. Name your branch descriptively: `feat/equalizer-presets`, `fix/playback-stall`
3. Make sure `bun run check` passes with zero errors
4. Write a clear PR description explaining what and why
5. Keep the diff small and reviewable — under 400 lines changed is ideal
6. Do not include unrelated changes, formatting fixes, or "while I was here" cleanups

## What Will Get Your PR Rejected

- Submitting AI-generated code dumps without understanding what they do
- PRs that break existing functionality
- Adding dependencies without justification
- Code that introduces security vulnerabilities (XSS, injection, etc.)
- Ignoring review feedback
- Force-pushing after review has started
- Changing code style or formatting across files you did not otherwise modify
- Adding features nobody asked for without prior discussion

## Reporting Bugs

Open an issue with:

- Steps to reproduce
- Expected vs actual behavior
- OS and app version
- Console errors if applicable

## Feature Requests

Open an issue describing:

- The problem you want to solve
- Your proposed solution
- Any alternatives you considered

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
