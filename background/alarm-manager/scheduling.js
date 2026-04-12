'use strict';

function applyAlarmSchedulingMethods(AlarmManager) {
    AlarmManager.prototype.setupAlarms = async function setupAlarms() {
        await this.createDailyResetAlarm();
        await this.createQuotaCheckAlarm();
        await this.createCleanupAlarm();
        await this.createBackupAlarm();
    };

    AlarmManager.prototype.setupAlarmListeners = function setupAlarmListeners() {
        chrome.alarms.onAlarm.addListener((alarm) => {
            this.handleAlarm(alarm);
        });
    };

    AlarmManager.prototype.createDailyResetAlarm = async function createDailyResetAlarm() {
        const nextMidnight = this.getNextMidnight();

        await chrome.alarms.create(this.ALARM_NAMES.DAILY_RESET, {
            when: nextMidnight,
            periodInMinutes: 24 * 60,
        });

        console.log(`Daily reset alarm set for: ${new Date(nextMidnight)}`);
    };

    AlarmManager.prototype.createQuotaCheckAlarm = async function createQuotaCheckAlarm() {
        await chrome.alarms.create(this.ALARM_NAMES.QUOTA_CHECK, {
            delayInMinutes: 1,
            periodInMinutes: 30,
        });
    };

    AlarmManager.prototype.createCleanupAlarm = async function createCleanupAlarm() {
        await chrome.alarms.create(this.ALARM_NAMES.CLEANUP, {
            delayInMinutes: 30,
            periodInMinutes: 6 * 60,
        });
    };

    AlarmManager.prototype.createBackupAlarm = async function createBackupAlarm() {
        const next2AM = this.getNext2AM();

        await chrome.alarms.create(this.ALARM_NAMES.BACKUP, {
            when: next2AM,
            periodInMinutes: 24 * 60,
        });
    };

    AlarmManager.prototype.clearAllAlarms = async function clearAllAlarms() {
        await chrome.alarms.clearAll();
        console.log('All alarms cleared');
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { applyAlarmSchedulingMethods };
}
