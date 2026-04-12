'use strict';

function applyAlarmHandlerMethods(AlarmManager) {
    AlarmManager.prototype.handleAlarm = async function handleAlarm(alarm) {
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
    };

    AlarmManager.prototype.handleDailyReset = async function handleDailyReset() {
        console.log('Executing daily reset...');

        try {
            await chrome.storage.local.remove(['dailyNotificationsSent']);
            await chrome.storage.local.remove(['quotaWarningsSent']);
            await this.sendDailySummaryNotification();
            console.log('Daily reset completed successfully');
        } catch (error) {
            console.error('Error during daily reset:', error);
        }
    };

    AlarmManager.prototype.handleQuotaCheck = async function handleQuotaCheck() {
        try {
            const settings = await chrome.storage.local.get('settings');
            const userSettings = settings.settings || {};

            if (!userSettings.notificationsEnabled || !userSettings.dailyTimeLimitMinutes) {
                return;
            }

            const usage = await chrome.storage.local.get('usage');
            const usageData = usage.usage || {};
            const today = this.getLocalDateString();
            const dailyLimitSeconds = userSettings.dailyTimeLimitMinutes * 60;

            let totalTodayUsage = 0;
            for (const domainData of Object.values(usageData)) {
                totalTodayUsage += domainData[today] || 0;
            }

            const usagePercentage = (totalTodayUsage / dailyLimitSeconds) * 100;
            await this.checkAndSendQuotaWarnings(totalTodayUsage, dailyLimitSeconds, usagePercentage);
        } catch (error) {
            console.error('Error during quota check:', error);
        }
    };

    AlarmManager.prototype.handleCleanup = async function handleCleanup() {
        console.log('Executing cleanup...');

        try {
            await this.cleanupOldUsageData();
            await this.cleanupOldBlockStats();
            console.log('Cleanup completed successfully');
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    };

    AlarmManager.prototype.handleBackup = async function handleBackup() {
        console.log('Executing backup...');

        try {
            const backupData = await this.createBackupData();
            await this.storeBackup(backupData);
            console.log('Backup completed successfully');
        } catch (error) {
            console.error('Error during backup:', error);
        }
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { applyAlarmHandlerMethods };
}
