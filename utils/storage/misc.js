'use strict';

/* global withUsageLock */

function applyStorageMiscMethods(StorageManager) {
    StorageManager.prototype.getCurrentSpeed = async function getCurrentSpeed() {
        try {
            const settings = await this.getSettings();
            return settings.currentPlaybackSpeed || 1.0;
        } catch (error) {
            console.error('Failed to get current speed:', error);
            return 1.0;
        }
    };

    StorageManager.prototype.setCurrentSpeed = async function setCurrentSpeed(speed) {
        try {
            const settings = await this.getSettings();
            const current = Number(settings.currentPlaybackSpeed);
            const next = Number(speed);

            if (
                Number.isFinite(current) &&
                Number.isFinite(next) &&
                Math.abs(current - next) < 0.0001
            ) {
                return true;
            }

            await this.setSettings({ currentPlaybackSpeed: speed });
            return true;
        } catch (error) {
            console.error('Failed to set current speed:', error);
            return false;
        }
    };

    StorageManager.prototype.clearAllData = async function clearAllData() {
        try {
            await chrome.storage.local.clear();
            await this.init();
            return true;
        } catch (error) {
            console.error('Failed to clear data:', error);
            return false;
        }
    };

    StorageManager.prototype.compactStorage = async function compactStorage() {
        return withUsageLock(async () => {
            try {
                const allData = await chrome.storage.local.get(null);
                if (!allData || Object.keys(allData).length === 0) return true;

                // Retain only valid production keys
                const cleanStorage = {};

                if (allData.settings && typeof allData.settings === 'object') {
                    cleanStorage.settings = allData.settings;
                }
                if (Array.isArray(allData.siteRules)) {
                    cleanStorage.siteRules = allData.siteRules;
                }
                if (Array.isArray(allData.siteGroups)) {
                    cleanStorage.siteGroups = allData.siteGroups;
                }
                if (Array.isArray(allData.blockList)) {
                    cleanStorage.blockList = allData.blockList;
                }
                if (allData.blockStats && typeof allData.blockStats === 'object') {
                    cleanStorage.blockStats = allData.blockStats;
                }
                if (allData.schemaVersion) {
                    cleanStorage.schemaVersion = allData.schemaVersion;
                }

                // Retain full usage object as-is without any pruning or mutation
                if (allData.usage !== undefined) {
                    cleanStorage.usage = allData.usage;
                }

                // Replace storage with purely clean dataset (removes transient alarm flags, temp keys)
                await chrome.storage.local.clear();
                await chrome.storage.local.set(cleanStorage);
                return true;
            } catch (error) {
                console.error('Failed to compact storage:', error);
                return false;
            }
        });
    };

    StorageManager.prototype.getStorageUsage = async function getStorageUsage() {
        if (chrome.storage.local.getBytesInUse) {
            try {
                const bytes = await new Promise((resolve) => {
                    chrome.storage.local.getBytesInUse(null, (b) => {
                        if (chrome.runtime.lastError) resolve(0);
                        else resolve(b || 0);
                    });
                });
                if (bytes > 0) return bytes;
            } catch {
                // fallback
            }
        }
        try {
            const all = await chrome.storage.local.get(null);
            const str = JSON.stringify(all || {});
            return new TextEncoder().encode(str).length;
        } catch {
            return 0;
        }
    };

    StorageManager.prototype.getExportPayload = async function getExportPayload(ruleManager) {
        const usage = await this.getAllUsage();
        const settings = await this.getSettings();
        const blockList = await this.getBlockList();
        const siteGroups = await this.getGroups();
        const blockStatsResult = await chrome.storage.local.get('blockStats');
        const blockStats = blockStatsResult.blockStats || {};

        let siteRules = { blocked: [], restricted: [] };
        if (ruleManager && ruleManager.rules) {
            for (const rule of ruleManager.rules.values()) {
                if (rule.type === 'BLOCKED') {
                    siteRules.blocked.push({
                        domain: rule.domain,
                        type: 'BLOCKED',
                        isEnabled: rule.isEnabled !== false,
                        createdAt: rule.createdAt || Date.now(),
                    });
                } else if (rule.type === 'RESTRICTED') {
                    siteRules.restricted.push({
                        domain: rule.domain,
                        type: 'RESTRICTED',
                        isEnabled: rule.isEnabled !== false,
                        timeLimitMinutes: rule.timeLimitMinutes ?? 30,
                        createdAt: rule.createdAt || Date.now(),
                    });
                }
            }
        } else {
            const rawRulesResult = await chrome.storage.local.get('siteRules');
            const rawRules = rawRulesResult.siteRules || [];
            siteRules = {
                blocked: rawRules.filter((r) => r.type === 'BLOCKED'),
                restricted: rawRules.filter((r) => r.type === 'RESTRICTED'),
            };
        }

        return {
            usage,
            settings,
            blockList,
            siteGroups,
            siteRules,
            blockStats,
            exportDate: new Date().toISOString(),
            version: chrome.runtime.getManifest().version,
        };
    };
}
