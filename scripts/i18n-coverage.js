/**
 * i18n coverage checker.
 *
 * Two jobs:
 *   1) HARDCODED STRINGS — scan the codebase for string literals / HTML text that
 *      look like user-facing prose but whose text is NOT present as a message value
 *      in `en/messages.json`. These are strings that should be consolidated into the
 *      locale file. Prints "All consolidated" when none are found.
 *   2) LOCALE COVERAGE — load the key names from `en/messages.json` and report what
 *      percentage of those keys each other locale file covers. A progress bar is shown
 *      while comparing each locale. With `-v`/`--verbose`, missing keys are printed
 *      one by one. Prints a confirmation when every locale is complete.
 *
 * Usage:
 *   node scripts/i18n-coverage.js              basic report
 *   node scripts/i18n-coverage.js -v           verbose (list missing keys per locale)
 *   node scripts/i18n-coverage.js --verbose    same as -v
 *   node scripts/i18n-coverage.js --logs       write output to logs/i18n-output.txt
 *
 * Exits non-zero if any hardcoded string is found or any locale is incomplete.
 */
import {
	readFileSync,
	readdirSync,
	statSync,
	writeFileSync,
	mkdirSync,
} from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const LOCALES_DIR = join(ROOT, '_locales');
const EN_FILE = join(ROOT, '_locales', 'en', 'messages.json');

// Directories to scan for hardcoded strings.
const SCAN_DIRS = ['background', 'content', 'popup', 'options', 'block', 'utils'];

const VERBOSE = process.argv.includes('-v') || process.argv.includes('--verbose');
const LOG_FILE = process.argv.includes('--logs');
const LOG_PATH = join(ROOT, 'logs', 'i18n-output.txt');

// Accumulate all output lines, then write once at the end if --logs.
const outputLines = [];

/**
 * Write a line to console and optionally buffer for log file.
 * @param {string} [line] - Text to output.
 * @returns {void}
 */
function logOutput(line = '') {
	console.log(line);
	if (LOG_FILE) outputLines.push(line);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Recursively collect files with a given extension under a directory.
 * @param {string} dir - Directory to scan.
 * @param {string} ext - File extension to match.
 * @param {string[]} [out] - Output array accumulating matches.
 * @returns {string[]} Matching file paths.
 */
function collectFiles(dir, ext, out = []) {
	let entries;
	try {
		entries = readdirSync(dir);
	} catch {
		return out;
	}
	for (const entry of entries) {
		const full = join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			collectFiles(full, ext, out);
		} else if (extname(full) === ext) {
			out.push(full);
		}
	}
	return out;
}

/**
 * Load a messages.json file, returning a Map of key -> message or null on error.
 * @param {string} file - Path to messages.json file.
 * @returns {Map<string, string> | null} Key to message map or null.
 */
function loadMessages(file) {
	try {
		const data = JSON.parse(readFileSync(file, 'utf8'));
		return new Map(Object.entries(data).map(([k, v]) => [k, v.message]));
	} catch (err) {
		console.error(`  ! Failed to read ${file}: ${err.message}`);
		return null;
	}
}

/**
 * Normalize a string for value comparison (trim + collapse whitespace).
 * @param {string} s - Input string.
 * @returns {string} Normalized string.
 */
function normalize(s) {
	return s.replace(/\s+/g, ' ').trim();
}

/* ------------------------------------------------------------------ */
/* 1) Hardcoded string detection                                       */
/* ------------------------------------------------------------------ */

/**
 * Check if a string contains HTML/SVG markup.
 * @param {string} s - String to check.
 * @returns {boolean} True if HTML/SVG markup is present.
 */
function containsMarkup(s) {
	return /<[a-zA-Z][^>]*>/.test(s);
}

/**
 * Extract only visible text content from an HTML/SVG string,
 * stripping all tags and their attributes.
 * @param {string} html - HTML string.
 * @returns {string} Extracted text.
 */
function extractTextFromMarkup(html) {
	// Remove <script> and <style> blocks
	let cleaned = html
		.replace(/<script[\s\S]*?<\/script>/gi, '')
		.replace(/<style[\s\S]*?<\/style>/gi, '');
	// Remove all tags (including self-closing SVG elements, etc.)
	cleaned = cleaned.replace(/<[^>]+>/g, ' ');
	// Collapse whitespace and trim
	const text = cleaned.replace(/\s+/g, ' ').trim();
	return text;
}

/**
 * Patterns that indicate a line is developer-only context. If a line matches
 * any of these, ALL string literals on that line are ignored.
 */
const DEV_LINE_PATTERNS = [
	// Logging / debugging
	/console\.\w+\s*\(/,
	/importScripts\s*\(/,
	// Chrome extension APIs (messaging, storage, alarms, etc.)
	/chrome\.\w+\.\w+/,
	// addEventListener / removeEventListener
	/addEventListener\s*\(/,
	/removeEventListener\s*\(/,
	// DOM query methods
	/querySelector(All)?\s*\(/,
	/getElementById\s*\(/,
	/getElementsBy\w+\s*\(/,
	/\.closest\s*\(/,
	/\.matches\s*\(/,
	/\.setAttribute\s*\(/,
	/\.getAttribute\s*\(/,
	/\.hasAttribute\s*\(/,
	/\.removeAttribute\s*\(/,
	/\.classList\.\w+\s*\(/,
	// Style assignments
	/\.style\.\w+\s*=/,
	/\.style\s*=\s*/,
	/\.className\s*=/,
	/\.cssText\s*=/,
	// dispatchEvent / CustomEvent
	/dispatchEvent\s*\(/,
	/new\s+CustomEvent\s*\(/,
	// URL / location
	/new\s+URL\s*\(/,
	/location\.\w+/,
	// JSON / storage
	/JSON\.(parse|stringify)\s*\(/,
	/localStorage\.\w+/,
	/sessionStorage\.\w+/,
	// Error construction
	/new\s+Error\s*\(/,
	/throw\s+/,
	// Import / require
	/^import\s+/,
	/require\s*\(/,
	// Switch case labels (the string is just a constant, not user-facing)
	/^\s*case\s+['"]/,
	// createElement / createElementNS
	/createElement\s*\(/,
	/createElementNS\s*\(/,
	// RegExp test/exec
	/\.test\s*\(/,
	/\.exec\s*\(/,
	/new\s+RegExp\s*\(/,
	// dataset / data attributes
	/\.dataset\.\w+/,
	/\.dataTransfer\.\w+/,
	// DOM manipulation (innerHTML/outerHTML are handled specially below)
	/\.insertAdjacentHTML\s*\(/,
];

/**
 * Check if a string is non-user-facing content (code, CSS, SVG, identifiers, etc.).
 * This checks the string VALUE, not the source context.
 * @param {string} s - Input string.
 * @returns {boolean} True if string is not user-facing.
 */
function isNonUserFacingString(s) {
	// 'use strict' directive
	if (s === 'use strict') return true;

	// No letters at all → not prose
	if (!/[a-zA-Z]/.test(s)) return true;

	// Too short to be meaningful (under 3 chars)
	if (s.length < 3) return true;

	// CSS var() references
	if (/^var\(--/.test(s)) return true;

	// CSS @-rules
	if (/^@(keyframes|media|import|font-face|supports|charset)\b/.test(s)) return true;

	// Media queries
	if (/^\([\w-]+\s*:/.test(s) && !s.includes(' is ')) return true;

	// CSS property values: things like "2px solid #f3f3f3", "opacity 0.3s ease", "12px 16px"
	// Heuristic: if more than half the "words" are CSS-like tokens, skip
	if (looksLikeCssValue(s)) return true;

	// CSS class name strings: space-separated kebab-case-like tokens
	if (looksLikeCssClassList(s)) return true;

	// SVG path data (starts with M/m followed by coords, or L/C/S/Q/A/Z commands)
	if (/^[Mm]\s*-?\d/.test(s) && /[LlCcSsQqAaZz]/.test(s)) return true;

	// Inline style assignments embedded in strings
	if (/\.\s*style\s*\.\s*\w+\s*=/.test(s)) return true;

	// Pure numbers, hex colors, CSS units
	if (/^[#]?[0-9a-fA-F.]+(%|px|em|rem|vh|vw|ms|s|deg)?$/.test(s)) return true;

	// camelCase identifiers (at least two segments: fooBar, fooBarBaz)
	if (/^[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*$/.test(s)) return true;

	// PascalCase compound identifiers (FooBarBaz)
	if (/^[A-Z][a-zA-Z0-9]*[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*$/.test(s)) return true;

	// ALL_CAPS_CONSTANTS
	if (/^[A-Z][A-Z0-9_]+$/.test(s)) return true;

	// snake_case identifiers
	if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(s)) return true;

	// kebab-case identifiers (single token: "rule-item", "btn-primary", "chart-point--selected")
	if (/^[a-z][a-z0-9]*(-+[a-z0-9]+)*$/.test(s) && !s.includes(' ')) return true;

	// Dot-path identifiers (object.property.chain)
	if (/^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)+$/.test(s)) return true;

	// CSS selectors (start with ., #, [, :, or contain attribute selectors/pseudo-classes)
	if (/^[.#[:]/.test(s) || /\[[^\]]*\]/.test(s) || /:[a-z-]+\(/.test(s)) return true;

	// File paths and URLs
	if (/^(https?:|\/|\.\/|\.\.\/)/.test(s)) return true;
	if (/\.\w{1,4}$/.test(s) && !s.includes(' ')) return true;

	// MIME types
	if (/^(text|application|image|audio|video)\//.test(s)) return true;

	// data-* attributes
	if (/^data-/.test(s)) return true;

	// Template literal fragments with placeholders
	if (s.includes('${')) return true;

	// Single word with no spaces, and shorter than 20 chars → almost never user-facing prose
	if (!s.includes(' ') && s.length < 20) return true;

	return false;
}

/**
 * Does this string look like a CSS value? (e.g. "2px solid #f3f3f3", "opacity 0.3s ease")
 * @param {string} s - Input string.
 * @returns {boolean} True if string matches CSS value patterns.
 */
function looksLikeCssValue(s) {
	const tokens = s.split(/\s+/);
	if (tokens.length === 0) return false;
	let cssTokenCount = 0;
	for (const t of tokens) {
		if (
			/^-?\d+(\.\d+)?(px|em|rem|vh|vw|%|s|ms|deg|ch|ex|in|cm|mm|pt|pc)?$/i.test(t) ||
			/^#[0-9a-fA-F]{3,8}$/.test(t) ||
			/^rgba?\(/.test(t) ||
			/^hsla?\(/.test(t) ||
			/^(solid|dashed|dotted|double|none|auto|inherit|initial|unset|normal|bold|italic|center|left|right|top|bottom|ease|ease-in|ease-out|ease-in-out|linear|infinite|forwards|backwards|both|alternate|block|inline|flex|grid|absolute|relative|fixed|sticky|hidden|visible|scroll|wrap|nowrap|pointer|border-box|content-box|padding-box|transparent|currentColor)$/i.test(t) ||
			/^(transform|opacity|margin|padding|border|background|color|font|width|height|display|position|overflow|transition|animation|z-index)$/i.test(t) ||
			/^(translateX?|translateY?|rotate|scale|skew|matrix|perspective)\(/.test(t) ||
			/^var\(--/.test(t)
		) {
			cssTokenCount++;
		}
	}
	// If most tokens look like CSS values, this is a CSS value string
	return tokens.length >= 2 && cssTokenCount / tokens.length >= 0.5;
}

/**
 * Does this string look like a CSS class list? (space-separated CSS class names)
 * e.g. "btn btn-primary btn-small", "rule-delete-btn icon-btn"
 * @param {string} s - Input string.
 * @returns {boolean} True if string matches CSS class list pattern.
 */
function looksLikeCssClassList(s) {
	const tokens = s.split(/\s+/);
	if (tokens.length < 2) return false;
	// Each token should look like a CSS class name (letters, digits, hyphens)
	return tokens.every((t) => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(t));
}

/**
 * Check if a source line is developer-only context (logging, API calls, etc.).
 * @param {string} line - Source code line.
 * @returns {boolean} True if line is developer context.
 */
function isDevOnlyLine(line) {
	for (const pattern of DEV_LINE_PATTERNS) {
		if (pattern.test(line)) return true;
	}
	return false;
}

/**
 * Extract user-facing string candidates from JS source.
 * Uses line-level context to skip strings inside console.log, chrome.*, etc.
 * For strings that contain HTML/SVG markup, extracts only visible text content.
 * @param {string} content - JavaScript source content.
 * @returns {string[]} Candidate user-facing strings.
 */
function extractJsUserStrings(content) {
	const strings = [];
	const lines = content.split('\n');

	for (const line of lines) {
		// Skip entirely dev-only lines
		if (isDevOnlyLine(line)) continue;

		const rawStrings = [];

		// Extract quoted strings from this line
		const quoted = /(['"])((?:\\[\s\S]|(?!\1)[^\\])*)\1/g;
		let m;
		while ((m = quoted.exec(line)) !== null) {
			rawStrings.push(m[2]);
		}

		// Non-interpolated template literals on a single line
		const tpl = /`([^`$]*)`/g;
		while ((m = tpl.exec(line)) !== null) {
			rawStrings.push(m[1]);
		}

		for (const raw of rawStrings) {
			// If the string contains HTML/SVG markup, extract only the text content
			if (containsMarkup(raw)) {
				const textContent = extractTextFromMarkup(raw);
				if (textContent) {
					// The extracted text might contain multiple fragments; split and check each
					// But first check the whole thing
					const n = normalize(textContent);
					if (n && !isNonUserFacingString(n)) {
						strings.push(n);
					}
				}
				continue;
			}

			const s = normalize(raw);
			if (s && !isNonUserFacingString(s)) {
				strings.push(s);
			}
		}
	}

	return strings;
}

/**
 * Extract visible text nodes from HTML (ignoring script/style/SVG/data-i18n elements).
 * @param {string} content - HTML content.
 * @returns {string[]} Extracted text strings.
 */
function extractHtmlText(content) {
    // Remove script, style, and SVG blocks entirely
    let cleaned = content
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
    
    // Remove elements with data-i18n or data-i18n-html attributes (they're already internationalized)
    // Use a regex that captures the tag name and matches the corresponding closing tag
    cleaned = cleaned.replace(/<([a-zA-Z]+)[^>]*data-i18n[^>]*>[\s\S]*?<\/\1>/gi, ' ');
    cleaned = cleaned.replace(/<[^>]*data-i18n[^>]*\/>/gi, ' ');
    
    const texts = [];
    const re = />([^<]+)</g;
    let m;
    while ((m = re.exec(cleaned)) !== null) {
        const t = m[1].trim();
        if (t && !isNonUserFacingString(t)) texts.push(t);
    }
    return texts;
}

/**
 * Find hardcoded strings in a file whose text is not a known message value.
 * @param {string} content - File content.
 * @param {Set<string>} knownValues - Set of known translated message values.
 * @param {boolean} isHtml - Whether content is HTML.
 * @returns {string[]} Array of unique hardcoded strings.
 */
function findHardcoded(content, knownValues, isHtml) {
	const candidates = isHtml
		? extractHtmlText(content)
		: extractJsUserStrings(content);

	const found = [];
	for (const s of candidates) {
		const n = normalize(s);
		if (!n) continue;
		if (knownValues.has(n)) continue;
		found.push(n);
	}
	return [...new Set(found)];
}

/* ------------------------------------------------------------------ */
/* 2) Locale coverage                                                  */
/* ------------------------------------------------------------------ */

/**
 * Render a coverage progress bar (0–100%).
 * @param {number} pct - Percentage coverage (0-100).
 * @returns {string} Colored progress bar string.
 */
function coverageBar(pct) {
	const w = 20;
	const filled = Math.round((w * pct) / 100);
	const bar = '█'.repeat(filled) + '░'.repeat(w - filled);
	const colorCode = process.stdout.isTTY ? (pct === 100 ? '\x1b[32m' : '\x1b[31m') : '';
	const resetCode = process.stdout.isTTY ? '\x1b[0m' : '';
	return `${colorCode}${bar}${resetCode} ${String(pct).padStart(3)}%`;
}

/**
 * Compare one locale against the en key list.
 * @param {string} locale - Locale code (e.g. 'es', 'fr').
 * @param {string[]} enKeys - Array of english keys to compare against.
 * @returns {{ locale: string, missing: string[], pct: number, covered: number, total: number, status: string }} Comparison result object.
 */
function checkLocale(locale, enKeys) {
	const file = join(LOCALES_DIR, locale, 'messages.json');
	const msgs = loadMessages(file);
	if (!msgs) return { locale, missing: enKeys, pct: 0, covered: 0, total: enKeys.length, status: 'incomplete' };

	const missing = [];
	const total = enKeys.length;
	for (const key of enKeys) {
		if (!msgs.has(key)) missing.push(key);
	}
	const covered = total - missing.length;
	const pct = total ? Math.round((covered / total) * 100) : 100;
	const status = covered === total ? 'complete' : 'incomplete';
	return { locale, missing, pct, covered, total, status };
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

const en = loadMessages(EN_FILE);
if (!en) {
	console.error('Cannot proceed without en/messages.json.');
	process.exit(1);
}

let exitCode = 0;

// Build the set of known message values (normalized) for the hardcoded check.
const knownValues = new Set([...en.values()].map(normalize));

// ---- Job 1: hardcoded strings ----
logOutput('\n=== 1) Hardcoded strings not in en/messages.json ===');
const hardcoded = new Map(); // file -> [strings]
for (const dir of SCAN_DIRS) {
	const dirPath = join(ROOT, dir);
	for (const file of [...collectFiles(dirPath, '.js'), ...collectFiles(dirPath, '.html')]) {
		const content = readFileSync(file, 'utf8');
		const isHtml = extname(file) === '.html';
		const found = findHardcoded(content, knownValues, isHtml);
		if (found.length) hardcoded.set(file.replace(ROOT, ''), found);
	}
}

if (hardcoded.size === 0) {
	logOutput('  All consolidated.');
} else {
	exitCode = 1;
	if (VERBOSE) {
		logOutput(`  Found ${hardcoded.size} file(s) with hardcoded strings:`);
		for (const [file, strings] of hardcoded) {
			logOutput(`    ${file}:`);
			for (const s of strings) logOutput(`      - ${s}`);
		}
	} else {
		logOutput(`  Found ${hardcoded.size} file(s) with hardcoded strings.`);
		let shownFiles = 0;
		for (const [file, strings] of hardcoded) {
			if (shownFiles >= 3) break;
			logOutput(`    ${file}:`);
			for (let i = 0; i < Math.min(strings.length, 2); i++) {
				logOutput(`      - ${strings[i]}`);
			}
			shownFiles++;
		}
		if (hardcoded.size > 3) {
			logOutput(`    ... (showing first 3 of ${hardcoded.size} files)`);
		}
	}
}

// ---- Job 2: locale coverage ----
const enKeys = [...en.keys()].sort();
const locales = readdirSync(LOCALES_DIR).filter((d) => d !== 'en');
logOutput(`\n=== 2) Locale coverage vs en (${enKeys.length} keys) ===`);

let allComplete = true;
const incompleteLocales = [];

for (const locale of locales) {
	const result = checkLocale(locale, enKeys);
	if (result.status === 'incomplete') {
		allComplete = false;
		incompleteLocales.push(result);
	}
	logOutput(`  ${locale}: ${coverageBar(result.pct)} ${result.covered}/${result.total} (${result.pct}%) — ${result.status}`);
}

if (allComplete) {
	logOutput('\n  All locales are complete.');
} else {
	logOutput(`\n  ${incompleteLocales.length} of ${locales.length} locale(s) incomplete.`);
	if (VERBOSE) {
		logOutput('  Missing keys per locale:');
		for (const r of incompleteLocales) {
			logOutput(`    ${r.locale}: ${r.missing.length} missing`);
			for (const k of r.missing) logOutput(`      - ${k}`);
		}
	} else {
		logOutput('  Use -v to list missing keys per locale (run: node scripts/i18n-coverage.js -v).');
	}
}

logOutput(`\nSummary: ${hardcoded.size} file(s) with hardcoded strings, ${locales.length} locale(s) checked.`);

// Write log file if --logs was passed
if (LOG_FILE && outputLines.length) {
	const logDir = join(ROOT, 'logs');
	mkdirSync(logDir, { recursive: true });
	writeFileSync(LOG_PATH, outputLines.join('\n') + '\n', 'utf8');
	console.log(`\nLog written to: ${LOG_PATH}`);
}

process.exit(exitCode);