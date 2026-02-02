'use strict';

/**
 * Centralized StorageManager class for managing all extension data
 * Provides consistent API for all storage operations with validation and error handling
 */
class StorageManager {
    constructor() {
        this.DEFAULT_SETTINGS = {
            defaultPlaybackSpeed: 1.0,
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
                'videoSpeeds',
            ]);

            if (!result.settings) {
                await this.setSettings(this.DEFAULT_SETTINGS);
            }

            if (!result.usage) {
                await chrome.storage.local.set({ usage: {} });
            }

            if (!result.blockList) {
                await chrome.storage.local.set({ blockList: [] });
            }

            if (!result.videoSpeeds) {
                await chrome.storage.local.set({ videoSpeeds: {} });
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
            const today = new Date().toISOString().split('T')[0];

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
     * Increment temporary access count for a domain
     * @param {string} domain - Domain to increment count for
     */
    async incrementTempAccessCount(domain) {
        try {
            const result = await chrome.storage.local.get('usage');
            const usage = result.usage || {};
            const item = usage[domain] || {
                cumulative: 0,
                lastVisit: Date.now(),
            };

            item.tempAccessCount = (item.tempAccessCount || 0) + 1;
            item.lastTempAccess = Date.now();

            usage[domain] = item;
            await chrome.storage.local.set({ usage });
            return true;
        } catch (error) {
            console.error('Failed to update temp access count:', error);
            return false;
        }
    }

    /**
     * Get video speed for a domain
     * @param {string} domain - Domain to get speed for
     * @returns {Promise<number>} Video speed
     */
    async getVideoSpeed(domain) {
        try {
            const result = await chrome.storage.local.get('videoSpeeds');
            const speeds = result.videoSpeeds || {};
            const settings = await this.getSettings();
            return speeds[domain] || settings.defaultPlaybackSpeed;
        } catch (error) {
            console.error('Failed to get video speed:', error);
            return 1.0;
        }
    }

    /**
     * Set video speed for a domain
     * @param {string} domain - Domain to set speed for
     * @param {number} speed - Video speed
     * @returns {Promise<boolean>} Success status
     */
    async setVideoSpeed(domain, speed) {
        try {
            const result = await chrome.storage.local.get('videoSpeeds');
            const speeds = result.videoSpeeds || {};
            speeds[domain] = speed;
            await chrome.storage.local.set({ videoSpeeds: speeds });
            return true;
        } catch (error) {
            console.error('Failed to set video speed:', error);
            return false;
        }
    }

    /**
     * Get all video speeds
     * @returns {Promise<Object>} All video speeds
     */
    async getVideoSpeeds() {
        try {
            const result = await chrome.storage.local.get('videoSpeeds');
            return result.videoSpeeds || {};
        } catch (error) {
            console.error('Failed to get video speeds:', error);
            return {};
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
