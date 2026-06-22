import { formatTime, formatDateString } from '../utils/formatting.js';

export class AnalyticsHeatmap {
    constructor(dataContext) {
        this.dataContext = dataContext; // usage, earliestDate, restrictedDomains getter
        this._selectedDate = null;      // tracks the clicked cell date
    }

    /**
     * Parse a YYYY-MM-DD string as a LOCAL date (not UTC).
     * new Date('2024-01-15') parses as UTC midnight, which is the previous
     * day in negative-UTC-offset timezones. We split manually instead.
     */
    _parseLocalDate(dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    /**
     * Format a date for the tooltip / heading using the user's locale.
     * @param {Date} date
     * @returns {string}  e.g. "Mon, Jun 22nd, 2026"
     */
    _formatDisplayDate(date) {
        const day = date.getDate();
        const suffix = ['th', 'st', 'nd', 'rd'][
            day % 10 <= 3 && Math.floor(day / 10) !== 1 ? day % 10 : 0
        ];
        return date.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        }).replace(/(\d+)/, `$1${suffix}`);
    }

    render() {
        const grid = document.getElementById('heatmapGrid');
        const monthsRow = document.getElementById('heatmapMonths');
        const filter = document.getElementById('heatmapFilter')?.value || 'all';

        if (!grid) return;

        // Use local-date-aware "today"
        const today = new Date();
        const todayStr = formatDateString(today);
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 364);
        startDate.setDate(startDate.getDate() - startDate.getDay());

        const domainsToInclude = filter === 'restricted'
            ? this.dataContext.getRestrictedDomains()
            : Object.keys(this.dataContext.getUsage());

        const usage = this.dataContext.getUsage();

        const MS_PER_DAY = 86400000;
        const startMs = startDate.getTime();
        const todayMs = today.getTime();
        const totalDays = Math.round((todayMs - startMs) / MS_PER_DAY) + 1;

        const dailyData = {};
        let maxTime = 0;

        for (let i = 0; i < totalDays; i++) {
            const d = new Date(startMs + i * MS_PER_DAY);
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

        for (let i = 0; i < totalDays; i++) {
            const d = new Date(startMs + i * MS_PER_DAY);
            const dateStr = formatDateString(d);
            const time = dailyData[dateStr] || 0;
            const level = this.getLevel(time, maxTime);
            const isEarliest = dateStr === earliestDate;
            const isSelected = dateStr === this._selectedDate;
            const isToday = dateStr === todayStr;

            // Parse as LOCAL date to avoid timezone-off-by-one in tooltip
            const localDate = this._parseLocalDate(dateStr);
            const displayDate = this._formatDisplayDate(localDate);
            const tooltip = `${displayDate} • ${formatTime(time)}${isEarliest ? ' 🟨 First Day' : ''}`;

            if (d.getMonth() !== lastMonth) {
                monthPositions.push({
                    month: d.toLocaleDateString(undefined, { month: 'short' }),
                    index: Math.floor(cellIndex / 7),
                });
                lastMonth = d.getMonth();
            }

            const classes = [
                'heatmap-cell',
                isEarliest ? 'earliest' : '',
                isSelected ? 'heatmap-cell--selected' : '',
                isToday ? 'heatmap-cell--today' : '',
            ].filter(Boolean).join(' ');

            cells.push(
                `<div class="${classes}" data-level="${level}" data-tooltip="${tooltip}" data-date="${dateStr}" role="button" tabindex="0" aria-label="${tooltip}"></div>`
            );
            cellIndex++;
        }

        const weeks = Math.ceil(cells.length / 7);
        grid.style.gridTemplateColumns = `repeat(${weeks}, 1fr)`;
        grid.innerHTML = cells.join('');

        if (monthsRow) {
            monthsRow.innerHTML = monthPositions.map((m, i) => {
                const nextPos = monthPositions[i + 1]?.index || weeks;
                const width = ((nextPos - m.index) / weeks) * 100;
                return `<span style="width: ${width}%">${m.month}</span>`;
            }).join('');
        }

        // Attach click listeners for "Top Sites on [date]" update
        grid.querySelectorAll('.heatmap-cell[data-date]').forEach((cell) => {
            cell.addEventListener('click', () => this._onCellClick(cell.dataset.date, dailyData));
            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._onCellClick(cell.dataset.date, dailyData);
                }
            });
        });
    }

    _onCellClick(dateStr, dailyData) {
        const heading = document.getElementById('topSitesHeading');
        if (!heading) return;

        // Parse as local date and build a nice label
        const localDate = this._parseLocalDate(dateStr);
        const todayStr = formatDateString(new Date());
        const isToday = dateStr === todayStr;

        if (isToday) {
            heading.textContent = 'Top Sites Today';
            this._selectedDate = null;
        } else {
            const displayDate = this._formatDisplayDate(localDate);
            heading.textContent = `Top Sites on ${displayDate}`;
            this._selectedDate = dateStr;
        }

        // Update the top-sites list for the selected day using the analytics UI
        // The analytics controller exposes renderTopSites via this.dataContext
        const usage = this.dataContext.getUsage();
        const sitesWithTime = [];

        for (const domain of Object.keys(usage)) {
            const domainData = usage[domain];
            const timeMs = (domainData[dateStr] || 0) * 1000;
            if (timeMs > 0) sitesWithTime.push({ domain, todayTime: timeMs });
        }

        sitesWithTime.sort((a, b) => b.todayTime - a.todayTime);

        // Re-render the top sites list directly
        const container = document.getElementById('analyticsTopSites');
        if (!container) return;

        if (sitesWithTime.length === 0) {
            container.innerHTML = `<div class="analytics-empty-state">No activity recorded${isToday ? ' today' : ` on ${this._formatDisplayDate(localDate)}`}.</div>`;
            return;
        }

        const maxTime = sitesWithTime[0]?.todayTime || 0;
        container.innerHTML = sitesWithTime.slice(0, 10).map((site) => {
            const barWidth = maxTime > 0 ? Math.round((site.todayTime / maxTime) * 100) : 0;
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${site.domain}&sz=32`;
            const escaped = site.domain.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `
                <div class="analytics-site-item">
                    <img class="analytics-site-favicon" src="${faviconUrl}" alt="" onerror="this.style.display='none'">
                    <div class="analytics-site-info">
                        <div class="analytics-site-name">${escaped}</div>
                        <div class="analytics-site-time">${formatTime(site.todayTime)}</div>
                    </div>
                    <div class="analytics-site-bar">
                        <div class="analytics-site-bar-fill" style="width: ${barWidth}%"></div>
                    </div>
                </div>
            `;
        }).join('');

        // Re-mark selected cell visually
        const grid = document.getElementById('heatmapGrid');
        if (grid) {
            grid.querySelectorAll('.heatmap-cell--selected').forEach((el) => el.classList.remove('heatmap-cell--selected'));
            if (!isToday) {
                const selectedCell = grid.querySelector(`[data-date="${dateStr}"]`);
                if (selectedCell) selectedCell.classList.add('heatmap-cell--selected');
            }
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
