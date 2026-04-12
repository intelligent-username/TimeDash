import { formatDateString } from '../../utils/formatting.js';

export function applyAnalyticsChartTotalsMethods(AnalyticsChart) {
    AnalyticsChart.prototype.calculateTotals = function calculateTotals(dates, isYearly, year, isAllTime = false, years = []) {
        const dailyTotals = [];
        const usage = this.dataContext.getUsage();

        if (isAllTime && years.length > 0) {
            for (const currentYear of years) {
                let yearTotal = 0;
                for (let month = 0; month < 12; month++) {
                    const daysInMonth = new Date(currentYear, month + 1, 0).getDate();
                    for (let day = 1; day <= daysInMonth; day++) {
                        const dateStr = formatDateString(new Date(currentYear, month, day));
                        for (const domain of Object.keys(usage)) {
                            yearTotal += (usage[domain][dateStr] || 0) * 1000;
                        }
                    }
                }

                dailyTotals.push({ date: currentYear.toString(), time: yearTotal });
            }

            return dailyTotals;
        }

        if (isYearly) {
            for (let month = 0; month < 12; month++) {
                let monthTotal = 0;
                const daysInMonth = new Date(year, month + 1, 0).getDate();

                for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = formatDateString(new Date(year, month, day));
                    for (const domain of Object.keys(usage)) {
                        monthTotal += (usage[domain][dateStr] || 0) * 1000;
                    }
                }

                const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                });

                dailyTotals.push({ date: monthLabel, time: monthTotal });
            }

            return dailyTotals;
        }

        const todayStr = formatDateString(new Date());

        for (const date of dates) {
            if (date > todayStr) {
                dailyTotals.push({ date, time: null });
                continue;
            }

            let dayTotal = 0;
            for (const domain of Object.keys(usage)) {
                dayTotal += (usage[domain][date] || 0) * 1000;
            }

            dailyTotals.push({ date, time: dayTotal });
        }

        return dailyTotals;
    };
}
