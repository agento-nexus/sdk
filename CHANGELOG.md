# Changelog

All notable changes to `@agento-nexus/sdk`. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [SemVer](https://semver.org/).

## [Unreleased]

### Added
- README quickstart and full CLI command table — every shipped command (`init`, `run`, `fleet`, `status`, `logs`, `destroy`) is now documented.
- README troubleshooting section covering E2B auth, Anthropic auth, network errors, and the legacy 0.1.0/0.1.1 import bug.
- CLI error diagnoser (`fmt.diagnose`) — pattern-matches common errors (E2B 401, Anthropic key missing, network) into a three-tier output (problem / fix / docs link). Falls back to the original error message when no pattern matches.
- `package.json` metadata: `homepage`, `bugs`, and `keywords` so npm surfaces support channels and discovery hints.
- This `CHANGELOG.md`.

### Changed
- Every CLI command's terminal error path now goes through `fmt.diagnose` instead of the bare `fmt.error(err.message)`. Surfaces fix guidance for the small set of errors we know how to actually help with.

## [0.1.2] — 2026-05-03

### Fixed
- **Build paths**: `tsup.config.ts` switched from array-form `entry` (which preserved source paths in `dist/` and emitted `dist/src/index.js`) to object-form (which emits flat `dist/index.js`). The previous output didn't match the `package.json` `main` / `types` / `exports` fields, so every `npm install @agento-nexus/sdk@0.1.0` or `@0.1.1` followed by `import` threw `ERR_MODULE_NOT_FOUND`. **0.1.0 and 0.1.1 are deprecated and unusable; upgrade to 0.1.2 or later.**
- **CLI `--version` drift**: `cli/index.ts` previously hardcoded `.version("0.1.0")`. Now reads from `package.json` at runtime so the CLI version stays in lockstep automatically.

## [0.1.1] — 2026-04-15 (broken — do not use)

Same as 0.1.0 — published with the same broken build paths. Use 0.1.2.

## [0.1.0] — 2026-03-21 (broken — do not use)

Initial scaffold migrated from R&D repo. Published with build-output paths that didn't match the manifest; the package fails to import. Use 0.1.2.
