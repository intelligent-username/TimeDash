'use strict';

function applyBackgroundDataMethods(TimeDashBackground) {
    TimeDashBackground.prototype.getTabInfo = async function getTabInfo(tabId) {
        const tabInfo = this.activeTabInfo.get(tabId);
        if (!tabInfo) return null;

        const usage = await this.storage.getDomainUsage(tabInfo.domain);
        return {
            domain: tabInfo.domain,
            todayTime: TimeUtils.calculateTodayTime(usage),
            totalTime: TimeUtils.calculateTotalTime(usage),
            isTracking: tabInfo.isActive,
        };
    };

    TimeDashBackground.prototype.getUsageData = async function getUsageData() {
        const usage = await this.storage.getAllUsage();
        const settings = await this.storage.getSettings();
        const blockList = await this.storage.getBlockList();

        const domains = Object.entries(usage)
            .map(([domain, data]) => ({
                domain,
                todayTime: TimeUtils.calculateTodayTime(data),
                totalTime: TimeUtils.calculateTotalTime(data),
                averageTime: TimeUtils.calculateAverageTime(data),
                isBlocked: blockList.includes(domain),
                productivity: DomainUtils.getProductivityScore(domain),
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

        const blockList = await this.storage.getBlockList();
        const idx = blockList.indexOf(domain);
        if (idx >= 0) blockList.splice(idx, 1);
        else blockList.push(domain);

        await this.storage.setBlockList(blockList);
    };
}
