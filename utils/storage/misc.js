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

    StorageManager.prototype.exportDataAsCSV = async function exportDataAsCSV() {
        try {
            const usage = await this.getAllUsage();
            let csv = 'Domain,Date,Time Spent (seconds),Time Spent (formatted)\n';

            for (const [domain, data] of Object.entries(usage)) {
                for (const [date, timeSpent] of Object.entries(data)) {
                    if (!['cumulative', 'lastVisit', 'blockedToday', 'lastBlockDate'].includes(date)) {
                        csv += `${domain},${date},${timeSpent},${this.formatTime(timeSpent)}\n`;
                    }
                }
            }

            return csv;
        } catch (error) {
            console.error('Failed to export data:', error);
            return '';
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

    StorageManager.prototype.formatTime = function formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
        if (minutes > 0) return `${minutes}m ${secs}s`;
        return `${secs}s`;
    };
}
