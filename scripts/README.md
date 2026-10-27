# scripts/ — README

## Available npm scripts

| Script                   | Description                                                         |
| ------------------------ | ------------------------------------------------------------------- |
| `npm run lint`           | Run ESLint                                                          |
| `npm run format`         | Run Prettier                                                        |
| `npm run jsdoc`          | Generate JSDoc documentation                                        |
| `npm run i18n`           | Run the i18n coverage tool (see below)                              |
| `npm run check:manifest` | Validate manifest integrity (see below)                             |
| `npm run check:perms`    | Audit permissions vs actual `chrome.*` usage (see below)            |
| `npm run check`          | Run both audits (`check:manifest` + `check:perms`)                  |
| `npm test`               | Run unit tests (currently only pure functions; see `tests/` if any) |

## Running the manifest validator

Checks that every file `manifest.json` references actually exists (service worker, content scripts,
popup, options page, icons, web-accessible resources), that every `__MSG_key__` placeholder resolves
in the default locale, and that the structure is sane (version format, `default_locale`, Firefox
`gecko.id`, command descriptions, duplicate entries).

### Basic usage

```bash
npm run check:manifest
```

### Flags

| Flag     | Description                                      |
| -------- | ------------------------------------------------ |
| `-v`     | List every checked file/placeholder individually |
| `--logs` | Write output to `logs/manifest-output.txt`       |

### Interpreting the output

- Job 1: one line per missing file (`✗ Missing file (...): path`), plus a total count.
- Job 2: unresolved `__MSG_*__` placeholders are flagged against `_locales/en/messages.json`.
- Job 3: structural warnings, including a ⚠ for a missing `gecko.id` (needed for AMO builds).
- Exit `0` when all valid, `1` otherwise.

## Running the permissions auditor

Bilateral audit between `manifest.json` and the codebase:

- **Job 1 — declared-but-unused**: each `permissions` entry must have corresponding
  `chrome.<api>.*` usage in `background/`, `content/`, `popup/`, `options/`, `block/`, `utils/`.
  `activeTab` is special-cased (granted implicitly on action click, so it is never an error).
- **Job 2 — used-but-undeclared**: reverse check. Any permission-gated API used in source but
  missing from the manifest is flagged (this is a reviewer-blocking bug, e.g. `chrome.alarms`
  without `"alarms"`).
- **host_permissions** sanity: `<all_urls>` is checked against `content_scripts` matches
  (advisory only).

APIs known to need no permission (`chrome.runtime`, `chrome.i18n`, `chrome.action`,
`chrome.windows`, …) are classified explicitly; anything outside the classifier is reported as ⚠
for manual review rather than guessed.

### Basic usage

```bash
npm run check:perms
```

### Flags

| Flag     | Description                                              |
| -------- | -------------------------------------------------------- |
| `-v`     | Verify every permission with its usage sites (file:line) |
| `--logs` | Write output to `logs/permissions-output.txt`            |

Pass flags via `--` when using npm:

```bash
npm run check:perms -- -v
```

### Exit code

- `0` — every declaration is used and every gated API is declared
- `1` — unused permission(s) found or undeclared API usage found

## Running the i18n coverage tool

The coverage tool is the primary way to verify localization completeness and catch hardcoded strings.

### Basic usage

```bash
npm run i18n
```

### Flags

| Flag               | Description                                                                       |
| ------------------ | --------------------------------------------------------------------------------- |
| `-v` / `--verbose` | Show ALL files, ALL hardcoded strings, and ALL missing keys per locale (uncapped) |
| `--logs`           | Write output to `logs/i18n-output.txt` (also prints to console)                   |

Pass flags via `--` separator when using npm:

```bash
npm run i18n -- -v
npm run i18n -- --logs
npm run i18n -- -v --logs
```

Or run the script directly:

```bash
node scripts/i18n-coverage.js -v
node scripts/i18n-coverage.js --logs
```

> **Note**: `npm run i18n -v` does NOT work — npm intercepts `-v` as its own verbosity flag. Always use `npm run i18n -- -v`.

### What it does

**Job 1 — Hardcoded strings**: Scans `background/`, `content/`, `popup/`, `options/`, `block/`, `utils/` for `.js` and `.html` files. Extracts string literals and HTML text nodes, then filters out developer-only strings:

- Strings inside `console.*`, `chrome.*`, `querySelector`, `addEventListener`, `importScripts`, etc. calls are skipped (entire line context is checked)
- Code identifiers: camelCase, snake_case, ALL_CAPS, PascalCase, kebab-case, dot-paths
- CSS selectors, file paths, URLs, MIME types, hex colors, `'use strict'`
- Single words shorter than 20 characters (unlikely to be user-facing prose)

Any remaining string that doesn't match a known value in `en/messages.json` is flagged.

**Job 2 — Locale coverage**: For each non-`en` locale, compares its keys against `en/messages.json` and reports per-locale coverage with a progress bar.

### Exit code

- `0` — all strings consolidated and all locales 100% complete
- `1` — hardcoded strings found or locales incomplete

### Interpreting the output

**Regular mode** (`npm run i18n`):

- Section 1: `"All consolidated."` or `"Found X file(s)"` with first 3 files shown
- Section 2: Per-locale bar chart with covered/total counts
- Footer: Count of incomplete locales + a hint to use `-v`

**Verbose mode** (`npm run i18n -- -v`):

- Section 1: ALL files and ALL hardcoded strings listed
- Section 2: Same bar chart, plus every missing key listed per locale

**Log file mode** (`npm run i18n -- --logs`):

- Same output printed to console, additionally written to `logs/i18n-output.txt`
- Final line confirms log path

## Running tests

Currently there is **no test suite** (see `publish-ready-checklist.md` → Phase 7: ULTRA-minimal tests only for pure deterministic functions). If you add tests in `tests/`, run them with:

```bash
npm test
```

or

```bash
node --test tests/
```

No tests exist yet; the plan calls for an ULTRA-minimal suite covering only `TimeUtils`, `DomainUtils`, `mergeUsageData`, and `withUsageLock`.

## Notes

- The npm script is named **`i18n`** (not `i8n`). Typing `npm run i8n` will produce `npm error Missing script: "i8n"` — use `npm run i18n` instead.
- The tool is Node.js-based and requires no external dependencies (uses only Node built-ins: `fs`, `path`).
