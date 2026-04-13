'use strict';

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

            if (Number.isFinite(current) && Number.isFinite(next) && Math.abs(current - next) < 0.0001) {
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

    StorageManager.prototype.getStorageUsage = async function getStorageUsage() {
        if (chrome.storage.local.getBytesInUse) {
            return new Promise((resolve) => {
                chrome.storage.local.getBytesInUse(null, (bytes) => resolve(bytes));
            });
        }
        return 0;
    };

    StorageManager.prototype.getExportPayload = async function getExportPayload(ruleManager) {
        const usage = await this.getAllUsage();
        const settings = await this.getSettings();
        const blockList = await this.getBlockList();

        return {
            usage,
            settings,
            blockList,
            siteRules: ruleManager
                ? {
                    blocked: ruleManager.getBlockedDomains(),
                    restricted: ruleManager.getRestrictedDomains(),
                }
                : { blocked: [], restricted: [] },
            exportDate: new Date().toISOString(),
            version: chrome.runtime.getManifest().version,
        };
    };

}
