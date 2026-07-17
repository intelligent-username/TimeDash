/* global TimeUtils, BlockedRule */
function applyBackgroundDataMethods(TimeDashBackground) {
    TimeDashBackground.prototype.getTabInfo = async function getTabInfo(tabId) {
        if (!this.currentTrack || this.currentTrack.tabId !== tabId) return null;

        const usage = await this.storage.getDomainUsage(this.currentTrack.domain);
        return {
            domain: this.currentTrack.domain,
            todayTime: TimeUtils.calculateTodayTime(usage),
            totalTime: TimeUtils.calculateTotalTime(usage),
            isTracking: true,
        };
    };

    TimeDashBackground.prototype.getUsageData = async function getUsageData() {
        const usage = await this.storage.getAllUsage();
        const settings = await this.storage.getSettings();
        const blockList = this.ruleManager.getBlockedDomains();

        const domains = Object.entries(usage)
            .map(([domain, data]) => ({
                domain,
                todayTime: TimeUtils.calculateTodayTime(data),
                totalTime: TimeUtils.calculateTotalTime(data),
                averageTime: TimeUtils.calculateAverageTime(data),
                isBlocked: blockList.includes(domain),
            }))
            .sort((a, b) => b.todayTime - a.todayTime);

        return {
            domains,
            settings,
            totalToday: domains.reduce((sum, value) => sum + value.todayTime, 0),
            totalOverall: domains.reduce((sum, value) => sum + value.totalTime, 0),
        };
    };

    TimeDashBackground.prototype.toggleTracking = async function toggleTracking() {
        const settings = await this.storage.getSettings();
        settings.trackingEnabled = !settings.trackingEnabled;
        await this.storage.setSettings(settings);
    };

    TimeDashBackground.prototype.toggleSiteBlock = async function toggleSiteBlock(domain) {
        if (!domain) return;

        const normalized = domain.toLowerCase().replace(/^www\./, '');
        const existing = this.ruleManager.rules.get(normalized);
        if (existing && existing.type === 'BLOCKED') {
            this.ruleManager.removeRule(normalized);
        } else {
            this.ruleManager.addRule(new BlockedRule(normalized));
        }

        await this.ruleManager.saveToStorage();
        this.broadcastUpdate();
    };
}
