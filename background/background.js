'use strict';

importScripts(
    '../utils/storage.js',
    '../utils/time-utils.js',
    '../utils/domain-utils.js',
    '../core/rules/site-rule.js',
    '../core/rules/blocked-rule.js',
    '../core/rules/restricted-rule.js',
    '../core/rules/rule-manager.js',
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

    setupMessageHandling() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true;
        });

        chrome.commands.onCommand.addListener((command) => {
            this.handleCommand(command);
        });
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.type) {
                case 'GET_TAB_INFO':
                    sendResponse(await this.getTabInfo(sender.tab ? sender.tab.id : undefined));
                    break;
                case 'GET_SETTINGS':
                    sendResponse(await this.storage.getSettings());
                    break;
                case 'UPDATE_SETTINGS':
                    sendResponse({ success: await this.storage.setSettings(message.settings) });
                    break;
                case 'GET_USAGE_DATA':
                    sendResponse(await this.getUsageData());
                    break;
                case 'UPDATE_VIDEO_SPEED':
                    await this.storage.setCurrentSpeed(message.speed);
                    sendResponse({ success: true });
                    break;
                case 'GET_CURRENTLY_PLAYING_VIDEOS':
                    sendResponse(await this.videoService.getCurrentlyPlayingVideos());
                    break;
                case 'CONTROL_VIDEO_PLAYBACK':
                    sendResponse(await this.videoService.controlVideoPlayback(message));
                    break;
                case 'REFRESH_VIDEO_DETECTION':
                    sendResponse(await this.videoService.refreshVideoDetection());
                    break;
                case 'FOCUS_VIDEO_TAB':
                    sendResponse(await this.videoService.focusVideoTab(message));
                    break;
                case 'TOGGLE_BLOCK':
                    await this.toggleSiteBlock(message.domain);
                    sendResponse({ success: true });
                    break;
                case 'EXPORT_DATA':
                    sendResponse({ data: await this.storage.exportDataAsCSV() });
                    break;
                case 'GET_SITE_RULES':
                    sendResponse({
                        blocked: this.ruleManager.getBlockedDomains(),
                        restricted: this.ruleManager.getRestrictedDomains(),
                    });
                    break;
                case 'ADD_SITE_RULE': {
                    const { domain, ruleType, timeLimitMinutes } = message;
                    if (ruleType === 'BLOCKED') this.ruleManager.addRule(new BlockedRule(domain));
                    if (ruleType === 'RESTRICTED') this.ruleManager.addRule(new RestrictedRule(domain, timeLimitMinutes || 30));
                    await this.ruleManager.saveToStorage();
                    sendResponse({ success: true });
                    break;
                }
                case 'REMOVE_SITE_RULE':
                    this.ruleManager.removeRule(message.domain);
                    await this.ruleManager.saveToStorage();
                    sendResponse({ success: true });
                    break;
                case 'CHECK_ACCESS': {
                    const usage = await this.storage.getDomainUsage(message.domain);
                    const todayTime = TimeUtils.calculateTodayTime(usage);
                    sendResponse(this.ruleManager.evaluateAccess(message.url, { todayTimeSeconds: todayTime }));
                    break;
                }
                default:
                    sendResponse({ error: 'Unknown message type' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ error: error.message });
        }
    }

    async handleCommand(command) {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length === 0) return;
            const domain = DomainUtils.extractDomain(tabs[0].url);
            if (command === 'toggle-tracking') await this.toggleTracking();
            if (command === 'toggle-block') await this.toggleSiteBlock(domain);
        } catch (error) {
            console.error('Error handling command:', error);
        }
    }

    addToPendingUpdates(domain, timeSpent) {
        this.pendingUpdates.set(domain, (this.pendingUpdates.get(domain) || 0) + timeSpent);
    }

    async processPendingUpdates() {
        if (this.pendingUpdates.size === 0) return;
        const updates = new Map(this.pendingUpdates);
        this.pendingUpdates.clear();

        for (const [domain, timeSpent] of updates) {
            const rule = this.ruleManager.getRule(domain);
            const type = rule && rule.type === 'RESTRICTED' ? 'RESTRICTED' : 'GENERAL';
            await this.storage.updateUsage(domain, timeSpent, type);
        }
    }

    startTrackingLoop() {
        setInterval(() => this.processPendingUpdates(), this.BATCH_UPDATE_INTERVAL);
        setInterval(() => this.updateActiveTracking(), this.TRACKING_INTERVAL);
    }

    async updateActiveTracking() {
        for (const [tabId, tabInfo] of this.activeTabInfo) {
            if (!tabInfo.isActive) continue;
            try {
                const tab = await chrome.tabs.get(tabId);
                if (!tab.active) {
                    tabInfo.isActive = false;
                    continue;
                }
                const response = await chrome.tabs.sendMessage(tabId, { type: 'CHECK_VISIBILITY' });
                if (!response || !response.visible) tabInfo.isActive = false;
            } catch {
                this.tabTracker.stopTrackingTab(tabId);
            }
        }
    }

    async getTabInfo(tabId) {
        const tabInfo = this.activeTabInfo.get(tabId);
        if (!tabInfo) return null;
        const usage = await this.storage.getDomainUsage(tabInfo.domain);
        return {
            domain: tabInfo.domain,
            todayTime: TimeUtils.calculateTodayTime(usage),
            totalTime: TimeUtils.calculateTotalTime(usage),
            isTracking: tabInfo.isActive,
        };
    }

    async getUsageData() {
        const usage = await this.storage.getAllUsage();
        const settings = await this.storage.getSettings();
        const blockList = await this.storage.getBlockList();

        const domains = Object.entries(usage).map(([domain, data]) => ({
            domain,
            todayTime: TimeUtils.calculateTodayTime(data),
            totalTime: TimeUtils.calculateTotalTime(data),
            averageTime: TimeUtils.calculateAverageTime(data),
            isBlocked: blockList.includes(domain),
            productivity: DomainUtils.getProductivityScore(domain),
        })).sort((a, b) => b.todayTime - a.todayTime);

        return {
            domains,
            settings,
            totalToday: domains.reduce((sum, d) => sum + d.todayTime, 0),
            totalOverall: domains.reduce((sum, d) => sum + d.totalTime, 0),
        };
    }

    async toggleTracking() {
        const settings = await this.storage.getSettings();
        settings.trackingEnabled = !settings.trackingEnabled;
        await this.storage.setSettings(settings);
    }

    async toggleSiteBlock(domain) {
        if (!domain) return;
        const blockList = await this.storage.getBlockList();
        const idx = blockList.indexOf(domain);
        if (idx >= 0) blockList.splice(idx, 1);
        else blockList.push(domain);
        await this.storage.setBlockList(blockList);
    }
}

const timeDashBG = new TimeDashBackground();
