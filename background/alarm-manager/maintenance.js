'use strict';

function applyAlarmMaintenanceMethods(AlarmManager) {
    AlarmManager.prototype.cleanupOldUsageData = async function cleanupOldUsageData() {
        const usage = await chrome.storage.local.get('usage');
        const usageData = usage.usage || {};
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 90);
        const cutoffStr = this.getLocalDateString(cutoffDate);

        let cleaned = false;

        for (const domainData of Object.values(usageData)) {
            for (const date of Object.keys(domainData)) {
                if (date !== 'cumulative' && date < cutoffStr) {
                    delete domainData[date];
                    cleaned = true;
                }
            }
        }

        if (cleaned) {
            await chrome.storage.local.set({ usage: usageData });
            console.log('Cleaned up old usage data');
        }
    };

    AlarmManager.prototype.cleanupOldBlockStats = async function cleanupOldBlockStats() {
        const stats = await chrome.storage.local.get('blockStats');
        const blockStats = stats.blockStats || {};
        const cutoffDate = new Date();
        cutoffDate.setTime(cutoffDate.getTime() - 30 * 24 * 60 * 60 * 1000);

        let cleaned = false;

        for (const [domain, domainStats] of Object.entries(blockStats)) {
            if (domainStats.lastBlocked && new Date(domainStats.lastBlocked) < cutoffDate) {
                delete blockStats[domain];
                cleaned = true;
            }
        }

        if (cleaned) {
            await chrome.storage.local.set({ blockStats });
            console.log('Cleaned up old block statistics');
        }
    };

    AlarmManager.prototype.createBackupData = async function createBackupData() {
        const data = await chrome.storage.local.get();
        return {
            timestamp: new Date().toISOString(),
            version: chrome.runtime.getManifest().version,
            data,
        };
    };

    AlarmManager.prototype.storeBackup = async function storeBackup(backupData) {
        const backups = await chrome.storage.local.get('backups');
        const existingBackups = backups.backups || [];

        existingBackups.push(backupData);
        if (existingBackups.length > 7) {
            existingBackups.shift();
        }

        await chrome.storage.local.set({ backups: existingBackups });
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { applyAlarmMaintenanceMethods };
}
