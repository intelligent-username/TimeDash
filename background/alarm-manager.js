'use strict';

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

    getLocalDateString(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    async init() {
        await this.setupAlarms();
        this.setupAlarmListeners();
        console.log('Alarm Manager initialized');
    }

    getNextMidnight() {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        return midnight.getTime();
    }

    getNext2AM() {
        const now = new Date();
        const next2AM = new Date(now);
        next2AM.setHours(26, 0, 0, 0); // 2 AM tomorrow
        return next2AM.getTime();
    }
}

applyAlarmSchedulingMethods(AlarmManager);
applyAlarmHandlerMethods(AlarmManager);
applyAlarmNotificationMethods(AlarmManager);
applyAlarmMaintenanceMethods(AlarmManager);

// Export for use in background script
