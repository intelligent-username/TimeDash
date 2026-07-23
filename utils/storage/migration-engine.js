'use strict';

/* global STORAGE_DEFAULT_SETTINGS */

/**
 * Schema migration engine for TimeDash.
 * Tracks schemaVersion in chrome.storage.local and runs missing migrations.
 * Each migration normalizes stored data to the current expected shape.
 * Version updates per step so partial states stay at a known version.
 */
class MigrationEngine {
    static LATEST_VERSION = 3;
    static STORAGE_KEY = 'schemaVersion';

    constructor() {
        this.migrations = new Map();
        this.registerMigrations();
    }

    registerMigrations() {
        this.migrations.set(2, this.migrateV2.bind(this));
        this.migrations.set(3, this.migrateV3.bind(this));
    }

    /**
     * Run pending migrations.
     * Reads current schemaVersion, runs each missing migration in order.
     * @returns {Promise<boolean>} True if migrations completed or already current
     */
    async run() {
        try {
            const data = await chrome.storage.local.get(MigrationEngine.STORAGE_KEY);
            const currentVersion = data[MigrationEngine.STORAGE_KEY] || 1;

            if (currentVersion >= MigrationEngine.LATEST_VERSION) {
                return true;
            }

            for (let v = currentVersion + 1; v <= MigrationEngine.LATEST_VERSION; v++) {
                const step = this.migrations.get(v);
                if (step) {
                    await step();
                    await chrome.storage.local.set({ [MigrationEngine.STORAGE_KEY]: v });
                }
            }

            return true;
        } catch (error) {
            console.error('MigrationEngine: run failed', error);
            return false;
        }
    }

    /**
     * V2: Normalize all existing storage keys to current expected shapes.
     * Handles settings, siteRules, usage, blockList, blockStats.
     */
    async migrateV2() {
        // Settings: merge stored settings with defaults
        const result = await chrome.storage.local.get([
            'settings',
            'siteRules',
            'usage',
            'blockList',
            'blockStats',
        ]);

        // settings
        if (result.settings) {
            const merged = { ...STORAGE_DEFAULT_SETTINGS, ...result.settings };
            // Ensure firstInstallDate is set
            if (merged.firstInstallDate === null || merged.firstInstallDate === undefined) {
                merged.firstInstallDate = Date.now();
            }
            await chrome.storage.local.set({ settings: merged });
        } else {
            await chrome.storage.local.set({ settings: { ...STORAGE_DEFAULT_SETTINGS } });
        }

        // siteRules
        if (Array.isArray(result.siteRules) && result.siteRules.length > 0) {
            const nowIso = new Date().toISOString();
            const updated = result.siteRules.map((rule) => ({
                domain: rule.domain || '',
                type: rule.type || 'RESTRICTED',
                isEnabled: rule.isEnabled !== undefined ? rule.isEnabled : true,
                createdAt: rule.createdAt || Date.now(),
                timeLimitMinutes: rule.timeLimitMinutes ?? 30,
                updatedAt: rule.updatedAt || nowIso,
                deletedAt: rule.deletedAt !== undefined ? rule.deletedAt : null,
                syncedAt: rule.syncedAt !== undefined ? rule.syncedAt : null,
            }));
            await chrome.storage.local.set({ siteRules: updated });
        }

        // usage per domain entries
        if (result.usage && typeof result.usage === 'object') {
            let changed = false;
            const usage = result.usage;
            for (const domainData of Object.values(usage)) {
                if (domainData && typeof domainData === 'object') {
                    if (domainData.cumulative === undefined) {
                        domainData.cumulative = 0;
                        changed = true;
                    }
                    if (domainData.cumulative_restricted === undefined) {
                        domainData.cumulative_restricted = 0;
                        changed = true;
                    }
                    if (domainData.cumulative_general === undefined) {
                        domainData.cumulative_general = 0;
                        changed = true;
                    }
                    if (domainData.lastVisit === undefined) {
                        domainData.lastVisit = Date.now();
                        changed = true;
                    }
                    if (domainData.blockedToday === undefined) {
                        domainData.blockedToday = 0;
                        changed = true;
                    }
                }
            }
            if (changed) {
                await chrome.storage.local.set({ usage });
            }
        }

        // blockList guard against corrupt non array
        if (result.blockList !== undefined && !Array.isArray(result.blockList)) {
            await chrome.storage.local.set({ blockList: [] });
        }

        // blockStats: ensure lastBlocked on each entry
        if (result.blockStats && typeof result.blockStats === 'object') {
            let statsChanged = false;
            const stats = result.blockStats;
            for (const entry of Object.values(stats)) {
                if (entry && typeof entry === 'object' && !entry.lastBlocked) {
                    entry.lastBlocked = new Date().toISOString();
                    statsChanged = true;
                }
            }
            if (statsChanged) {
                await chrome.storage.local.set({ blockStats: stats });
            }
        }
    }

    /**
     * V3: Seed siteGroups key with empty array if missing
     */
    async migrateV3() {
        const result = await chrome.storage.local.get('siteGroups');
        if (!result.siteGroups) {
            await chrome.storage.local.set({ siteGroups: [] });
        }
    }
}
