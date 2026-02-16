import { AnalyticsChart } from './analytics-chart.js';
import { AnalyticsHeatmap } from './analytics-heatmap.js';
import { formatTime, formatDateString, escapeHtml } from '../utils/formatting.js';

export class AnalyticsUI {
    constructor(controller) {
        this.controller = controller;
        this.earliestDate = null;
        this.currentPeriod = 'week';

        const dataContext = {
            getUsage: () => this.controller.usage,
            getEarliestDate: () => this.earliestDate,
            getRestrictedDomains: () => this.controller.restrictedDomains || []
        };

        this.chart = new AnalyticsChart(dataContext);
        this.heatmap = new AnalyticsHeatmap(dataContext);
    }

    setup() {
        // Chart controls
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentPeriod = e.target.dataset.period;
                this.chart.setPeriod(this.currentPeriod);
                this.chart.render();
                this.updatePeriodStats(); // Update stats for new period
            });
        });

        const prevBtn = document.getElementById('chartPrev');
        const nextBtn = document.getElementById('chartNext');
        if (prevBtn) prevBtn.addEventListener('click', () => {
            this.chart.navigate('prev');
            this.chart.render();
            this.updatePeriodStats();
        });
        if (nextBtn) nextBtn.addEventListener('click', () => {
            this.chart.navigate('next');
            this.chart.render();
            this.updatePeriodStats();
        });

        // Heatmap filter
        const heatmapFilter = document.getElementById('heatmapFilter');
        if (heatmapFilter) {
            heatmapFilter.addEventListener('change', () => this.heatmap.render());
        }

        // Add "All Time" period option dynamically if not present
        this.addAllTimePeriodOption();
    }

    addAllTimePeriodOption() {
        const periodSelector = document.querySelector('.chart-period-selector');
        if (!periodSelector) return;

        const existingAll = periodSelector.querySelector('[data-period="all"]');
        if (!existingAll) {
            const allBtn = document.createElement('button');
            allBtn.className = 'period-btn';
            allBtn.dataset.period = 'all';
            allBtn.textContent = 'All Time';
            periodSelector.appendChild(allBtn);

            allBtn.addEventListener('click', (e) => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentPeriod = 'all';
                this.chart.setPeriod('all');
                this.chart.render();
                this.updatePeriodStats();
            });
        }
    }

    update() {
        const usage = this.controller.usage || {};
        const domains = Object.keys(usage);
        const now = new Date();
        const today = formatDateString(now);

        let totalToday = 0;
        let totalOverall = 0;
        const sitesWithTime = [];
        let earliestDate = null;

        for (const domain of domains) {
            const domainData = usage[domain];
            const todayTime = (domainData[today] || 0) * 1000;
            const cumulative = (domainData.cumulative || 0) * 1000;

            totalToday += todayTime;
            totalOverall += cumulative;

            if (todayTime > 0) {
                sitesWithTime.push({ domain, todayTime, cumulative });
            }

            for (const key of Object.keys(domainData)) {
                if (key.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    if (!earliestDate || key < earliestDate) {
                        earliestDate = key;
                    }
                }
            }
        }

        this.earliestDate = earliestDate;
        this.controller.earliestDate = earliestDate;

        // Update all-time stats
        this.updateStat('analyticsTotalTime', formatTime(totalOverall));
        this.updateStat('analyticsSitesCount', domains.length);

        // Update period-specific stats
        this.updatePeriodStats();

        // Sort and render top sites
        sitesWithTime.sort((a, b) => b.todayTime - a.todayTime);
        this.renderTopSites(sitesWithTime, sitesWithTime[0]?.todayTime || 0);

        this.chart.render();
        this.heatmap.render();
    }

    updatePeriodStats() {
        const usage = this.controller.usage || {};
        const { periodTotal, periodDays, periodLabel } = this.calculatePeriodTotal(usage);

        // Update "Time Today" to show the period total with dynamic label
        const todayEl = document.getElementById('analyticsTodayTotal');
        const todayLabelEl = todayEl?.closest('.stat-card')?.querySelector('.stat-label');

        if (todayEl) {
            todayEl.textContent = formatTime(periodTotal);
        }
        if (todayLabelEl) {
            todayLabelEl.textContent = `Time ${periodLabel}`;
        }

        // Update average
        const avgTime = periodDays > 0 ? Math.round(periodTotal / periodDays) : 0;
        const avgEl = document.getElementById('analyticsWeekAverage');
        const avgLabelEl = avgEl?.closest('.stat-card')?.querySelector('.stat-label');

        if (avgEl) {
            avgEl.textContent = formatTime(avgTime);
        }
        if (avgLabelEl) {
            avgLabelEl.textContent = 'Daily Average';
        }

        // Update "Total Time" to reflect the selected period
        const totalEl = document.getElementById('analyticsTotalTime');
        const totalLabelEl = totalEl?.closest('.stat-card')?.querySelector('.stat-label');

        if (totalEl) {
            totalEl.textContent = formatTime(periodTotal);
        }
        if (totalLabelEl) {
            totalLabelEl.textContent = `Total ${periodLabel}`;
        }
    }

    calculatePeriodTotal(usage) {
        const now = new Date();
        const todayStr = formatDateString(now);
        const earliestStr = this.earliestDate || todayStr;
        const domains = Object.keys(usage);

        let periodTotal = 0;
        let periodDays = 0;
        let periodLabel = 'Today';

        // Helper: Day is valid if it's not before tracking started AND not in future
        const isValidDay = (dStr) => {
            return dStr >= earliestStr && dStr <= todayStr;
        };

        if (this.currentPeriod === 'week') {
            // Rolling 7-day window matching chart logic
            const endDate = new Date(now);
            endDate.setDate(now.getDate() + (this.chart.offset * 7));
            const startDate = new Date(endDate);
            startDate.setDate(endDate.getDate() - 6);
            periodLabel = this.chart.offset === 0 ? 'Past 7 Days' : 'Selected Week';

            for (let i = 0; i < 7; i++) {
                const d = new Date(startDate);
                d.setDate(startDate.getDate() + i);
                const dateStr = formatDateString(d);

                if (isValidDay(dateStr)) {
                    periodDays++;
                }

                for (const domain of domains) {
                    periodTotal += (usage[domain][dateStr] || 0) * 1000;
                }
            }
        } else if (this.currentPeriod === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth() + this.chart.offset, 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + this.chart.offset + 1, 0);
            const daysInMonth = endOfMonth.getDate();
            periodLabel = this.chart.offset === 0 ? 'This Month' : 'Selected Month';

            for (let i = 1; i <= daysInMonth; i++) {
                const d = new Date(startOfMonth);
                d.setDate(i);
                const dateStr = formatDateString(d);

                if (isValidDay(dateStr)) {
                    periodDays++;
                }

                for (const domain of domains) {
                    periodTotal += (usage[domain][dateStr] || 0) * 1000;
                }
            }
        } else if (this.currentPeriod === 'year') {
            const year = now.getFullYear() + this.chart.offset;
            periodLabel = this.chart.offset === 0 ? 'This Year' : year.toString();

            for (let month = 0; month < 12; month++) {
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = formatDateString(new Date(year, month, day));

                    if (isValidDay(dateStr)) {
                        periodDays++;
                    }

                    for (const domain of domains) {
                        periodTotal += (usage[domain][dateStr] || 0) * 1000;
                    }
                }
            }
        } else if (this.currentPeriod === 'all') {
            periodLabel = 'All Time';
            // Count all days and sum cumulative
            for (const domain of domains) {
                periodTotal += (usage[domain].cumulative || 0) * 1000;
            }
            // Estimate days from earliest to now
            if (this.earliestDate) {
                const earliest = new Date(this.earliestDate);
                // Ensure we don't count partial days weirdly or negative
                const diffTime = Math.max(0, now - earliest);
                periodDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
            } else {
                periodDays = 1;
            }
        } else {
            // Default: today only
            const today = formatDateString(now);
            periodDays = 1;
            periodLabel = 'Today';
            for (const domain of domains) {
                periodTotal += (usage[domain][today] || 0) * 1000;
            }
        }

        return { periodTotal, periodDays, periodLabel };
    }

    updateStat(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    renderTopSites(sites, maxTime) {
        const container = document.getElementById('analyticsTopSites');
        if (!container) return;

        if (sites.length === 0) {
            container.innerHTML = '<div class="analytics-empty-state">No activity recorded today.</div>';
            return;
        }

        container.innerHTML = sites.slice(0, 10).map(site => {
            const barWidth = maxTime > 0 ? Math.round((site.todayTime / maxTime) * 100) : 0;
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${site.domain}&sz=32`;

            return `
                <div class="analytics-site-item">
                    <img class="analytics-site-favicon" src="${faviconUrl}" alt="" onerror="this.style.display='none'">
                    <div class="analytics-site-info">
                        <div class="analytics-site-name">${escapeHtml(site.domain)}</div>
                        <div class="analytics-site-time">${formatTime(site.todayTime)}</div>
                    </div>
                    <div class="analytics-site-bar">
                        <div class="analytics-site-bar-fill" style="width: ${barWidth}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }
}
