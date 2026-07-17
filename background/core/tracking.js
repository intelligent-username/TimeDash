'use strict';

/* global DomainUtils, TimeUtils */

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

            // Perform real-time limit/blocking check
            const domain = DomainUtils.extractDomain(tab.url);
            await this.tabTracker.checkAndHandleBlocking(tab, domain);
        } catch {
            this.tabTracker.stopTrackingTab(track.tabId);
        }
    };

    TimeDashBackground.prototype.getRealTimeUsage = async function getRealTimeUsage(
        domain,
        allUsage = null
    ) {
        let totalSeconds = 0;
        const normalized = DomainUtils.normalizeDomain(domain);

        // 1. Get stored usage for this normalized domain
        if (!allUsage) {
            allUsage = await this.storage.getAllUsage();
        }
        if (allUsage[normalized]) {
            totalSeconds += TimeUtils.calculateTodayTime(allUsage[normalized]);
        }

        // 2. Add pending updates from memory
        if (this.pendingUpdates && this.pendingUpdates.has(normalized)) {
            totalSeconds += this.pendingUpdates.get(normalized);
        }

        // 3. Add currently active tracking time if it matches
        const track = this.currentTrack;
        if (track && track.domain) {
            const trackNormalized = DomainUtils.normalizeDomain(track.domain);
            if (trackNormalized === normalized) {
                const elapsed = Math.floor((Date.now() - track.startTime) / 1000);
                if (elapsed > 0) {
                    totalSeconds += elapsed;
                }
            }
        }

        return totalSeconds;
    };

    TimeDashBackground.prototype.evaluateAccessForDomain = async function evaluateAccessForDomain(
        url,
        domain
    ) {
        const settings = await this.storage.getSettings();
        const dailyLimitMinutes = Number(settings.dailyTimeLimitMinutes || 0);

        let allUsage = null;
        if (dailyLimitMinutes > 0) {
            allUsage = await this.storage.getAllUsage();
            let totalTodaySeconds = 0;
            for (const domainUsage of Object.values(allUsage)) {
                totalTodaySeconds += TimeUtils.calculateTodayTime(domainUsage || {});
            }
            if (this.pendingUpdates) {
                for (const timeSpent of this.pendingUpdates.values()) {
                    totalTodaySeconds += timeSpent;
                }
            }
            const track = this.currentTrack;
            if (track) {
                const elapsed = Math.floor((Date.now() - track.startTime) / 1000);
                if (elapsed > 0) {
                    totalTodaySeconds += elapsed;
                }
            }

            if (totalTodaySeconds >= dailyLimitMinutes * 60) {
                return {
                    shouldBlock: true,
                    reason: 'restricted',
                    domain: domain || DomainUtils.extractDomain(url || ''),
                };
            }
        }

        // Pre-calculate group usage if groups exist
        let groupUsageSecondsMap = {};
        const activeGroups = this.ruleManager.groups.filter(
            (g) => g.isEnabled && !g.deletedAt
        );
        if (activeGroups.length > 0) {
            if (!allUsage) allUsage = await this.storage.getAllUsage();
            for (const g of activeGroups) {
                let total = 0;
                for (const d of g.domains) {
                    total += await this.getRealTimeUsage(d, allUsage);
                }
                groupUsageSecondsMap[g.id] = total;
            }
        }

        const todayTimeSeconds = await this.getRealTimeUsage(domain, allUsage);
        return this.ruleManager.evaluateAccess(
            url,
            { todayTimeSeconds },
            groupUsageSecondsMap
        );
    };
}
