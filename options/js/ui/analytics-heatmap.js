import { formatTime, formatDateString } from '../utils/formatting.js';

export class AnalyticsHeatmap {
    constructor(dataContext) {
        this.dataContext = dataContext;
        this._selectedDate = null;
        this.yearOffset = 0;
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

    _formatDisplayDate(date, showYear = false) {
        const opts = { day: 'numeric', month: 'short' };
        if (showYear) opts.year = 'numeric';
        return date.toLocaleDateString(undefined, opts);
    }

    render() {
        if (!this._navBound) {
            this._setupYearNav();
            this._navBound = true;
        }

        const grid = document.getElementById('heatmapGrid');
        const monthsRow = document.getElementById('heatmapMonths');
        const filter = document.getElementById('heatmapFilter')?.value || 'all';

        if (!grid) return;

        const today = new Date();
        const todayStr = formatDateString(today);
        const MS_PER_DAY = 86400000;
        const earliestDate = this.dataContext.getEarliestDate();
        const earliestYear = earliestDate
            ? parseInt(earliestDate.split('-')[0], 10)
            : today.getFullYear();

        const targetYear = today.getFullYear() + this.yearOffset;
        let startDate, totalDays;

        if (this.yearOffset === 0) {
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 364);
            startDate.setDate(startDate.getDate() - startDate.getDay());
            totalDays = Math.round((today.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
        } else {
            startDate = new Date(targetYear, 0, 1);
            startDate.setDate(startDate.getDate() - startDate.getDay());
            const endDate = new Date(targetYear, 11, 31);
            endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
            totalDays = Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
        }

        const domainsToInclude = filter === 'restricted'
            ? this.dataContext.getRestrictedDomains()
            : Object.keys(this.dataContext.getUsage());

        const usage = this.dataContext.getUsage();

        const startMs = startDate.getTime();
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

        for (let i = 0; i < totalDays; i++) {
            const d = new Date(startMs + i * MS_PER_DAY);
            const dateStr = formatDateString(d);
            const time = dailyData[dateStr] || 0;
            const level = this.getLevel(time, maxTime);
            const isEarliest = dateStr === earliestDate;
            const isSelected = dateStr === this._selectedDate;
            const isToday = dateStr === todayStr;

            const localDate = this._parseLocalDate(dateStr);
            const showYear = this.yearOffset !== 0;
            const compactDate = this._formatDisplayDate(localDate, showYear);
            const isBeforeFirstDay = earliestDate && dateStr < earliestDate;
            const tooltip = isBeforeFirstDay
                ? compactDate
                : `${compactDate}: ${formatTime(time, true)}${isEarliest ? ' 🟨' : ''}`;

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
            monthsRow.style.display = 'grid';
            monthsRow.style.gridTemplateColumns = `repeat(${weeks}, 1fr)`;
            
            monthsRow.innerHTML = monthPositions.map((m, i) => {
                const endCol = monthPositions[i + 1]?.index || weeks;
                const cols = endCol - m.index;
                return `<span style="grid-column: ${m.index + 1} / span ${cols}; text-align: center;">${m.month}</span>`;
            }).join('');
        }

        grid.querySelectorAll('.heatmap-cell[data-date]').forEach((cell) => {
            cell.addEventListener('click', () => this._onCellClick(cell.dataset.date, dailyData));
            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._onCellClick(cell.dataset.date, dailyData);
                }
            });
        });

        this._updateYearNav(earliestYear);
    }

    _onCellClick(dateStr, dailyData) {
        const heading = document.getElementById('topSitesHeading');
        if (!heading) return;

        const localDate = this._parseLocalDate(dateStr);
        const todayStr = formatDateString(new Date());
        const isToday = dateStr === todayStr;

        if (isToday) {
            heading.textContent = 'Top Sites Today';
            this._selectedDate = null;
        } else {
            const showYear = this.yearOffset !== 0;
            heading.textContent = `Top Sites on ${this._formatDisplayDate(localDate, showYear)}`;
            this._selectedDate = dateStr;
        }

        const usage = this.dataContext.getUsage();
        const sitesWithTime = [];

        for (const domain of Object.keys(usage)) {
            const domainData = usage[domain];
            const timeMs = (domainData[dateStr] || 0) * 1000;
            if (timeMs > 0) sitesWithTime.push({ domain, todayTime: timeMs });
        }

        sitesWithTime.sort((a, b) => b.todayTime - a.todayTime);

        const container = document.getElementById('analyticsTopSites');
        if (!container) return;

        if (sitesWithTime.length === 0) {
            const showYear = this.yearOffset !== 0;
            container.innerHTML = `<div class="analytics-empty-state">No activity recorded${isToday ? ' today' : ` on ${this._formatDisplayDate(localDate, showYear)}`}.</div>`;
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
                        <div class="analytics-site-time">${formatTime(site.todayTime, true)}</div>
                    </div>
                    <div class="analytics-site-bar">
                        <div class="analytics-site-bar-fill" style="width: ${barWidth}%"></div>
                    </div>
                </div>
            `;
        }).join('');

        const grid = document.getElementById('heatmapGrid');
        if (grid) {
            grid.querySelectorAll('.heatmap-cell--selected').forEach((el) => el.classList.remove('heatmap-cell--selected'));
            if (!isToday) {
                const selectedCell = grid.querySelector(`[data-date="${dateStr}"]`);
                if (selectedCell) selectedCell.classList.add('heatmap-cell--selected');
            }
        }
    }

    _updateYearNav(earliestYear) {
        const label = document.getElementById('heatmapYearLabel');
        const prevBtn = document.getElementById('heatmapYearPrev');
        const nextBtn = document.getElementById('heatmapYearNext');
        if (!label) return;

        const currentYear = new Date().getFullYear();
        const displayYear = currentYear + this.yearOffset;
        label.textContent = displayYear;

        if (prevBtn) prevBtn.style.display = displayYear <= earliestYear ? 'none' : '';
        if (nextBtn) nextBtn.style.display = this.yearOffset >= 0 ? 'none' : '';
    }

    _setupYearNav() {
        const prevBtn = document.getElementById('heatmapYearPrev');
        const nextBtn = document.getElementById('heatmapYearNext');
        if (!prevBtn || !nextBtn) return;

        prevBtn.addEventListener('click', () => {
            this.yearOffset--;
            this._selectedDate = null;
            this.render();
            const heading = document.getElementById('topSitesHeading');
            if (heading) heading.textContent = 'Top Sites Today';
        });

        nextBtn.addEventListener('click', () => {
            this.yearOffset++;
            this._selectedDate = null;
            this.render();
            const heading = document.getElementById('topSitesHeading');
            if (heading) heading.textContent = 'Top Sites Today';
        });
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
