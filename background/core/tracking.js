'use strict';

function applyBackgroundTrackingMethods(TimeDashBackground) {
    TimeDashBackground.prototype.addToPendingUpdates = function addToPendingUpdates(domain, timeSpent) {
        this.pendingUpdates.set(domain, (this.pendingUpdates.get(domain) || 0) + timeSpent);
    };

    TimeDashBackground.prototype.processPendingUpdates = async function processPendingUpdates() {
        if (this.pendingUpdates.size === 0) return;

        const updates = new Map(this.pendingUpdates);
        this.pendingUpdates.clear();

        for (const [domain, timeSpent] of updates) {
            const rule = this.ruleManager.getRule(domain);
            const type = rule && rule.type === 'RESTRICTED' ? 'RESTRICTED' : 'GENERAL';
            await this.storage.updateUsage(domain, timeSpent, type);
        }
    };

    TimeDashBackground.prototype.startTrackingLoop = function startTrackingLoop() {
        setInterval(() => this.processPendingUpdates(), this.BATCH_UPDATE_INTERVAL);
        setInterval(() => this.updateActiveTracking(), this.TRACKING_INTERVAL);
    };

    TimeDashBackground.prototype.updateActiveTracking = async function updateActiveTracking() {
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
    };
}
