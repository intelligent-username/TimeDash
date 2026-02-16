'use strict';

/**
 * Alarm manager for handling scheduled tasks
 * Manages daily resets, quota checks, and periodic maintenance
 */
class AlarmManager {
    constructor() {
        this.ALARM_NAMES = {
            DAILY_RESET: 'daily-reset',
            QUOTA_CHECK: 'quota-check',
            CLEANUP: 'cleanup',
            BACKUP: 'backup',
        };

        this.init();
    }

    /**
     * Get current date as YYYY-MM-DD in LOCAL timezone
     * @param {Date} date - Optional date object, defaults to now
     * @returns {string} Local date string
     */
    getLocalDateString(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Initialize alarm manager
     */
    async init() {
        await this.setupAlarms();
        this.setupAlarmListeners();
        console.log('Alarm Manager initialized');
    }

    /**
     * Set up all necessary alarms
     */
    async setupAlarms() {
        // Daily reset at midnight
        await this.createDailyResetAlarm();

        // Quota check every 30 minutes
        await this.createQuotaCheckAlarm();

        // Cleanup expired data every 6 hours
        await this.createCleanupAlarm();

        // Backup data daily at 2 AM
        await this.createBackupAlarm();
    }

    /**
     * Set up alarm event listeners
     */
    setupAlarmListeners() {
        chrome.alarms.onAlarm.addListener((alarm) => {
            this.handleAlarm(alarm);
        });
    }

    /**
     * Create daily reset alarm
     */
    async createDailyResetAlarm() {
        const nextMidnight = this.getNextMidnight();

        await chrome.alarms.create(this.ALARM_NAMES.DAILY_RESET, {
            when: nextMidnight,
            periodInMinutes: 24 * 60, // Every 24 hours
        });

        console.log(`Daily reset alarm set for: ${new Date(nextMidnight)}`);
    }

    /**
     * Create quota check alarm
     */
    async createQuotaCheckAlarm() {
        await chrome.alarms.create(this.ALARM_NAMES.QUOTA_CHECK, {
            delayInMinutes: 1, // Start in 1 minute
            periodInMinutes: 30, // Every 30 minutes
        });
    }

    /**
     * Create cleanup alarm
     */
    async createCleanupAlarm() {
        await chrome.alarms.create(this.ALARM_NAMES.CLEANUP, {
            delayInMinutes: 30, // Start in 30 minutes
            periodInMinutes: 6 * 60, // Every 6 hours
        });
    }

    /**
     * Create backup alarm
     */
    async createBackupAlarm() {
        const next2AM = this.getNext2AM();

        await chrome.alarms.create(this.ALARM_NAMES.BACKUP, {
            when: next2AM,
            periodInMinutes: 24 * 60, // Every 24 hours
        });
    }

    /**
     * Handle alarm events
     * @param {Object} alarm - Chrome alarm object
     */
    async handleAlarm(alarm) {
        try {
            switch (alarm.name) {
                case this.ALARM_NAMES.DAILY_RESET:
                    await this.handleDailyReset();
                    break;

                case this.ALARM_NAMES.QUOTA_CHECK:
                    await this.handleQuotaCheck();
                    break;

                case this.ALARM_NAMES.CLEANUP:
                    await this.handleCleanup();
                    break;

                case this.ALARM_NAMES.BACKUP:
                    await this.handleBackup();
                    break;

                default:
                    console.log(`Unknown alarm: ${alarm.name}`);
            }
        } catch (error) {
            console.error(`Error handling alarm ${alarm.name}:`, error);
        }
    }

    /**
     * Handle daily reset - clean up daily stats, reset counters
     */
    async handleDailyReset() {
        console.log('Executing daily reset...');

        try {
            // Clear daily notification flags if any
            await chrome.storage.local.remove(['dailyNotificationsSent']);

            // Reset daily quota warnings
            await chrome.storage.local.remove(['quotaWarningsSent']);



            // Send daily summary notification if enabled
            await this.sendDailySummaryNotification();

            console.log('Daily reset completed successfully');
        } catch (error) {
            console.error('Error during daily reset:', error);
        }
    }

    /**
     * Handle quota check - check if users are approaching daily limits
     */
    async handleQuotaCheck() {
        try {
            const settings = await chrome.storage.local.get('settings');
            const userSettings = settings.settings || {};

            if (!userSettings.notificationsEnabled || !userSettings.dailyTimeLimitMinutes) {
                return; // No notifications or no limit set
            }

            const usage = await chrome.storage.local.get('usage');
            const usageData = usage.usage || {};
            const today = this.getLocalDateString();
            const dailyLimitSeconds = userSettings.dailyTimeLimitMinutes * 60;

            let totalTodayUsage = 0;
            for (const [domain, domainData] of Object.entries(usageData)) {
                totalTodayUsage += domainData[today] || 0;
            }

            const usagePercentage = (totalTodayUsage / dailyLimitSeconds) * 100;

            // Check if we should send warnings
            await this.checkAndSendQuotaWarnings(
                totalTodayUsage,
                dailyLimitSeconds,
                usagePercentage
            );
        } catch (error) {
            console.error('Error during quota check:', error);
        }
    }

    /**
     * Handle cleanup - remove old data, optimize storage
     */
    async handleCleanup() {
        console.log('Executing cleanup...');

        try {
            // Clean up old usage data (older than 90 days)
            await this.cleanupOldUsageData();


            // Clean up old block statistics
            await this.cleanupOldBlockStats();

            console.log('Cleanup completed successfully');
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }

    /**
     * Handle backup - create backup of important data
     */
    async handleBackup() {
        console.log('Executing backup...');

        try {
            const backupData = await this.createBackupData();
            await this.storeBackup(backupData);

            console.log('Backup completed successfully');
        } catch (error) {
            console.error('Error during backup:', error);
        }
    }

    /**
     * Check and send quota warnings
     * @param {number} totalUsage - Total usage today in seconds
     * @param {number} dailyLimit - Daily limit in seconds
     * @param {number} percentage - Usage percentage
     */
    async checkAndSendQuotaWarnings(totalUsage, dailyLimit, percentage) {
        const warnings = await chrome.storage.local.get('quotaWarningsSent');
        const sentWarnings = warnings.quotaWarningsSent || {};
        const today = this.getLocalDateString();

        if (!sentWarnings[today]) {
            sentWarnings[today] = [];
        }

        // 75% warning
        if (percentage >= 75 && !sentWarnings[today].includes('75')) {
            await this.sendQuotaWarning(75, totalUsage, dailyLimit);
            sentWarnings[today].push('75');
        }

        // 90% warning
        if (percentage >= 90 && !sentWarnings[today].includes('90')) {
            await this.sendQuotaWarning(90, totalUsage, dailyLimit);
            sentWarnings[today].push('90');
        }

        // 100% warning (limit exceeded)
        if (percentage >= 100 && !sentWarnings[today].includes('100')) {
            await this.sendQuotaWarning(100, totalUsage, dailyLimit);
            sentWarnings[today].push('100');
        }

        await chrome.storage.local.set({ quotaWarningsSent: sentWarnings });
    }

    /**
     * Send quota warning notification
     * @param {number} percentage - Usage percentage
     * @param {number} totalUsage - Total usage in seconds
     * @param {number} dailyLimit - Daily limit in seconds
     */
    async sendQuotaWarning(percentage, totalUsage, dailyLimit) {
        const title = percentage >= 100 ? 'Daily Limit Exceeded!' : 'Daily Limit Warning';
        const message =
            percentage >= 100
                ? `You've exceeded your daily limit of ${Math.floor(dailyLimit / 60)} minutes.`
                : `You've used ${percentage}% of your daily limit (${Math.floor(totalUsage / 60)}/${Math.floor(dailyLimit / 60)} minutes).`;

        await chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title,
            message,
        });
    }

    /**
     * Send daily summary notification
     */
    async sendDailySummaryNotification() {
        try {
            const usage = await chrome.storage.local.get('usage');
            const usageData = usage.usage || {};
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = this.getLocalDateString(yesterday);

            let totalYesterdayUsage = 0;
            let topDomain = '';
            let topDomainTime = 0;

            for (const [domain, domainData] of Object.entries(usageData)) {
                const dayUsage = domainData[yesterdayStr] || 0;
                totalYesterdayUsage += dayUsage;

                if (dayUsage > topDomainTime) {
                    topDomainTime = dayUsage;
                    topDomain = domain;
                }
            }

            if (totalYesterdayUsage > 0) {
                const message = `Yesterday: ${Math.floor(totalYesterdayUsage / 60)} minutes total. Top site: ${topDomain} (${Math.floor(topDomainTime / 60)} min)`;

                await chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/icon48.png',
                    title: 'TimeDash Daily Summary',
                    message,
                });
            }
        } catch (error) {
            console.error('Error sending daily summary:', error);
        }
    }

    /**
     * Clean up old usage data
     */
    async cleanupOldUsageData() {
        const usage = await chrome.storage.local.get('usage');
        const usageData = usage.usage || {};
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days ago
        const cutoffStr = this.getLocalDateString(cutoffDate);

        let cleaned = false;

        for (const [domain, domainData] of Object.entries(usageData)) {
            for (const [date] of Object.entries(domainData)) {
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
    }


    /**
     * Clean up old block statistics
     */
    async cleanupOldBlockStats() {
        const stats = await chrome.storage.local.get('blockStats');
        const blockStats = stats.blockStats || {};
        const cutoffDate = new Date();
        cutoffDate.setTime(cutoffDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

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
    }

    /**
     * Create backup data
     * @returns {Object} Backup data object
     */
    async createBackupData() {
        const data = await chrome.storage.local.get();
        return {
            timestamp: new Date().toISOString(),
            version: '1.0.1',
            data,
        };
    }

    /**
     * Store backup data
     * @param {Object} backupData - Data to backup
     */
    async storeBackup(backupData) {
        const backups = await chrome.storage.local.get('backups');
        const existingBackups = backups.backups || [];

        // Keep only last 7 backups
        existingBackups.push(backupData);
        if (existingBackups.length > 7) {
            existingBackups.shift();
        }

        await chrome.storage.local.set({ backups: existingBackups });
    }

    /**
     * Get next midnight timestamp
     * @returns {number} Timestamp for next midnight
     */
    getNextMidnight() {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        return midnight.getTime();
    }

    /**
     * Get next 2 AM timestamp
     * @returns {number} Timestamp for next 2 AM
     */
    getNext2AM() {
        const now = new Date();
        const next2AM = new Date(now);
        next2AM.setHours(26, 0, 0, 0); // 2 AM tomorrow
        return next2AM.getTime();
    }

    /**
     * Clear all alarms
     */
    async clearAllAlarms() {
        await chrome.alarms.clearAll();
        console.log('All alarms cleared');
    }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AlarmManager;
}
