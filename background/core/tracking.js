'use strict';

function applyBackgroundTrackingMethods(TimeDashBackground) {
    TimeDashBackground.prototype.addToPendingUpdates = function addToPendingUpdates(
        domain,
        timeSpent
    ) {
        this.pendingUpdates.set(domain, (this.pendingUpdates.get(domain) || 0) + timeSpent);
        this.syncPendingUpdates();
    };

    TimeDashBackground.prototype.syncPendingUpdates = async function syncPendingUpdates() {
        try {
            const obj = Object.fromEntries(this.pendingUpdates);
            await chrome.storage.session.set({ pendingUpdates: obj });
        } catch {
            // non-critical
        }
    };

    TimeDashBackground.prototype.processPendingUpdates = async function processPendingUpdates() {
        if (this.tabTracker && typeof this.tabTracker.flushActiveTime === 'function') {
            this.tabTracker.flushActiveTime();
        }

        if (this.pendingUpdates.size === 0) return;

        const updates = new Map(this.pendingUpdates);
        this.pendingUpdates.clear();

        try {
            await chrome.storage.session.remove('pendingUpdates');
        } catch {
            // non-critical
        }

        for (const [domain, timeSpent] of updates) {
            const rule = this.ruleManager.getRule(domain);
            const type = rule && rule.type === 'RESTRICTED' ? 'RESTRICTED' : 'GENERAL';
            await this.storage.updateUsage(domain, timeSpent, type);
        }

        this.broadcastUpdate();
    };

    TimeDashBackground.prototype.broadcastUpdate = function broadcastUpdate() {
        try {
            chrome.runtime.sendMessage({ type: 'USAGE_DATA_UPDATED' }).catch(() => {});
        } catch {
            // noop - no listeners
        }
    };

    TimeDashBackground.prototype.startTrackingLoop = function startTrackingLoop() {
        setInterval(() => this.processPendingUpdates(), this.BATCH_UPDATE_INTERVAL);
        setInterval(() => this.updateActiveTracking(), this.TRACKING_INTERVAL);
    };

    TimeDashBackground.prototype.restorePendingUpdates = async function restorePendingUpdates() {
        try {
            const result = await chrome.storage.session.get('pendingUpdates');
            if (result.pendingUpdates) {
                for (const [domain, time] of Object.entries(result.pendingUpdates)) {
                    this.pendingUpdates.set(domain, (this.pendingUpdates.get(domain) || 0) + time);
                }
                await chrome.storage.session.remove('pendingUpdates');
            }
        } catch {
            // session storage not available; non-critical, just lose up to 5s
        }
    };

    TimeDashBackground.prototype.updateActiveTracking = async function updateActiveTracking() {
        const track = this.currentTrack;
        if (!track) return;

        try {
            const tab = await chrome.tabs.get(track.tabId);
            if (!tab.active) {
                this.tabTracker.stopTrackingTab(track.tabId);
                return;
            }

            const response = await chrome.tabs.sendMessage(track.tabId, {
                type: 'CHECK_VISIBILITY',
            });
            if (!response || !response.visible) {
                this.tabTracker.stopTrackingTab(track.tabId);
                return;
            }
        } catch {
            this.tabTracker.stopTrackingTab(track.tabId);
        }
    };
}
