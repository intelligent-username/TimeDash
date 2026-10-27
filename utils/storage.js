'use strict';

/* global STORAGE_DEFAULT_SETTINGS, applyStorageSettingsMethods,
   applyStorageUsageMethods, applyStorageBlockingMethods,
   applyStorageMiscMethods */

let usageWriteChain = Promise.resolve();

function withUsageLock(task) {
    const result = usageWriteChain.then(() => task());
    usageWriteChain = result.catch(() => {});
    return result;
}

class StorageManager {
    constructor() {
        this.DEFAULT_SETTINGS = { ...STORAGE_DEFAULT_SETTINGS };

        // In-memory caches for hot-path reads (per-second tracking loop, badge,
        // access checks). The background SW is the primary writer; mutation
        // paths assign the cache directly after a successful write, and
        // chrome.storage.onChanged keeps it coherent with writers in other
        // contexts (options, popup, migrations, compact/clear).
        this.settingsCache = null;
        this.usageCache = null;

        try {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area !== 'local') return;
                if (changes.settings) {
                    this.settingsCache = changes.settings.newValue
                        ? { ...this.DEFAULT_SETTINGS, ...changes.settings.newValue }
                        : null;
                }
                if (changes.usage) {
                    this.usageCache = changes.usage.newValue || {};
                }
            });
        } catch {
            // Listener unavailable in this context; reads fall back to storage.
        }
    }
}

applyStorageSettingsMethods(StorageManager);
applyStorageUsageMethods(StorageManager);
applyStorageBlockingMethods(StorageManager);
applyStorageMiscMethods(StorageManager);
