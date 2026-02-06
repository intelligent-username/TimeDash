import { AnalyticsChart } from './analytics-chart.js';
import { AnalyticsHeatmap } from './analytics-heatmap.js';
import { formatTime, formatDateString, escapeHtml } from '../utils/formatting.js';

export class AnalyticsUI {
    constructor(controller) {
        this.controller = controller;
        this.earliestDate = null;

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
                this.chart.setPeriod(e.target.dataset.period);
                this.chart.render();
            });
        });

        const prevBtn = document.getElementById('chartPrev');
        const nextBtn = document.getElementById('chartNext');
        if (prevBtn) prevBtn.addEventListener('click', () => { this.chart.navigate('prev'); this.chart.render(); });
        if (nextBtn) nextBtn.addEventListener('click', () => { this.chart.navigate('next'); this.chart.render(); });

        // Heatmap filter
        const heatmapFilter = document.getElementById('heatmapFilter');
        if (heatmapFilter) {
            heatmapFilter.addEventListener('change', () => this.heatmap.render());
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
        this.controller.earliestDate = earliestDate; // Sync back if needed

        // Update stats UI
        this.updateStat('analyticsTodayTotal', formatTime(totalToday));
        this.updateStat('analyticsTotalTime', formatTime(totalOverall)); // Rough total
        this.updateStat('analyticsSitesCount', domains.length);

        // Simple avg calc
        const avg = totalOverall > 0 ? Math.round(totalOverall / Math.max(1, (domains.length * 30))) : 0; // Very rough
        // Better avg logic:
        let dailyAverage = totalToday;
        if (totalOverall > 0 && totalToday > 0) {
            const estimatedDays = Math.min(30, Math.max(1, Math.round(totalOverall / Math.max(totalToday, 1))));
            dailyAverage = Math.round(totalOverall / estimatedDays);
        }
        this.updateStat('analyticsWeekAverage', formatTime(dailyAverage));

        sitesWithTime.sort((a, b) => b.todayTime - a.todayTime);
        this.renderTopSites(sitesWithTime, sitesWithTime[0]?.todayTime || 0);

        this.chart.render();
        this.heatmap.render();
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
