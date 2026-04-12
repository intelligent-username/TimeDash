import { formatTime, formatDateString } from '../utils/formatting.js';
import { applyAnalyticsChartTotalsMethods } from './analytics-chart/totals.js';
import { applyAnalyticsChartSvgMethods } from './analytics-chart/svg.js';
import { applyAnalyticsChartRangeMethods } from './analytics-chart/range.js';

export class AnalyticsChart {
    constructor(dataContext) {
        this.dataContext = dataContext; // { usage, earliestDate } getter
        this.period = 'week';
        this.offset = 0;
    }

    setPeriod(period) {
        this.period = period;
        this.offset = 0;
    }

    navigate(direction) {
        if (direction === 'prev') {
            const minOffset = this.getMinOffset();
            if (this.offset > minOffset) this.offset--;
        } else if (direction === 'next') {
            if (this.offset < 0) this.offset++;
        }
    }

    render() {
        const chartContent = document.getElementById('chartContent');
        const chartXAxis = document.getElementById('chartXAxis');
        const chartYAxis = document.getElementById('chartYAxis');
        const periodLabel = document.getElementById('chartPeriodLabel');
        const nextBtn = document.getElementById('chartNext');
        const prevBtn = document.getElementById('chartPrev');

        if (!chartContent) return;

        const { dates, label, xLabels, isYearly, year, isAllTime, years } = this.getDateRange();
        if (periodLabel) periodLabel.textContent = label;

        // Disable navigation for 'all' period
        if (this.period === 'all') {
            if (nextBtn) nextBtn.disabled = true;
            if (prevBtn) prevBtn.disabled = true;
        } else {
            if (nextBtn) nextBtn.disabled = this.offset >= 0;
            if (prevBtn) {
                const minOffset = this.getMinOffset();
                prevBtn.disabled = this.offset <= minOffset;
            }
        }

        const dailyTotals = this.calculateTotals(dates, isYearly, year, isAllTime, years);
        const validTotals = dailyTotals.filter((day) => day.time !== null);
        const maxTime = Math.max(...validTotals.map((day) => day.time), 0);

        const yLabels = [formatTime(maxTime), formatTime(maxTime / 2), '0'];
        if (chartYAxis) chartYAxis.innerHTML = yLabels.map((labelText) => `<span>${labelText}</span>`).join('');

        this.renderSvgChart(chartContent, dailyTotals, maxTime, isYearly || isAllTime);

        if (chartXAxis) chartXAxis.innerHTML = xLabels.map((labelText) => `<span>${labelText}</span>`).join('');
    }
}

applyAnalyticsChartTotalsMethods(AnalyticsChart);
applyAnalyticsChartSvgMethods(AnalyticsChart);
applyAnalyticsChartRangeMethods(AnalyticsChart);
