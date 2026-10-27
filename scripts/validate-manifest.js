/**
 * Manifest validator.
 *
 * Jobs:
 *   1) INTEGRITY — every file the manifest references must exist on disk
 *      (background service worker, content scripts, popup, options page, icons,
 *      web-accessible resources).
 *   2) I18N PLACEHOLDERS — every `__MSG_key__` placeholder must resolve to a real
 *      key in `_locales/<default_locale>/messages.json`.
 *   3) STRUCTURE — version sanity, default_locale present, Firefox `gecko.id`
 *      present, and duplicate entries in content-script / reuse lists.
 *
 * Usage:
 *   node scripts/validate-manifest.js
 *   node scripts/validate-manifest.js --logs    write output to logs/manifest-output.txt
 *
 * Exits non-zero if any check fails.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const MANIFEST_FILE = join(ROOT, 'manifest.json');
const LOG_PATH = join(ROOT, 'logs', 'manifest-output.txt');

const LOG_FILE = process.argv.includes('--logs');
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

/**
 * Check if a file exists relative to the project root. Platform-independent.
 * @param {string} relPath - Manifest-style path using forward slashes.
 * @returns {boolean} True if the file exists.
 */
function fileExists(relPath) {
    return existsSync(join(ROOT, ...relPath.split('/')));
}

/**
 * Check if a referenced file exists, logging an error when missing.
 * @param {string} relPath - Path from the manifest.
 * @param {string} context - Where in the manifest it is referenced.
 * @returns {boolean} True when the file exists.
 */
function checkFile(relPath, context) {
    if (!fileExists(relPath)) {
        logOutput(`  ✗ Missing file (${context}): ${relPath}`);
        return false;
    }
    if (VERBOSE) logOutput(`  ✓ ${relPath}`);
    return true;
}

/**
 * Check that a filesystem path reference exists (absolute-safe variant of checkFile).
 * @param {string} path - Absolute or full path as written on disk.
 * @param {string} context - Where in the manifest it is referenced.
 * @returns {boolean} True when the file exists.
 */
function checkLocalFile(path, context) {
    if (!existsSync(path)) {
        logOutput(`  ✗ Missing file (${context}): ${path}`);
        return false;
    }
    if (VERBOSE) logOutput(`  ✓ ${path}`);
    return true;
}

/** @type {boolean} Verbose flag from CLI (-v/--verbose). */
const VERBOSE = process.argv.includes('-v') || process.argv.includes('--verbose');

let manifest;
try {
    manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8'));
} catch (err) {
    logOutput(`✗ manifest.json is not valid JSON: ${err.message}`);
    process.exit(1);
}

let failures = 0;

/* ------------------------------------------------------------------ */
/* Job 1 — Referenced files exist                                      */
/* ------------------------------------------------------------------ */

logOutput('');
logOutput('── Job 1: referenced files ─────────────────────────────');

let fileChecks = 0;

// Background service worker.
const entries = Array.isArray(manifest.background)
    ? manifest.background
    : [manifest.background].filter(Boolean);
for (const bgEntry of entries) {
    const sw = bgEntry && bgEntry.service_worker;
    if (typeof sw === 'string') {
        fileChecks++;
        if (!checkLocalFile(sw, 'background.service_worker')) failures++;
    }
}

// Content scripts (js + css).
for (const cs of manifest.content_scripts || []) {
    for (const js of [...(cs.js || []), ...(cs.css || [])]) {
        fileChecks++;
        if (!checkLocalFile(js, 'content_scripts')) failures++;
    }
    // Content script matches are required.
    if (!Array.isArray(cs.matches) || cs.matches.length === 0) {
        logOutput('  ✗ content_scripts entry has no "matches"');
        failures++;
    }
}

// Browser action popup + icon.
if (manifest.action) {
    if (manifest.action.default_popup) {
        fileChecks++;
        if (!checkFile(manifest.action.default_popup, 'action.default_popup')) failures++;
    }
    for (const icon of Object.values(manifest.action.default_icon || {})) {
        fileChecks++;
        if (!checkFile(icon, 'action.default_icon')) failures++;
    }
}

// Options page (options_page or options_ui.page).
const optionsPage = manifest.options_page || (manifest.options_ui && manifest.options_ui.page);
if (optionsPage) {
    fileChecks++;
    if (!checkFile(optionsPage, 'options page')) failures++;
}

// Top-level icons.
for (const icon of Object.values(manifest.icons || {})) {
    fileChecks++;
    if (!checkFile(icon, 'icons')) failures++;
}

// Web-accessible resources (MV3 object form; tolerate string form too).
const war = manifest.web_accessible_resources || [];
for (const warEntry of Array.isArray(war) ? war : [war]) {
    const resources = warEntry && warEntry.resources;
    if (!Array.isArray(resources)) continue;
    for (const res of resources) {
        fileChecks++;
        if (!checkFile(res, 'web_accessible_resources')) failures++;
    }
    if (Array.isArray(resources) && new Set(resources).size !== resources.length) {
        logOutput('  ✗ duplicate entries in web_accessible_resources');
        failures++;
    }
}

// Commands entries must have descriptions (store-review nitpick).
for (const [name, cmd] of Object.entries(manifest.commands || {})) {
    if (!cmd.description) {
        logOutput(`  ✗ command "${name}" has no description`);
        failures++;
    }
}

logOutput(`  files checked: ${fileChecks}`);

/* ------------------------------------------------------------------ */
/* Job 2 — i18n placeholders resolve                                    */
/* ------------------------------------------------------------------ */

logOutput('── Job 2: __MSG_*__ placeholders ───────────────────────');

/**
 * Recursively collect all `__MSG_key__` placeholders from parsed JSON values.
 * @param {unknown} node - Any JSON value.
 * @param {Set<string>} [out] - Accumulator.
 * @returns {Set<string>} Unique placeholder keys.
 */
function collectPlaceholders(node, out = new Set()) {
    if (typeof node === 'string') {
        for (const m of node.matchAll(/__MSG_([a-zA-Z0-9_@]+)__/g)) out.add(m[1]);
    } else if (Array.isArray(node)) {
        for (const item of node) collectPlaceholders(item, out);
    } else if (node && typeof node === 'object') {
        for (const value of Object.values(node)) collectPlaceholders(value, out);
    }
    return out;
}

// Deep-scan every string value in the manifest for placeholders.
const allPlaceholders = new Set();
for (const value of Object.values(manifest)) collectPlaceholders(value, allPlaceholders);

/** Check count shown in the icon summary. */
let placeholderChecks = 0;

const defaultLocale = manifest.default_locale;
if (!defaultLocale) {
    logOutput('  ✗ "default_locale" is missing');
    failures++;
} else {
    const enFile = join(ROOT, '_locales', defaultLocale, 'messages.json');
    let messages;
    try {
        const parsed = JSON.parse(readFileSync(enFile, 'utf8'));
        messages = new Set(Object.keys(parsed));
    } catch (err) {
        messages = null;
        logOutput(`  ✗ cannot read default locale messages (${enFile}): ${err.message}`);
        failures++;
    }
    if (messages) {
        for (const key of allPlaceholders) {
            placeholderChecks++;
            if (messages.has(key)) {
                if (VERBOSE) logOutput(`  ✓ ${key}`);
            } else {
                logOutput(
                    `  ✗ placeholder __MSG_${key}__ not found in ${defaultLocale}/messages.json`
                );
                failures++;
            }
        }
        logOutput(`  placeholders checked: ${placeholderChecks} (locale: ${defaultLocale})`);
    }
}

/* ------------------------------------------------------------------ */
/* Job 3 — structural sanity                                            */
/* ------------------------------------------------------------------ */

logOutput('── Job 3: structure ───────────────────────────────────');

// Version sanity (Chrome accepts 1–4 dot-separated integers).
if (typeof manifest.version !== 'string' || !/^\d+(\.\d+){1,3}$/.test(manifest.version)) {
    logOutput(
        `  ✗ invalid version value: ${JSON.stringify(manifest.version)} (expected 1–4 dot-separated integers, e.g. "1.3.9")`
    );
    failures++;
} else if (VERBOSE) {
    logOutput(`  ✓ version ${manifest.version}`);
}

// Firefox target metadata (this repo ships to AMO as well as the Chrome Web Store).
if (manifest.manifest_version === 3) {
    const gecko = manifest.browser_specific_settings && manifest.browser_specific_settings.gecko;
    if (!gecko || !gecko.id) {
        logOutput(
            '  ⚠ no browser_specific_settings.gecko.id — Firefox builds need a gecko id (add-on ID)'
        );
    } else if (VERBOSE) {
        logOutput(`  ✓ gecko id ${gecko.id}`);
    }
}

// Duplicates inside content_scripts js arrays cause double injection.
for (const cs of manifest.content_scripts || []) {
    const js = cs.js || [];
    if (new Set(js).size !== js.length) {
        logOutput('  ✗ duplicate js files in a content_scripts entry');
        failures++;
    }
}

/* ------------------------------------------------------------------ */
/* Summary                                                              */
/* ------------------------------------------------------------------ */

logOutput('───────────────────────────────────────────────────────');
if (failures === 0) {
    logOutput(
        `All valid. ${fileChecks} file ref(s), ${placeholderChecks} placeholder(s), structure OK.`
    );
} else {
    logOutput(`Found ${failures} problem(s). Run with -v for detail.`);
}

if (LOG_FILE) {
    mkdirSync(dirname(LOG_PATH), { recursive: true });
    writeFileSync(LOG_PATH, outputLines.join('\n') + '\n');
    console.log(`Log written to ${LOG_PATH}`);
}

process.exit(failures === 0 ? 0 : 1);
