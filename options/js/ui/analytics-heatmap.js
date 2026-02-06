import { formatTime, formatDateString } from '../utils/formatting.js';

export class AnalyticsHeatmap {
    constructor(dataContext) {
        this.dataContext = dataContext; // usage, earliestDate, restrictedDomains getter
    }

    render() {
        const grid = document.getElementById('heatmapGrid');
        const monthsRow = document.getElementById('heatmapMonths');
        const filter = document.getElementById('heatmapFilter')?.value || 'all';

        if (!grid) return;

        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 364);
        startDate.setDate(startDate.getDate() - startDate.getDay());

        const domainsToInclude = filter === 'restricted'
            ? this.dataContext.getRestrictedDomains()
            : Object.keys(this.dataContext.getUsage());

        const dailyData = {};
        let maxTime = 0;
        const usage = this.dataContext.getUsage();

        for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
            const dateStr = formatDateString(d);
            let dayTotal = 0;
            for (const domain of domainsToInclude) {
                if (usage[domain]) {
                    dayTotal += (usage[domain][dateStr] || 0) * 1000;
                }
            }
            dailyData[dateStr] = dayTotal;
            if (dayTotal > maxTime) maxTime = dayTotal;
        }

        const cells = [];
        const monthPositions = [];
        let lastMonth = -1;
        let cellIndex = 0;
        const earliestDate = this.dataContext.getEarliestDate();

        for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
            const dateStr = formatDateString(d);
            const time = dailyData[dateStr] || 0;
            const level = this.getLevel(time, maxTime);
            const isEarliest = dateStr === earliestDate;

            const displayDate = new Date(dateStr).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
            const tooltip = `${displayDate} • ${formatTime(time)}`;

            if (d.getMonth() !== lastMonth) {
                monthPositions.push({ month: d.toLocaleDateString('en-US', { month: 'short' }), index: Math.floor(cellIndex / 7) });
                lastMonth = d.getMonth();
            }

            cells.push(`<div class="heatmap-cell${isEarliest ? ' earliest' : ''}" data-level="${level}" data-tooltip="${tooltip}"></div>`);
            cellIndex++;
        }

        grid.innerHTML = cells.join('');

        if (monthsRow) {
            const weeks = Math.ceil(cells.length / 7);
            monthsRow.innerHTML = monthPositions.map((m, i) => {
                const nextPos = monthPositions[i + 1]?.index || weeks;
                const width = ((nextPos - m.index) / weeks) * 100;
                return `<span style="width: ${width}%">${m.month}</span>`;
            }).join('');
        }
    }

    getLevel(time, maxTime) {
        if (time === 0 || maxTime === 0) return 0;
        const ratio = time / maxTime;
        if (ratio < 0.25) return 1;
        if (ratio < 0.5) return 2;
        if (ratio < 0.75) return 3;
        return 4;
    }
}
