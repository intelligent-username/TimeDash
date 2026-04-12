'use strict';

importScripts(
    '../utils/storage/defaults.js',
    '../utils/storage/settings.js',
    '../utils/storage/usage.js',
    '../utils/storage/blocking.js',
    '../utils/storage/misc.js',
    '../utils/storage.js',
    '../utils/time-utils.js',
    '../utils/domain-utils.js',
    '../core/rules/site-rule.js',
    '../core/rules/blocked-rule.js',
    '../core/rules/restricted-rule.js',
    '../core/rules/rule-manager.js',
    'core/messaging.js',
    'core/tracking.js',
    'core/data.js',
    'alarm-manager/scheduling.js',
    'alarm-manager/handlers.js',
    'alarm-manager/notifications.js',
    'alarm-manager/maintenance.js',
    'alarm-manager.js',
    'modules/tab-tracker.js',
    'modules/video-service.js'
);

class TimeDashBackground {
    constructor() {
        this.storage = new StorageManager();
        this.ruleManager = new RuleManager();
        this.activeTabInfo = new Map();
        this.TRACKING_INTERVAL = 1000;
        this.BATCH_UPDATE_INTERVAL = 5000;
        this.pendingUpdates = new Map();
        this.alarmManager = new AlarmManager();

        this.tabTracker = new TabTracker(this);
        this.videoService = new VideoService(this);
        this.init();
    }

    async init() {
        await this.storage.init();
        await this.ruleManager.init();
        this.tabTracker.setupEventListeners();
        this.setupMessageHandling();
        this.startTrackingLoop();
    }
}

applyBackgroundMessagingMethods(TimeDashBackground);
applyBackgroundTrackingMethods(TimeDashBackground);
applyBackgroundDataMethods(TimeDashBackground);

const timeDashBG = new TimeDashBackground();
