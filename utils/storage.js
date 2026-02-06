'use strict';

/**
 * Centralized StorageManager class for managing all extension data
 * Provides consistent API for all storage operations with validation and error handling
 */
class StorageManager {
    constructor() {
        this.DEFAULT_SETTINGS = {
            currentPlaybackSpeed: 1.0,  // Universal speed for all videos
            maxPlaybackSpeed: 16.0,
            speedStep: 0.25,
            increaseSpeedKey: 'Plus',
            decreaseSpeedKey: 'Minus',
            dailyTimeLimitMinutes: 0, // 0 = no limit
            theme: 'auto',
            keyboardShortcutsEnabled: true,
            notificationsEnabled: true,
            exportFormat: 'csv',
            trackingEnabled: true,
            showSpeedOverlay: true,
            firstTimeSetup: true,
            whitelist: [],
            autoPurgeEnabled: false,
            autoPurgeDays: 30,
        };

        this.init();
    }

    /**
     * Initialize storage with default values if not present
     */
    async init() {
        try {
            const result = await chrome.storage.local.get([
                'settings',
                'usage',
                'blockList',
            ]);

            if (!result.settings) {
                await this.setSettings(this.DEFAULT_SETTINGS);
            } else {
                // Migration: rename defaultPlaybackSpeed to currentPlaybackSpeed
                if (result.settings.defaultPlaybackSpeed !== undefined &&
                    result.settings.currentPlaybackSpeed === undefined) {
                    result.settings.currentPlaybackSpeed = result.settings.defaultPlaybackSpeed;
                    delete result.settings.defaultPlaybackSpeed;
                    await this.setSettings(result.settings);
                }
            }

            if (!result.usage) {
                await chrome.storage.local.set({ usage: {} });
            }

            if (!result.blockList) {
                await chrome.storage.local.set({ blockList: [] });
            }
        } catch (error) {
            console.error('StorageManager initialization failed:', error);
        }
    }

    /**
     * Get current settings
     * @returns {Promise<Object>} Current settings object
     */
    async getSettings() {
        try {
            const result = await chrome.storage.local.get('settings');
            return { ...this.DEFAULT_SETTINGS, ...result.settings };
        } catch (error) {
            console.error('Failed to get settings:', error);
            return this.DEFAULT_SETTINGS;
        }
    }

    /**
     * Update settings
     * @param {Object} newSettings - Settings to update
     * @returns {Promise<boolean>} Success status
     */
    async setSettings(newSettings) {
        try {
            const currentSettings = await this.getSettings();
            const updatedSettings = { ...currentSettings, ...newSettings };
            await chrome.storage.local.set({ settings: updatedSettings });
            return true;
        } catch (error) {
            console.error('Failed to set settings:', error);
            return false;
        }
    }

    /**
     * Reset settings to default values
     * @returns {Promise<boolean>} Success status
     */
    async resetSettings() {
        try {
            await this.setSettings(this.DEFAULT_SETTINGS);
            return true;
        } catch (error) {
            console.error('Failed to reset settings:', error);
            return false;
        }
    }

    /**
     * Save settings to storage
     * @param {Object} settings - Settings to save
     * @returns {Promise<boolean>} Success status
     */
    async saveSettings(settings) {
        try {
            await this.setSettings(settings);
            return true;
        } catch (error) {
            console.error('Failed to save settings:', error);
            return false;
        }
    }

    /**
     * Get usage data for a specific domain
     * @param {string} domain - Domain to get usage for
     * @returns {Promise<Object>} Usage data for domain
     */
    async getDomainUsage(domain) {
        try {
            const result = await chrome.storage.local.get('usage');
            return result.usage[domain] || {};
        } catch (error) {
            console.error('Failed to get domain usage:', error);
            return {};
        }
    }

    /**
     * Get all usage data
     * @returns {Promise<Object>} All usage data
     */
    async getAllUsage() {
        try {
            const result = await chrome.storage.local.get('usage');
            return result.usage || {};
        } catch (error) {
            console.error('Failed to get all usage:', error);
            return {};
        }
    }

    /**
     * Update usage time for a domain
     * @param {string} domain - Domain to update
     * @param {number} timeSpent - Time spent in seconds
     * @returns {Promise<boolean>} Success status
     */
    async updateUsage(domain, timeSpent, usageType = 'GENERAL') {
        try {
            const usage = await this.getAllUsage();
            // Use LOCAL date for daily tracking (resets at user's midnight)
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            if (!usage[domain]) {
                usage[domain] = { cumulative: 0 };
            }

            if (!usage[domain][today]) {
                usage[domain][today] = 0;
            }

            // Update total daily and cumulative
            usage[domain][today] += timeSpent;
            usage[domain].cumulative += timeSpent;

            // Updated segmented data
            if (usageType === 'RESTRICTED') {
                const restrictedKey = `${today}_restricted`;
                const cumulativeRestrictedKey = 'cumulative_restricted';

                usage[domain][restrictedKey] = (usage[domain][restrictedKey] || 0) + timeSpent;
                usage[domain][cumulativeRestrictedKey] = (usage[domain][cumulativeRestrictedKey] || 0) + timeSpent;
            } else {
                const generalKey = `${today}_general`;
                const cumulativeGeneralKey = 'cumulative_general';

                usage[domain][generalKey] = (usage[domain][generalKey] || 0) + timeSpent;
                usage[domain][cumulativeGeneralKey] = (usage[domain][cumulativeGeneralKey] || 0) + timeSpent;
            }

            await chrome.storage.local.set({ usage });
            return true;
        } catch (error) {
            console.error('Failed to update usage:', error);
            return false;
        }
    }

    /**
     * Get block list
     * @returns {Promise<Array>} Array of blocked domains
     */
    async getBlockList() {
        try {
            const result = await chrome.storage.local.get('blockList');
            return result.blockList || [];
        } catch (error) {
            console.error('Failed to get block list:', error);
            return [];
        }
    }

    /**
     * Add domain to block list
     * @param {string} domain - Domain to block
     * @returns {Promise<boolean>} Success status
     */
    async addToBlockList(domain) {
        try {
            const blockList = await this.getBlockList();
            if (!blockList.includes(domain)) {
                blockList.push(domain);
                await chrome.storage.local.set({ blockList });
            }
            return true;
        } catch (error) {
            console.error('Failed to add to block list:', error);
            return false;
        }
    }

    /**
     * Remove domain from block list
     * @param {string} domain - Domain to unblock
     * @returns {Promise<boolean>} Success status
     */
    async removeFromBlockList(domain) {
        try {
            const blockList = await this.getBlockList();
            const updatedList = blockList.filter((d) => d !== domain);
            await chrome.storage.local.set({ blockList: updatedList });
            return true;
        } catch (error) {
            console.error('Failed to remove from block list:', error);
            return false;
        }
    }

    /**
     * Increment block count for a domain
     * @param {string} domain - Domain to increment block count for
     */
    async incrementBlockCount(domain) {
        try {
            const result = await chrome.storage.local.get('usage');
            const usage = result.usage || {};
            const domainUsage = usage[domain] || {
                cumulative: 0,
                lastVisit: Date.now(),
            };

            const today = new Date().toDateString();
            if (domainUsage.lastBlockDate !== today) {
                domainUsage.blockedToday = 0;
                domainUsage.lastBlockDate = today;
            }

            domainUsage.blockedToday = (domainUsage.blockedToday || 0) + 1;

            usage[domain] = domainUsage;
            await chrome.storage.local.set({ usage });
            return true;
        } catch (error) {
            console.error('Failed to update block count:', error);
            return false;
        }
    }

    /**
     * Get universal playback speed
     * @returns {Promise<number>} Current playback speed
     */
    async getCurrentSpeed() {
        try {
            const settings = await this.getSettings();
            return settings.currentPlaybackSpeed || 1.0;
        } catch (error) {
            console.error('Failed to get current speed:', error);
            return 1.0;
        }
    }

    /**
     * Set universal playback speed
     * @param {number} speed - Playback speed
     * @returns {Promise<boolean>} Success status
     */
    async setCurrentSpeed(speed) {
        try {
            await this.setSettings({ currentPlaybackSpeed: speed });
            return true;
        } catch (error) {
            console.error('Failed to set current speed:', error);
            return false;
        }
    }

    /**
     * Export all data as CSV
     * @returns {Promise<string>} CSV formatted data
     */
    async exportDataAsCSV() {
        try {
            const usage = await this.getAllUsage();
            let csv = 'Domain,Date,Time Spent (seconds),Time Spent (formatted)\n';

            for (const [domain, data] of Object.entries(usage)) {
                for (const [date, timeSpent] of Object.entries(data)) {
                    if (date !== 'cumulative' && date !== 'lastVisit' && date !== 'blockedToday' && date !== 'lastBlockDate') {
                        const formatted = this.formatTime(timeSpent);
                        csv += `${domain},${date},${timeSpent},${formatted}\n`;
                    }
                }
            }

            return csv;
        } catch (error) {
            console.error('Failed to export data:', error);
            return '';
        }
    }

    /**
     * Clear all data
     * @returns {Promise<boolean>} Success status
     */
    async clearAllData() {
        try {
            await chrome.storage.local.clear();
            await this.init();
            return true;
        } catch (error) {
            console.error('Failed to clear data:', error);
            return false;
        }
    }

    /**
     * Get storage bytes in use
     * @returns {Promise<number>} Bytes used
     */
    async getStorageUsage() {
        if (chrome.storage.local.getBytesInUse) {
            return new Promise((resolve) => {
                chrome.storage.local.getBytesInUse(null, (bytes) => resolve(bytes));
            });
        }
        return 0;
    }

    /**
     * Purge data older than X days
     * @param {number} days 
     */
    async purgeOldData(days) {
        if (!days || days < 1) return false;
        try {
            const usage = await this.getAllUsage();
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            // Simple string comparison works for YYYY-MM-DD
            const cutoffStr = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getDate()).padStart(2, '0')}`;

            let changed = false;
            for (const domain in usage) {
                const domainData = usage[domain];
                for (const date in domainData) {
                    // Check if key is a date format YYYY-MM-DD
                    if (date.match(/^\d{4}-\d{2}-\d{2}$/) && date < cutoffStr) {
                        delete domainData[date];
                        changed = true;
                    }
                }
            }

            if (changed) {
                await chrome.storage.local.set({ usage });
            }
            return true;
        } catch (e) {
            console.error('Purge failed:', e);
            return false;
        }
    }

    /**
     * Format time in seconds to readable format
     * @param {number} seconds - Time in seconds
     * @returns {string} Formatted time string
     */
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
}
