/**
 * Tab Tracker - background/modules/tab-tracker.js
 * Manages tab tracking, blocking, and state monitoring
 * ~180 lines
 */

/* global DomainUtils, TimeUtils */

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

        chrome.webNavigation.onCommitted.addListener(async (details) => {
            if (details.frameId !== 0) return;

            const isExtUrl = details.url && (details.url.startsWith('chrome-extension://') || details.url.startsWith('moz-extension://'));
            if (isExtUrl && (details.url.includes('domain=') || details.url.includes('url='))) {
                try {
                    const tab = await chrome.tabs.get(details.tabId);
                    if (tab) await this.checkAndRedirectUnblockedPage(tab);
                } catch {
                    // Tab may have closed
                }
                return;
            }

            if (!DomainUtils.shouldTrackUrl(details.url)) return;
            try {
                const tab = await chrome.tabs.get(details.tabId);
                if (!tab || !tab.id) return;
                const domain = DomainUtils.extractDomain(details.url);
                await this.checkAndHandleBlocking(tab, domain);
            } catch {
                // Tab may have been closed between event and lookup
            }
        });

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes.settings) {
                this.handleSettingsChanged(changes.settings.newValue || {});
            }
        });
    }

    async handleTabActivated(tabId) {
        try {
            this.stopTrackingAllTabs();

            const tab = await chrome.tabs.get(tabId);
            if (!tab || !tab.url) return;

            const isExtUrl = tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://');
            if (isExtUrl && (tab.url.includes('domain=') || tab.url.includes('url='))) {
                await this.checkAndRedirectUnblockedPage(tab);
                return;
            }

            if (DomainUtils.shouldTrackUrl(tab.url)) {
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
            const isExtUrl = url && (url.startsWith('chrome-extension://') || url.startsWith('moz-extension://'));
            if (isExtUrl && (url.includes('domain=') || url.includes('url='))) {
                this.stopTrackingTab(tabId);
                const tab = await chrome.tabs.get(tabId);
                if (tab) {
                    await this.checkAndRedirectUnblockedPage(tab);
                }
                return;
            }

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
                // Background tab. Checks for blocking rules but doesn't start tracking.
                await this.checkAndHandleBlocking(tab, domain);
            }
        } catch (error) {
            console.error('Error handling tab update:', error);
        }
    }

    async checkAndRedirectUnblockedPage(tab) {
        try {
            const urlObj = new URL(tab.url);
            const origUrl = urlObj.searchParams.get('url');
            const origDomain = urlObj.searchParams.get('domain');

            const domain = origUrl ? DomainUtils.extractDomain(origUrl) : (origDomain || '');
            if (!domain) return;

            const accessResult = await this.instance.evaluateAccessForDomain(origUrl || `https://${domain}`, domain);
            if (!accessResult.shouldBlock) {
                const destination = origUrl || `https://${domain}`;
                await chrome.tabs.update(tab.id, { url: destination });
            }
        } catch (error) {
            console.error('Error checking unblocked page redirect:', error);
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

    async handleSettingsChanged(newSettings) {
        try {
            const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            if (!tabs || tabs.length === 0) return;
            const currentActiveTab = tabs[0];

            if (!DomainUtils.shouldTrackUrl(currentActiveTab.url)) {
                this.stopTracking();
                return;
            }

            const domain = DomainUtils.extractDomain(currentActiveTab.url);
            const isIncognitoDisallowed = currentActiveTab.incognito && !newSettings.incognitoTracking;
            const isWhitelisted = newSettings.whitelist && newSettings.whitelist.includes(domain);
            const isTrackingDisabled = newSettings.trackingEnabled === false;

            if (isIncognitoDisallowed || isWhitelisted || isTrackingDisabled) {
                this.stopTracking();
            } else if (!this.instance.currentTrack || this.instance.currentTrack.tabId !== currentActiveTab.id) {
                await this.handleTabActivated(currentActiveTab.id);
            }
        } catch (error) {
            console.error('Error handling settings change in tab tracker:', error);
        }
    }

    async startTrackingTab(tabId, domain) {
        const settings = await this.instance.storage.getSettings();

        if (!settings.trackingEnabled) return;

        try {
            const tab = await chrome.tabs.get(tabId);
            if (tab && tab.incognito && !settings.incognitoTracking) {
                return;
            }
        } catch {
            // Tab lookup failed
        }

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
        const accessResult = await this.instance.evaluateAccessForDomain(tab.url, domain);

        if (accessResult.shouldBlock) {
            try {
                await this.instance.storage.incrementBlockCount(domain);
            } catch (error) {
                console.error('Failed to increment block count:', error);
            }

            const blockPageUrl =
                chrome.runtime.getURL('block/block.html') +
                `?domain=${encodeURIComponent(domain)}&url=${encodeURIComponent(tab.url)}&reason=${accessResult.reason}`;
            await new Promise((resolve) => setTimeout(resolve, 50));
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
