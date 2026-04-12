import { AnalyticsChart } from '../analytics-chart.js';
import { AnalyticsHeatmap } from '../analytics-heatmap.js';
import { applyAnalyticsUISetupMethods } from './analytics-ui/setup.js';
import { applyAnalyticsUIStatsMethods } from './analytics-ui/stats.js';
import { applyAnalyticsUITopSitesMethods } from './analytics-ui/top-sites.js';

export class AnalyticsUI {
    constructor(controller) {
        this.controller = controller;
        this.earliestDate = null;
        this.currentPeriod = 'week';

        const dataContext = {
            getUsage: () => this.controller.usage,
            getEarliestDate: () => this.earliestDate,
            getRestrictedDomains: () => this.controller.restrictedDomains || [],
            getSettings: () => this.controller.settings
        };

        this.chart = new AnalyticsChart(dataContext);
        this.heatmap = new AnalyticsHeatmap(dataContext);
    }
}

applyAnalyticsUISetupMethods(AnalyticsUI);
applyAnalyticsUIStatsMethods(AnalyticsUI);
applyAnalyticsUITopSitesMethods(AnalyticsUI);
