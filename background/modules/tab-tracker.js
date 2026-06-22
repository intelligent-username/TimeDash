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
                await this.startTrackingTab(tabId, domain);
                await this.checkAndHandleBlocking(tab, domain);
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
                await this.startTrackingTab(tabId, domain);
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

        // Increment domain active count
        const count = (this.instance.domainActiveCount.get(domain) || 0) + 1;
        this.instance.domainActiveCount.set(domain, count);
        // Record start time when first tab of domain becomes active
        if (count === 1) {
            this.instance.domainStartTime.set(domain, Date.now());
        }
        // Keep per‑tab info for visibility tracking
        this.instance.activeTabInfo.set(tabId, {
            domain,
            isActive: true,
        });

        await this.updateBadge(domain);
    }

    stopTrackingTab(tabId) {
        const tabInfo = this.instance.activeTabInfo.get(tabId);
        if (tabInfo) {
            // Decrement domain count
            const domain = tabInfo.domain;
            const newCount = (this.instance.domainActiveCount.get(domain) || 1) - 1;
            if (newCount <= 0) {
                // Domain no longer active, compute elapsed
                const start = this.instance.domainStartTime.get(domain) || Date.now();
                const elapsed = Math.floor((Date.now() - start) / 1000);
                if (elapsed > 0) {
                    this.instance.addToPendingUpdates(domain, elapsed);
                }
                this.instance.domainActiveCount.delete(domain);
                this.instance.domainStartTime.delete(domain);
            } else {
                this.instance.domainActiveCount.set(domain, newCount);
            }
        }
        this.instance.activeTabInfo.delete(tabId);
    }

    stopTrackingAllTabs() {
        for (const [tabId] of this.instance.activeTabInfo) {
            this.stopTrackingTab(tabId);
        }
    }

    flushActiveTime() {
        const now = Date.now();
        for (const [domain, startedAt] of this.instance.domainStartTime) {
            const timeSpent = Math.floor((now - startedAt) / 1000);
            if (timeSpent > 0) {
                this.instance.addToPendingUpdates(domain, timeSpent);
                this.instance.domainStartTime.set(domain, now);
            }
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
                return;
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
        }
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
