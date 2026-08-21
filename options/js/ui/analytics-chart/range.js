import { formatDateString } from '../../utils/formatting.js';

/**
 * @param {typeof AnalyticsChart} AnalyticsChart - AnalyticsChart class to extend with range methods.
 */
export function applyAnalyticsChartRangeMethods(AnalyticsChart) {
    AnalyticsChart.prototype.getDateRange = function getDateRange() {
        const now = new Date();

        if (this.period === 'week') {
            return this.getWeekRange(now);
        }

        if (this.period === 'month') {
            return this.getMonthRange(now);
        }

        if (this.period === 'year') {
            const year = now.getFullYear() + this.offset;
            const label =
                this.offset === 0
                    ? chrome.i18n.getMessage('thisYear')
                    : this.offset === -1
                      ? chrome.i18n.getMessage('lastYear')
                      : year.toString();
            const xLabels = Array.from({ length: 12 }, (_, m) =>
                new Date(year, m, 1).toLocaleDateString(undefined, { month: 'short' })
            );
            return { dates: [], label, xLabels, isYearly: true, year };
        }

        if (this.period === 'all') {
            return this.getAllRange(now);
        }

        return { dates: [], label: '', xLabels: [], isYearly: false, year: null };
    };

    AnalyticsChart.prototype.getWeekRange = function getWeekRange(now) {
        const endDate = new Date(now);
        endDate.setDate(now.getDate() + this.offset * 7);

        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 6);

        const dayNames = Array.from({ length: 7 }, (_, d) =>
            new Date(2024, 0, 7 + d).toLocaleDateString(undefined, { weekday: 'short' })
        );
        const dates = [];
        const xLabels = [];

        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            dates.push(formatDateString(date));
            xLabels.push(dayNames[date.getDay()]);
        }

        const label =
            this.offset === 0
                ? chrome.i18n.getMessage('past7Days')
                : `${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

        return { dates, label, xLabels, isYearly: false, year: null };
    };

    AnalyticsChart.prototype.getMonthRange = function getMonthRange(now) {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth() + this.offset, 1);
        const daysInMonth = new Date(
            now.getFullYear(),
            now.getMonth() + this.offset + 1,
            0
        ).getDate();
        const dates = [];

        for (let i = 0; i < daysInMonth; i++) {
            const date = new Date(startOfMonth);
            date.setDate(i + 1);
            dates.push(formatDateString(date));
        }

        let xLabels = [
            '1',
            '',
            '',
            '',
            '5',
            '',
            '',
            '',
            '',
            '10',
            '',
            '',
            '',
            '',
            '15',
            '',
            '',
            '',
            '',
            '20',
            '',
            '',
            '',
            '',
            '25',
            '',
            '',
            '',
            '',
            '30',
            '',
        ];
        xLabels = xLabels.slice(0, daysInMonth);

        let label = chrome.i18n.getMessage('thisMonth');
        if (this.offset === -1) label = chrome.i18n.getMessage('lastMonth');
        else if (this.offset !== 0) {
            label = startOfMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        }

        return { dates, label, xLabels, isYearly: false, year: null };
    };

    AnalyticsChart.prototype.getAllRange = function getAllRange(now) {
        const earliestDate = this.dataContext.getEarliestDate();
        const todayStr = formatDateString(now);
        const startStr = earliestDate || todayStr;

        const [sy, sm, sd] = startStr.split('-').map(Number);
        const dateCursor = new Date(sy, sm - 1, sd);
        const dates = [];

        while (true) {
            const currentStr = formatDateString(dateCursor);
            if (currentStr > todayStr) break;
            dates.push(currentStr);
            dateCursor.setDate(dateCursor.getDate() + 1);
        }

        const xLabels = this.buildAllTimeLabels(dates);
        return { dates, label: chrome.i18n.getMessage('allTime'), xLabels, isYearly: false, isAllTime: false };
    };

    AnalyticsChart.prototype.buildAllTimeLabels = function buildAllTimeLabels(dates) {
        const count = dates.length;
        const numLabels = 6;

        if (count <= numLabels) {
            return dates.map((dateStr) => {
                const [y, m, day] = dateStr.split('-').map(Number);
                return new Date(y, m - 1, day).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                });
            });
        }

        const xLabels = [];
        for (let i = 0; i < numLabels; i++) {
            const idx = Math.round((i * (count - 1)) / (numLabels - 1));
            if (idx >= dates.length) continue;

            const [y, m, day] = dates[idx].split('-').map(Number);
            xLabels.push(
                new Date(y, m - 1, day).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: '2-digit',
                })
            );
        }

        return xLabels;
    };

    AnalyticsChart.prototype.getMinOffset = function getMinOffset() {
        const earliestDate = this.dataContext.getEarliestDate();
        if (!earliestDate) return -52;

        const now = new Date();
        const earliest = new Date(earliestDate);

        if (this.period === 'week') {
            const diffTime = Math.abs(now - earliest);
            return -Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
        }

        if (this.period === 'month') {
            const monthDiff =
                (now.getFullYear() - earliest.getFullYear()) * 12 +
                (now.getMonth() - earliest.getMonth());
            return -monthDiff;
        }

        if (this.period === 'year') {
            const yearDiff = now.getFullYear() - earliest.getFullYear();
            return -yearDiff;
        }

        return -10;
    };
}
