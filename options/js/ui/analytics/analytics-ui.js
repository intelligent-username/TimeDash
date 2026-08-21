import { AnalyticsChart } from '../analytics-chart.js';
import { AnalyticsHeatmap } from '../analytics-heatmap.js';
import { applyAnalyticsUISetupMethods } from './analytics-ui/setup.js';
import { applyAnalyticsUIStatsMethods } from './analytics-ui/stats.js';
import { applyAnalyticsUITopSitesMethods } from './analytics-ui/top-sites.js';
import { formatDateString } from '../../utils/formatting.js';

/**
 *
 */
export class AnalyticsUI {
    /**
     * @param {object} controller - Options controller instance.
     */
    constructor(controller) {
        this.controller = controller;
        this.earliestDate = null;
        this.currentPeriod = 'week';

        const dataContext = {
            getUsage: () => this.controller.usage,
            getEarliestDate: () => this.earliestDate,
            getRestrictedDomains: () => this.controller.restrictedDomains || [],
            getSettings: () => this.controller.settings,
        };

        this.chart = new AnalyticsChart(dataContext);
        this.heatmap = new AnalyticsHeatmap(dataContext);

        this.chart.onPointClick = (dateStr, pointData) => {
            // Sync the restricted-time bar chart to the week containing the clicked day
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                const todayStr = formatDateString(new Date());
                this._restrictedChartEndDate = dateStr === todayStr ? null : dateStr;
                this.renderMiniCharts();
            }
            this.showTopSitesForDate(dateStr, pointData);
        };

        this.heatmap.onDaySelect = (dateStr) => {
            const todayStr = formatDateString(new Date());
            this._restrictedChartEndDate = dateStr === todayStr ? null : dateStr;
            this.renderMiniCharts();
        };
    }
}

applyAnalyticsUISetupMethods(AnalyticsUI);
applyAnalyticsUIStatsMethods(AnalyticsUI);
applyAnalyticsUITopSitesMethods(AnalyticsUI);
