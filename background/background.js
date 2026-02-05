'use strict';

// Import utilities
importScripts(
    '../utils/storage.js',
    '../utils/time-utils.js',
    '../utils/domain-utils.js',
    '../core/rules/site-rule.js',
    '../core/rules/blocked-rule.js',
    '../core/rules/restricted-rule.js',
    '../core/rules/rule-manager.js'
);

/**
 * Background service worker
 * Handles time tracking, site blocking, and coordination between components
 */
class TimeDashBackground {
    constructor() {
        this.storage = new StorageManager();
        this.ruleManager = new RuleManager();
        this.activeTabInfo = new Map(); // tabId -> { domain, startTime, isActive }
        this.updateInterval = null;
        this.TRACKING_INTERVAL = 1000; // 1 second
        this.BATCH_UPDATE_INTERVAL = 5000; // 5 seconds
        this.pendingUpdates = new Map(); // domain -> totalTime

        this.init();
    }

    /**
     * Initialize background service worker
     */
    async init() {
        await this.storage.init();
        await this.ruleManager.init();
        this.setupEventListeners();
        this.startTrackingLoop();
        this.setupAlarms();

        console.log('TimeDash background service worker initialized');
    }

    /**
     * Set up event listeners for browser events
     */
    setupEventListeners() {
        // Tab activation
        chrome.tabs.onActivated.addListener((activeInfo) => {
            this.handleTabActivated(activeInfo.tabId);
        });

        // Tab updates (URL changes)
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url) {
                this.handleTabUpdated(tabId, tab.url);
            }
        });

        // Tab removal
        chrome.tabs.onRemoved.addListener((tabId) => {
            this.handleTabRemoved(tabId);
        });

        // Window focus changes
        chrome.windows.onFocusChanged.addListener((windowId) => {
            this.handleWindowFocusChanged(windowId);
        });

        // Message handling from content scripts and popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async response
        });

        // Keyboard commands
        chrome.commands.onCommand.addListener((command) => {
            this.handleCommand(command);
        });

        // Alarm handling
        chrome.alarms.onAlarm.addListener((alarm) => {
            this.handleAlarm(alarm);
        });
    }

    /**
     * Handle tab activation
     * @param {number} tabId - ID of activated tab
     */
    async handleTabActivated(tabId) {
        try {
            // Stop tracking previous active tab
            this.stopTrackingAllTabs();

            // Get tab info and start tracking if appropriate
            const tab = await chrome.tabs.get(tabId);
            if (tab.url && DomainUtils.shouldTrackUrl(tab.url)) {
                const domain = DomainUtils.extractDomain(tab.url);
                await this.startTrackingTab(tabId, domain);
                await this.checkAndHandleBlocking(tab, domain);
            }
        } catch (error) {
            console.error('Error handling tab activation:', error);
        }
    }

    /**
     * Handle tab URL updates
     * @param {number} tabId - ID of updated tab
     * @param {string} url - New URL
     */
    async handleTabUpdated(tabId, url) {
        try {
            if (!DomainUtils.shouldTrackUrl(url)) {
                this.stopTrackingTab(tabId);
                return;
            }

            const domain = DomainUtils.extractDomain(url);
            const tab = await chrome.tabs.get(tabId);

            // Check if this is the active tab
            if (tab.active) {
                this.stopTrackingAllTabs();
                await this.startTrackingTab(tabId, domain);
                await this.checkAndHandleBlocking(tab, domain);
            }
        } catch (error) {
            console.error('Error handling tab update:', error);
        }
    }

    /**
     * Handle tab removal
     * @param {number} tabId - ID of removed tab
     */
    handleTabRemoved(tabId) {
        this.stopTrackingTab(tabId);
    }

    /**
     * Handle window focus changes
     * @param {number} windowId - ID of focused window
     */
    async handleWindowFocusChanged(windowId) {
        if (windowId === chrome.windows.WINDOW_ID_NONE) {
            // Browser lost focus, stop all tracking
            this.stopTrackingAllTabs();
        } else {
            // Browser gained focus, resume tracking active tab
            try {
                const tabs = await chrome.tabs.query({ active: true, windowId });
                if (tabs.length > 0) {
                    await this.handleTabActivated(tabs[0].id);
                }
            } catch (error) {
                console.error('Error handling window focus change:', error);
            }
        }
    }

    /**
     * Handle messages from content scripts and popup
     * @param {Object} message - Message object
     * @param {Object} sender - Message sender
     * @param {Function} sendResponse - Response callback
     */
    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.type) {
                case 'GET_TAB_INFO':
                    sendResponse(await this.getTabInfo(sender.tab?.id));
                    break;

                case 'UPDATE_VIDEO_SPEED':
                    await this.storage.setCurrentSpeed(message.speed);
                    sendResponse({ success: true });
                    break;

                case 'GET_SETTINGS':
                    sendResponse(await this.storage.getSettings());
                    break;

                case 'UPDATE_SETTINGS':
                    const success = await this.storage.setSettings(message.settings);
                    sendResponse({ success });
                    break;

                case 'GET_USAGE_DATA':
                    sendResponse(await this.getUsageData());
                    break;

                case 'TOGGLE_BLOCK':
                    await this.toggleSiteBlock(message.domain);
                    sendResponse({ success: true });
                    break;

                case 'EXPORT_DATA':
                    const csvData = await this.storage.exportDataAsCSV();
                    sendResponse({ data: csvData });
                    break;

                case 'GET_VIDEO_SPEED':
                    const speed = await this.storage.getCurrentSpeed();
                    sendResponse({ speed });
                    break;

                case 'REQUEST_TEMP_ACCESS':
                    // Grant temporary access via rule manager
                    if (this.ruleManager) {
                        this.ruleManager.grantTemporaryAccess(message.domain, message.duration * 60 * 1000);
                        await this.storage.incrementTempAccessCount(message.domain);
                    }
                    sendResponse({ success: true });
                    break;

                case 'CHECK_TEMP_ACCESS':
                    const hasAccess = this.ruleManager?.hasTemporaryAccess(message.domain) || false;
                    const remainingTime = this.ruleManager?.getRemainingAccessTime(message.domain) || 0;
                    sendResponse({ hasAccess, remainingTime });
                    break;

                case 'LOG_TEMP_ACCESS':
                    await this.storage.incrementTempAccessCount(message.domain);
                    sendResponse({ success: true });
                    break;

                case 'GET_SITE_RULES':
                    sendResponse({
                        blocked: this.ruleManager.getBlockedDomains(),
                        restricted: this.ruleManager.getRestrictedDomains(),
                    });
                    break;

                case 'ADD_SITE_RULE':
                    try {
                        const { domain, ruleType, timeLimitMinutes } = message;
                        if (ruleType === 'BLOCKED') {
                            this.ruleManager.addRule(new BlockedRule(domain));
                        } else if (ruleType === 'RESTRICTED') {
                            this.ruleManager.addRule(new RestrictedRule(domain, timeLimitMinutes || 30));
                        }
                        await this.ruleManager.saveToStorage();
                        sendResponse({ success: true });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'REMOVE_SITE_RULE':
                    this.ruleManager.removeRule(message.domain);
                    await this.ruleManager.saveToStorage();
                    sendResponse({ success: true });
                    break;

                case 'CHECK_ACCESS':
                    const usage = await this.storage.getDomainUsage(message.domain);
                    const todayTime = TimeUtils.calculateTodayTime(usage);
                    const access = this.ruleManager.evaluateAccess(message.url, { todayTimeSeconds: todayTime });
                    sendResponse(access);
                    break;

                default:
                    sendResponse({ error: 'Unknown message type' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ error: error.message });
        }
    }

    /**
     * Handle keyboard commands
     * @param {string} command - Command name
     */
    async handleCommand(command) {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length === 0) return;

            const tab = tabs[0];
            const domain = DomainUtils.extractDomain(tab.url);

            switch (command) {
                case 'toggle-tracking':
                    await this.toggleTracking();
                    break;

                case 'toggle-block':
                    await this.toggleSiteBlock(domain);
                    break;
            }
        } catch (error) {
            console.error('Error handling command:', error);
        }
    }

    /**
     * Handle alarms
     * @param {Object} alarm - Alarm object
     */
    async handleAlarm(alarm) {
        switch (alarm.name) {
            case 'daily-reset':
                await this.handleDailyReset();
                break;

            case 'batch-update':
                await this.processPendingUpdates();
                break;
        }
    }

    /**
     * Start tracking a specific tab
     * @param {number} tabId - Tab ID
     * @param {string} domain - Domain being tracked
     */
    async startTrackingTab(tabId, domain) {
        const settings = await this.storage.getSettings();
        if (!settings.trackingEnabled) return;

        this.activeTabInfo.set(tabId, {
            domain,
            startTime: Date.now(),
            isActive: true,
        });

        // Update badge
        await this.updateBadge(domain);
    }

    /**
     * Stop tracking a specific tab
     * @param {number} tabId - Tab ID
     */
    stopTrackingTab(tabId) {
        const tabInfo = this.activeTabInfo.get(tabId);
        if (tabInfo && tabInfo.isActive) {
            const timeSpent = Math.floor((Date.now() - tabInfo.startTime) / 1000);
            if (timeSpent > 0) {
                this.addToPendingUpdates(tabInfo.domain, timeSpent);
            }
        }
        this.activeTabInfo.delete(tabId);
    }

    /**
     * Stop tracking all tabs
     */
    stopTrackingAllTabs() {
        for (const [tabId] of this.activeTabInfo) {
            this.stopTrackingTab(tabId);
        }
    }

    /**
     * Add time to pending updates for batch processing
     * @param {string} domain - Domain
     * @param {number} timeSpent - Time spent in seconds
     */
    addToPendingUpdates(domain, timeSpent) {
        const current = this.pendingUpdates.get(domain) || 0;
        this.pendingUpdates.set(domain, current + timeSpent);
    }

    /**
     * Process pending time updates in batches
     */
    async processPendingUpdates() {
        if (this.pendingUpdates.size === 0) return;

        const updates = new Map(this.pendingUpdates);
        this.pendingUpdates.clear();

        for (const [domain, timeSpent] of updates) {
            // Determine usage type (GENERAL or RESTRICTED)
            const rule = this.ruleManager.getRule(domain);
            let type = 'GENERAL';

            if (rule && rule.type === 'RESTRICTED') {
                type = 'RESTRICTED';
            }

            await this.storage.updateUsage(domain, timeSpent, type);
        }
    }

    /**
     * Start the main tracking loop
     */
    startTrackingLoop() {
        // Process pending updates every 5 seconds
        setInterval(() => {
            this.processPendingUpdates();
        }, this.BATCH_UPDATE_INTERVAL);

        // Update active tracking every second
        setInterval(() => {
            this.updateActiveTracking();
        }, this.TRACKING_INTERVAL);
    }

    /**
     * Update active tracking for current tab
     */
    async updateActiveTracking() {
        for (const [tabId, tabInfo] of this.activeTabInfo) {
            if (tabInfo.isActive) {
                try {
                    // Check if tab is still active and visible
                    const tab = await chrome.tabs.get(tabId);
                    if (tab.active) {
                        // Send message to content script to check visibility
                        const response = await chrome.tabs.sendMessage(tabId, {
                            type: 'CHECK_VISIBILITY',
                        });
                        if (!response?.visible) {
                            tabInfo.isActive = false;
                        }
                    } else {
                        tabInfo.isActive = false;
                    }
                } catch (error) {
                    // Tab probably closed, remove it
                    this.stopTrackingTab(tabId);
                }
            }
        }
    }

    /**
     * Check and handle site blocking
     * @param {Object} tab - Tab object
     * @param {string} domain - Domain to check
     */
    async checkAndHandleBlocking(tab, domain) {
        // Get usage stats for restricted site evaluation
        const usage = await this.storage.getDomainUsage(domain);
        const todayTimeSeconds = TimeUtils.calculateTodayTime(usage);

        // Evaluate access using the rule manager
        const accessResult = this.ruleManager.evaluateAccess(tab.url, { todayTimeSeconds });

        if (accessResult.shouldBlock) {
            // Increment block count
            try {
                await this.storage.incrementBlockCount(domain);
            } catch (error) {
                console.error('Failed to increment block count:', error);
            }

            const blockPageUrl =
                chrome.runtime.getURL('block/block.html') +
                `?domain=${encodeURIComponent(domain)}&url=${encodeURIComponent(tab.url)}&reason=${accessResult.reason}`;
            await chrome.tabs.update(tab.id, { url: blockPageUrl });
        }
    }

    /**
     * Get current tab info
     * @param {number} tabId - Tab ID
     * @returns {Object} Tab info
     */
    async getTabInfo(tabId) {
        const tabInfo = this.activeTabInfo.get(tabId);
        if (!tabInfo) return null;

        const usage = await this.storage.getDomainUsage(tabInfo.domain);
        const todayTime = TimeUtils.calculateTodayTime(usage);
        const totalTime = TimeUtils.calculateTotalTime(usage);

        return {
            domain: tabInfo.domain,
            todayTime,
            totalTime,
            isTracking: tabInfo.isActive,
        };
    }

    /**
     * Get usage data for popup/options
     * @returns {Object} Usage data
     */
    async getUsageData() {
        const usage = await this.storage.getAllUsage();
        const settings = await this.storage.getSettings();
        const blockList = await this.storage.getBlockList();

        // Process usage data for display
        const processedData = [];
        for (const [domain, data] of Object.entries(usage)) {
            const todayTime = TimeUtils.calculateTodayTime(data);
            const totalTime = TimeUtils.calculateTotalTime(data);
            const averageTime = TimeUtils.calculateAverageTime(data);

            processedData.push({
                domain,
                todayTime,
                totalTime,
                averageTime,
                isBlocked: blockList.includes(domain),
                productivity: DomainUtils.getProductivityScore(domain),
            });
        }

        // Sort by today's time
        processedData.sort((a, b) => b.todayTime - a.todayTime);

        return {
            domains: processedData,
            settings,
            totalToday: processedData.reduce((sum, d) => sum + d.todayTime, 0),
            totalOverall: processedData.reduce((sum, d) => sum + d.totalTime, 0),
        };
    }

    /**
     * Update universal video speed
     * @param {number} speed - Video speed
     */
    async updateVideoSpeed(speed) {
        await this.storage.setCurrentSpeed(speed);
    }

    /**
     * Toggle site blocking for domain
     * @param {string} domain - Domain to toggle
     */
    async toggleSiteBlock(domain) {
        const blockList = await this.storage.getBlockList();
        if (blockList.includes(domain)) {
            await this.storage.removeFromBlockList(domain);
        } else {
            await this.storage.addToBlockList(domain);
        }

        // Reload any tabs with this domain
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            if (tab.url && DomainUtils.extractDomain(tab.url) === domain) {
                await chrome.tabs.reload(tab.id);
            }
        }
    }

    /**
     * Toggle time tracking on/off
     */
    async toggleTracking() {
        const settings = await this.storage.getSettings();
        const wasEnabled = settings.trackingEnabled;
        await this.storage.setSettings({
            trackingEnabled: !wasEnabled,
        });

        // If tracking was enabled, now it's disabled - stop tracking
        if (wasEnabled) {
            this.stopTrackingAllTabs();
        }
    }

    /**
     * Export data to file
     */
    async exportData() {
        const csvData = await this.storage.exportDataAsCSV();

        // Create download
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);

        await chrome.downloads.download({
            url,
            filename: `timedash-export-${TimeUtils.getCurrentDate()}.csv`,
            saveAs: true,
        });
    }

    /**
     * Toggle blocking for a domain
     * @param {string} domain 
     */
    async toggleSiteBlock(domain) {
        if (!domain) return;

        // Remove existing rule if any (unblock)
        if (this.ruleManager.getRule(domain)) {
            this.ruleManager.removeRule(domain);
        } else {
            // Add blocked rule
            this.ruleManager.addRule(new BlockedRule(domain));
        }

        await this.ruleManager.saveToStorage();

        // Also update active tabs in case we need to block immediately
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            if (tab.url && DomainUtils.extractDomain(tab.url) === domain) {
                await this.checkAndHandleBlocking(tab, domain);
            }
        }
    }

    /**
     * Update extension badge
     * @param {string} domain - Current domain
     */
    async updateBadge(domain) {
        try {
            const usage = await this.storage.getDomainUsage(domain);
            const todayTime = TimeUtils.calculateTodayTime(usage);

            let badgeText = '';
            let badgeColor = '#4CAF50';

            if (todayTime > 0) {
                if (todayTime < 60) {
                    badgeText = `${todayTime}s`;
                } else if (todayTime < 3600) {
                    badgeText = `${Math.floor(todayTime / 60)}m`;
                } else {
                    badgeText = `${Math.floor(todayTime / 3600)}h`;
                }
            }

            // Check if domain is blocked
            const blockList = await this.storage.getBlockList();
            if (blockList.includes(domain)) {
                badgeText = '🚫';
                badgeColor = '#F44336';
            }

            await chrome.action.setBadgeText({ text: badgeText });
            await chrome.action.setBadgeBackgroundColor({ color: badgeColor });
        } catch (error) {
            console.error('Error updating badge:', error);
        }
    }

    /**
     * Set up daily reset alarm
     */
    setupAlarms() {
        // Daily reset at midnight
        chrome.alarms.create('daily-reset', {
            when: this.getNextMidnight(),
            periodInMinutes: 24 * 60,
        });
    }

    /**
     * Get timestamp for next midnight
     * @returns {number} Timestamp for next midnight
     */
    getNextMidnight() {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        return midnight.getTime();
    }

    /**
     * Handle daily reset
     */
    async handleDailyReset() {
        // Could implement daily reset logic here if needed
        console.log('Daily reset triggered');
    }
}

// Initialize background service worker
const timeDashBackground = new TimeDashBackground();
