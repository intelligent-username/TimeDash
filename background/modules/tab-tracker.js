/**
 * Tab Tracker - background/modules/tab-tracker.js
 * Manages tab tracking, blocking, and state monitoring
 * ~180 lines
 */

class TabTracker {
    constructor(instance) {
        this.instance = instance;
    }

    setupEventListeners() {
        chrome.tabs.onActivated.addListener((activeInfo) => {
            this.handleTabActivated(activeInfo.tabId);
        });

        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url) {
                this.handleTabUpdated(tabId, tab.url);
            }
        });

        chrome.tabs.onRemoved.addListener((tabId) => {
            this.handleTabRemoved(tabId);
        });

        chrome.windows.onFocusChanged.addListener((windowId) => {
            this.handleWindowActivationChanged(windowId);
        });
    }

    async handleTabActivated(tabId) {
        try {
            this.stopTrackingAllTabs();

            const tab = await chrome.tabs.get(tabId);
            if (tab.url && DomainUtils.shouldTrackUrl(tab.url)) {
                const domain = DomainUtils.extractDomain(tab.url);
                const wasBlocked = await this.checkAndHandleBlocking(tab, domain);
                if (!wasBlocked) {
                    await this.startTrackingTab(tabId, domain);
                }
            }
        } catch (error) {
            console.error('Error handling tab activation:', error);
        }
    }

    async handleTabUpdated(tabId, url) {
        try {
            if (!DomainUtils.shouldTrackUrl(url)) {
                this.stopTrackingTab(tabId);
                return;
            }

            const domain = DomainUtils.extractDomain(url);
            const tab = await chrome.tabs.get(tabId);

            if (tab.active) {
                this.stopTrackingAllTabs();
                const wasBlocked = await this.checkAndHandleBlocking(tab, domain);
                if (!wasBlocked) {
                    await this.startTrackingTab(tabId, domain);
                }
            } else {
                // Background tab — check blocking but don't start tracking
                await this.checkAndHandleBlocking(tab, domain);
            }
        } catch (error) {
            console.error('Error handling tab update:', error);
        }
    }

    handleTabRemoved(tabId) {
        this.stopTrackingTab(tabId);
    }

    async handleWindowActivationChanged(windowId) {
        if (windowId === chrome.windows.WINDOW_ID_NONE) {
            this.stopTrackingAllTabs();
        } else {
            try {
                const tabs = await chrome.tabs.query({ active: true, windowId });
                if (tabs.length > 0) {
                    await this.handleTabActivated(tabs[0].id);
                }
            } catch (error) {
                console.error('Error handling window activation change:', error);
            }
        }
    }

    async startTrackingTab(tabId, domain) {
        const settings = await this.instance.storage.getSettings();

        if (!settings.trackingEnabled) return;

        if (settings.whitelist && settings.whitelist.includes(domain)) return;

        // Stop any previous tracking before starting new one
        this.stopTracking();

        this.instance.currentTrack = { tabId, domain, startTime: Date.now() };

        await this.updateBadge(domain);
    }

    stopTracking() {
        if (!this.instance.currentTrack) return;
        const { domain, startTime } = this.instance.currentTrack;
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        if (elapsed > 0) {
            this.instance.addToPendingUpdates(domain, elapsed);
        }
        this.instance.currentTrack = null;
    }

    stopTrackingTab(tabId) {
        if (this.instance.currentTrack && this.instance.currentTrack.tabId === tabId) {
            this.stopTracking();
        }
    }

    stopTrackingAllTabs() {
        this.stopTracking();
    }

    flushActiveTime() {
        if (!this.instance.currentTrack) return;
        const { domain, startTime } = this.instance.currentTrack;
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        if (elapsed > 0) {
            this.instance.addToPendingUpdates(domain, elapsed);
            this.instance.currentTrack.startTime = Date.now();
        }
    }

    async checkAndHandleBlocking(tab, domain) {
        const settings = await this.instance.storage.getSettings();
        const dailyLimitMinutes = Number(settings.dailyTimeLimitMinutes || 0);

        if (dailyLimitMinutes > 0) {
            const allUsage = await this.instance.storage.getAllUsage();
            let totalTodaySeconds = 0;
            for (const domainUsage of Object.values(allUsage)) {
                totalTodaySeconds += TimeUtils.calculateTodayTime(domainUsage || {});
            }

            if (totalTodaySeconds >= dailyLimitMinutes * 60) {
                try {
                    await this.instance.storage.incrementBlockCount(domain);
                } catch (error) {
                    console.error('Failed to increment block count:', error);
                }

                const blockPageUrl =
                    chrome.runtime.getURL('block/block.html') +
                    `?domain=${encodeURIComponent(domain)}&url=${encodeURIComponent(tab.url)}&reason=restricted`;
                await chrome.tabs.update(tab.id, { url: blockPageUrl });
                return true;
            }
        }

        const usage = await this.instance.storage.getDomainUsage(domain);
        const todayTimeSeconds = TimeUtils.calculateTodayTime(usage);
        const accessResult = this.instance.ruleManager.evaluateAccess(tab.url, { todayTimeSeconds });

        if (accessResult.shouldBlock) {
            try {
                await this.instance.storage.incrementBlockCount(domain);
            } catch (error) {
                console.error('Failed to increment block count:', error);
            }

            const blockPageUrl =
                chrome.runtime.getURL('block/block.html') +
                `?domain=${encodeURIComponent(domain)}&url=${encodeURIComponent(tab.url)}&reason=${accessResult.reason}`;
            await chrome.tabs.update(tab.id, { url: blockPageUrl });
            return true;
        }

        return false;
    }

    async updateBadge(domain) {
        try {
            const usage = await this.instance.storage.getDomainUsage(domain);
            const todayTime = TimeUtils.calculateTodayTime(usage);
            const minutes = Math.ceil(todayTime / 60);

            if (minutes > 0) {
                chrome.action.setBadgeText({ text: String(minutes) });
                chrome.action.setBadgeBackgroundColor({ color: '#00b7ff' });
            }
        } catch (error) {
            console.error('Error updating badge:', error);
        }
    }
}
