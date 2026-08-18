'use strict';

/* global withUsageLock */

function applyStorageUsageMethods(StorageManager) {
    StorageManager.prototype.getDomainUsage = async function getDomainUsage(domain) {
        try {
            const result = await chrome.storage.local.get('usage');
            return (result.usage && result.usage[domain]) || {};
        } catch (error) {
            console.error('Failed to get domain usage:', error);
            return {};
        }
    };

    StorageManager.prototype.getAllUsage = async function getAllUsage() {
        try {
            const result = await chrome.storage.local.get('usage');
            return result.usage || {};
        } catch (error) {
            console.error('Failed to get all usage:', error);
            return {};
        }
    };

    StorageManager.prototype.updateUsage = async function updateUsage(
        domain,
        timeSpent,
        usageType = 'GENERAL'
    ) {
        return withUsageLock(async () => {
            try {
                const usage = await this.getAllUsage();
                const now = new Date();
                const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

                if (!usage[domain]) {
                    usage[domain] = { cumulative: 0 };
                }

                if (!usage[domain][today]) {
                    usage[domain][today] = 0;
                }

                usage[domain][today] += timeSpent;
                usage[domain].cumulative += timeSpent;

                if (usageType === 'RESTRICTED') {
                    const restrictedKey = `${today}_restricted`;
                    usage[domain][restrictedKey] = (usage[domain][restrictedKey] || 0) + timeSpent;
                    usage[domain].cumulative_restricted =
                        (usage[domain].cumulative_restricted || 0) + timeSpent;
                } else {
                    const generalKey = `${today}_general`;
                    usage[domain][generalKey] = (usage[domain][generalKey] || 0) + timeSpent;
                    usage[domain].cumulative_general =
                        (usage[domain].cumulative_general || 0) + timeSpent;
                }

                await chrome.storage.local.set({ usage });
                return true;
            } catch (error) {
                console.error('Failed to update usage:', error);
                return false;
            }
        });
    };

    StorageManager.prototype.purgeOldData = async function purgeOldData(days) {
        return withUsageLock(async () => {
            if (!days || days < 1) return false;

            try {
                const usage = await this.getAllUsage();
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - days);
                const cutoffStr = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getDate()).padStart(2, '0')}`;

                let changed = false;
                for (const domainData of Object.values(usage)) {
                    for (const date of Object.keys(domainData)) {
                        if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date < cutoffStr) {
                            delete domainData[date];
                            changed = true;
                        }
                    }
                }

                if (changed) {
                    await chrome.storage.local.set({ usage });
                }

                return true;
            } catch (error) {
                console.error('Purge failed:', error);
                return false;
            }
        });
    };

    StorageManager.prototype.mergeUsageData = function mergeUsageData(existingUsage, importedUsage) {
        const merged = JSON.parse(JSON.stringify(existingUsage || {}));
        if (!importedUsage) return merged;

        for (const [domain, impData] of Object.entries(importedUsage)) {
            if (!merged[domain]) {
                merged[domain] = JSON.parse(JSON.stringify(impData));
                continue;
            }
            const cur = merged[domain];

            for (const [k, v] of Object.entries(impData)) {
                if (typeof v === 'number') {
                    if (/^\d{4}-\d{2}-\d{2}$/.test(k)) {
                        cur[k] = (cur[k] || 0) + v;
                    } else if (/^\d{4}-\d{2}-\d{2}_general$/.test(k)) {
                        cur[k] = (cur[k] || 0) + v;
                    } else if (/^\d{4}-\d{2}-\d{2}_restricted$/.test(k)) {
                        cur[k] = (cur[k] || 0) + v;
                    } else if (/^\d{4}-\d{2}-\d{2}_blocked$/.test(k)) {
                        cur[k] = (cur[k] || 0) + v;
                    } else if (k === 'blockedToday') {
                        cur[k] = (cur[k] || 0) + v;
                    }
                } else if (!(k in cur)) {
                    cur[k] = v;
                }
            }

            // Recalculate cumulative totals accurately from daily timestamps
            let totalGeneral = 0;
            let totalRestricted = 0;
            for (const [k, v] of Object.entries(cur)) {
                if (typeof v === 'number') {
                    if (/^\d{4}-\d{2}-\d{2}_general$/.test(k)) totalGeneral += v;
                    else if (/^\d{4}-\d{2}-\d{2}_restricted$/.test(k)) totalRestricted += v;
                }
            }

            if (totalGeneral > 0 || totalRestricted > 0) {
                cur.cumulative_general = totalGeneral;
                cur.cumulative_restricted = totalRestricted;
                cur.cumulative = totalGeneral + totalRestricted;
            } else {
                let dailySum = 0;
                for (const [k, v] of Object.entries(cur)) {
                    if (typeof v === 'number' && /^\d{4}-\d{2}-\d{2}$/.test(k)) {
                        dailySum += v;
                    }
                }
                cur.cumulative = dailySum;
            }
        }
        return merged;
    };

    StorageManager.prototype.importUsage = async function importUsage(importedUsage, mode) {
        return withUsageLock(async () => {
            try {
                const existing = await this.getAllUsage();
                const merged =
                    mode === 'replace'
                        ? importedUsage || {}
                        : this.mergeUsageData(existing, importedUsage);
                await chrome.storage.local.set({ usage: merged });
                return true;
            } catch (error) {
                console.error('Failed to import usage:', error);
                return false;
            }
        });
    };

    StorageManager.prototype.deleteDomainUsage = async function deleteDomainUsage(domain) {
        return withUsageLock(async () => {
            try {
                const usage = await this.getAllUsage();
                if (usage[domain]) {
                    delete usage[domain];
                    await chrome.storage.local.set({ usage });
                }
                return true;
            } catch (error) {
                console.error('Failed to delete domain usage:', error);
                return false;
            }
        });
    };
}
