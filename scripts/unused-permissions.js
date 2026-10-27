/**
 * Permissions auditor.
 *
 * Two jobs:
 *   1) DECLARED-BUT-UNUSED — every entry in manifest `permissions` is either
 *      exercised by a `chrome.<api>.*` call somewhere in the codebase, or is a
 *      special case (e.g. `activeTab` is implicit / cannot be verified statically).
 *   2) USED-BUT-UNDECLARED — reverse check: any `chrome.<api>.*` call whose API
 *      requires a permission that is NOT in the manifest. Least-privilege hygiene
 *      for Chrome Web Store / AMO review.
 *
 * Usage:
 *   node scripts/unused-permissions.js
 *   node scripts/unused-permissions.js -v        verbose (list every API usage site)
 *   node scripts/unused-permissions.js --logs    write output to logs/permissions-output.txt
 *
 * Exits non-zero if any issue is found.
 */
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const MANIFEST_FILE = join(ROOT, 'manifest.json');
const LOG_PATH = join(ROOT, 'logs', 'permissions-output.txt');

/** Directories to scan for `chrome.*` API usage (same set as i18n-coverage). */
const SCAN_DIRS = ['background', 'content', 'popup', 'options', 'block', 'utils'];

const VERBOSE = process.argv.includes('-v') || process.argv.includes('--verbose');
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
        const stats = statSync(full);
        if (stats.isDirectory()) {
            collectFiles(full, ext, out);
        } else if (extname(full) === ext) {
            out.push(full);
        }
    }
    return out;
}

/**
 * Map `chrome.<namespace>` usage to the manifest permission it requires.
 * APIs that need no permission maps to null. APIs used for the reverse check
 * (used-but-undeclared) are also keys here — anything NOT in this map that
 * shows up as `chrome.<ns>.` is reported as "unknown API, searched but unclassified".
 */
const API_PERMISSIONS = {
    storage: 'storage',
    tabs: 'tabs',
    scripting: 'scripting',
    webNavigation: 'webNavigation',
    alarms: 'alarms',
    notifications: 'notifications',
    action: null,
    runtime: null,
    i18n: null,
    commands: null,
    browserAction: null, // MV2 legacy; harmless to classify
    windows: null, // chrome.windows works without extra permission
    DOM: null,
    devtools: null,
};

/**
 * Classify a usage: 'permited-required' | 'permissionless' | 'unknown'.
 * @param {string} ns - chrome API namespace captured from source.
 * @returns {'requires-permission' | 'permissionless' | 'unknown'} Classification.
 */
function classify(ns) {
    if (ns in API_PERMISSIONS) {
        return API_PERMISSIONS[ns] ? 'requires-permission' : 'permissionless';
    }
    return 'unknown';
}

/* ------------------------------------------------------------------ */
/* Load manifest                                                        */
/* ------------------------------------------------------------------ */

let manifest;
try {
    manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8'));
} catch (err) {
    logOutput(`✗ manifest.json is not valid JSON: ${err.message}`);
    process.exit(1);
}

const declared = new Set(manifest.permissions || []);
const files = SCAN_DIRS.flatMap((dir) => collectFiles(join(ROOT, dir), '.js'));

/* ------------------------------------------------------------------ */
/* Job 1 & 2 — scan usage sites                                         */
/* ------------------------------------------------------------------ */

logOutput('');
logOutput(`── Scan: ${files.length} JS file(s) across ${SCAN_DIRS.length} dir(s) ─────`);

/**
 * API namespace -> [{ file, line }], and unknown API namespace -> same shape.
 * @type {Map<string, {file: string, line: number}[]>}
 */
const usage = new Map();

for (const file of files) {
    const rel = file.slice(ROOT.length + 1);
    let content;
    try {
        content = readFileSync(file, 'utf8');
    } catch {
        logOutput(`  ⚠ could not read ${rel}`);
        continue;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        for (const m of lines[i].matchAll(/chrome\.([A-Za-z]+)\s*\./g)) {
            // Skip chrome:// URL schemes and JS-style comments.
            if (lines[i].trim().startsWith('//')) continue;
            const ns = m[1];
            if (!usage.has(ns)) usage.set(ns, []);
            usage.get(ns).push({ file: rel, line: i + 1 });
        }
    }
}

const usedPermissionNames = new Map();
const undeclared = [];
const unknown = [];

for (const [ns, sites] of usage) {
    const kind = classify(ns);
    if (kind === 'permissionless') {
        if (VERBOSE) {
            logOutput(`  · chrome.${ns} (no permission needed) — ${sites.length} site(s)`);
        }
        continue;
    }
    if (kind === 'unknown') {
        unknown.push(ns);
        if (sites.length) {
            logOutput(
                `  ⚠ chrome.${ns} used ${sites.length}× but is outside the known classifier:`
            );
            for (const s of sites) logOutput(`      ${s.file}:${s.line}`);
        }
        continue;
    }
    const permissionName = API_PERMISSIONS[ns];
    usedPermissionNames.set(permissionName, sites);
}

for (const [permissionName, sites] of usedPermissionNames) {
    if (declared.has(permissionName)) {
        if (VERBOSE) {
            logOutput(`  ✓ "${permissionName}" (chrome usage: ${sites.length} site(s))`);
            for (const s of sites.slice(0, 10)) logOutput(`      ${s.file}:${s.line}`);
            if (sites.length > 10) logOutput(`      … +${sites.length - 10} more`);
        }
    } else {
        undeclared.push(permissionName);
        logOutput(
            `  ✗ chrome.${permissionName} is used but "${permissionName}" is NOT in manifest.permissions`
        );
        for (const s of sites) logOutput(`      ${s.file}:${s.line}`);
    }
}

/* ------------------------------------------------------------------ */
/* Job 1 — report declared-but-unused                                   */
/* ------------------------------------------------------------------ */

logOutput('── Job 1: declared permissions ────────────────────────');

let problems = 0;

for (const permissionName of declared) {
    if (permissionName === 'activeTab') {
        // activeTab is granted implicitly on user gesture (action click / context menu).
        // Static source scan can never prove or disprove it — report, never fail.
        logOutput(
            `  ⚠ "${permissionName}" — implicit (granted on action click); not statically verifiable, kept`
        );
        continue;
    }
    const used = usedPermissionNames.get(permissionName);
    if (used && used.length > 0) {
        if (VERBOSE) logOutput(`  ✓ "${permissionName}" — used in ${used.length} site(s)`);
    } else {
        logOutput(
            `  ✗ "${permissionName}" declared in manifest but no chrome.${permissionName}.* usage found`
        );
        problems += 1;
    }
}

logOutput('');
logOutput('── Job 2: used-but-undeclared APIs ────────────────────');

if (undeclared.length > 0) {
    logOutput(`  ✗ ${undeclared.length} API(s) used without a declared permission:`);
    for (const p of undeclared) logOutput(`      — "${p}"`);
    problems += undeclared.length;
} else {
    logOutput('  ✓ every permission-gated chrome.* call has its permission declared');
}

for (const ns of unknown) {
    logOutput(`  ⚠ chrome.${ns} could not be classified — review manually (may affect both jobs)`);
}

/* ------------------------------------------------------------------ */
/* host_permissions sanity (advisory)                                   */
/* ------------------------------------------------------------------ */

logOutput('── host_permissions ───────────────────────────────────');

const hostPermissions = manifest.host_permissions || [];
const contentScriptsNeedsAllUrls = (manifest.content_scripts || []).some((cs) =>
    (cs.matches || []).includes('<all_urls>')
);
if (hostPermissions.includes('<all_urls>')) {
    if (contentScriptsNeedsAllUrls) {
        if (VERBOSE) logOutput('  ✓ <all_urls> justified by content_scripts matches');
    } else {
        // Advisory only — chrome.scripting against arbitrary hosts would also justify it.
        logOutput('  ⚠ <all_urls> declared but no content_scripts entry matches <all_urls>');
    }
} else if (hostPermissions.length === 0) {
    logOutput('  · no host_permissions declared');
}

/* ------------------------------------------------------------------ */
/* Summary                                                              */
/* ------------------------------------------------------------------ */

logOutput('───────────────────────────────────────────────────────');
if (problems === 0) {
    logOutput(
        `All accounted for. ${declared.size} declaration(s), ${usedPermissionNames.size} gated API(s) in use.`
    );
} else {
    logOutput(`Found ${problems} issue(s). Check permissions vs source or vice versa.`);
}

if (LOG_FILE) {
    mkdirSync(dirname(LOG_PATH), { recursive: true });
    writeFileSync(LOG_PATH, outputLines.join('\n') + '\n');
    console.log(`Log written to ${LOG_PATH}`);
}

process.exit(problems === 0 ? 0 : 1);
