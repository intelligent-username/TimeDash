import { formatTime, formatDateString } from '../../../utils/formatting.js';

export function applyAnalyticsUIStatsMethods(AnalyticsUI) {
    AnalyticsUI.prototype.update = function update() {
        const usage = this.controller.usage || {};
        const domains = Object.keys(usage);
        const today = formatDateString(new Date());

        let totalOverall = 0;
        const sitesWithTime = [];
        let earliestDate = null;

        for (const domain of domains) {
            const domainData = usage[domain];
            const todayTime = (domainData[today] || 0) * 1000;
            const cumulative = (domainData.cumulative || 0) * 1000;
            totalOverall += cumulative;

            if (todayTime > 0) sitesWithTime.push({ domain, todayTime, cumulative });

            for (const key of Object.keys(domainData)) {
                if (/^\d{4}-\d{2}-\d{2}$/.test(key) && (!earliestDate || key < earliestDate)) {
                    earliestDate = key;
                }
            }
        }

        this.earliestDate = earliestDate;
        this.controller.earliestDate = earliestDate;

        this.updateStat('analyticsTotalTime', formatTime(totalOverall));
        this.updateStat('analyticsSitesCount', domains.length);
        this.updatePeriodStats();

        sitesWithTime.sort((a, b) => b.todayTime - a.todayTime);
        this.renderTopSites(sitesWithTime, sitesWithTime[0] ? sitesWithTime[0].todayTime : 0);

        this.chart.render();
        this.heatmap.render();
    };

    AnalyticsUI.prototype.updatePeriodStats = function updatePeriodStats() {
        const usage = this.controller.usage || {};
        const { periodTotal, periodDays, periodLabel } = this.calculatePeriodTotal(usage);

        const todayEl = document.getElementById('analyticsTodayTotal');
        const avgEl = document.getElementById('analyticsWeekAverage');
        const totalEl = document.getElementById('analyticsTotalTime');

        this.setStatCardValue(todayEl, formatTime(periodTotal), `Time ${periodLabel}`);
        const avgTime = periodDays > 0 ? Math.round(periodTotal / periodDays) : 0;
        this.setStatCardValue(avgEl, formatTime(avgTime), 'Daily Average');
        this.setStatCardValue(totalEl, formatTime(periodTotal), `Total ${periodLabel}`);
    };

    AnalyticsUI.prototype.setStatCardValue = function setStatCardValue(valueEl, value, label) {
        if (!valueEl) return;
        valueEl.textContent = value;
        const labelEl = valueEl.closest('.stat-card')?.querySelector('.stat-label');
        if (labelEl) labelEl.textContent = label;
    };

    AnalyticsUI.prototype.calculatePeriodTotal = function calculatePeriodTotal(usage) {
        const now = new Date();
        const todayStr = formatDateString(now);
        const earliestStr = this.earliestDate || todayStr;
        const domains = Object.keys(usage);

        let periodTotal = 0;
        let periodDays = 0;
        let periodLabel = 'Today';

        const isValidDay = (dateStr) => dateStr >= earliestStr && dateStr <= todayStr;

        if (this.currentPeriod === 'all') {
            periodLabel = 'All Time';
            for (const domain of domains) periodTotal += (usage[domain].cumulative || 0) * 1000;
            periodDays = this.earliestDate ? Math.ceil(Math.max(0, now - new Date(this.earliestDate)) / 86400000) || 1 : 1;
            return { periodTotal, periodDays, periodLabel };
        }

        if (this.currentPeriod === 'week') {
            const endDate = new Date(now);
            endDate.setDate(now.getDate() + (this.chart.offset * 7));
            const startDate = new Date(endDate);
            startDate.setDate(endDate.getDate() - 6);
            periodLabel = this.chart.offset === 0 ? 'Past 7 Days' : 'Selected Week';
            for (let i = 0; i < 7; i++) {
                const date = new Date(startDate); date.setDate(startDate.getDate() + i);
                const dateStr = formatDateString(date);
                if (isValidDay(dateStr)) periodDays++;
                for (const domain of domains) periodTotal += (usage[domain][dateStr] || 0) * 1000;
            }
        } else if (this.currentPeriod === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth() + this.chart.offset, 1);
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + this.chart.offset + 1, 0).getDate();
            periodLabel = this.chart.offset === 0 ? 'This Month' : 'Selected Month';
            for (let i = 1; i <= daysInMonth; i++) {
                const date = new Date(startOfMonth); date.setDate(i);
                const dateStr = formatDateString(date);
                if (isValidDay(dateStr)) periodDays++;
                for (const domain of domains) periodTotal += (usage[domain][dateStr] || 0) * 1000;
            }
        } else if (this.currentPeriod === 'year') {
            const year = now.getFullYear() + this.chart.offset;
            periodLabel = this.chart.offset === 0 ? 'This Year' : year.toString();
            for (let month = 0; month < 12; month++) {
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = formatDateString(new Date(year, month, day));
                    if (isValidDay(dateStr)) periodDays++;
                    for (const domain of domains) periodTotal += (usage[domain][dateStr] || 0) * 1000;
                }
            }
        } else {
            const today = formatDateString(now);
            periodDays = 1;
            periodLabel = 'Today';
            for (const domain of domains) periodTotal += (usage[domain][today] || 0) * 1000;
        }

        return { periodTotal, periodDays, periodLabel };
    };

    AnalyticsUI.prototype.updateStat = function updateStat(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
}
