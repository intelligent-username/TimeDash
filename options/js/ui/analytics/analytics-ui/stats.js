import { formatTime, formatDateString } from '../../../utils/formatting.js';

/**
 *
 * @param AnalyticsUI
 */
export function applyAnalyticsUIStatsMethods(AnalyticsUI) {
    AnalyticsUI.prototype.update = function update() {
        const usage = this.controller.usage || {};
        const domains = Object.keys(usage);
        const today = formatDateString(new Date());

        let totalOverall = 0;
        let todayTotal = 0;
        const sitesWithTime = [];
        let earliestDate = null;

        for (const domain of domains) {
            const domainData = usage[domain];
            const todayTime = (domainData[today] || 0) * 1000;
            const cumulative = (domainData.cumulative || 0) * 1000;
            totalOverall += cumulative;
            todayTotal += todayTime;

            if (todayTime > 0) sitesWithTime.push({ domain, todayTime, cumulative });

            for (const key of Object.keys(domainData)) {
                if (/^\d{4}-\d{2}-\d{2}$/.test(key) && (!earliestDate || key < earliestDate)) {
                    earliestDate = key;
                }
            }
        }

        this.earliestDate = earliestDate;
        this.controller.earliestDate = earliestDate;

        this.updateStat('analyticsTodayTotal', formatTime(todayTotal));
        this.updateStat('analyticsTotalTime', formatTime(totalOverall));
        this.updateSitesCount(domains.length);
        this.calculateAndStoreDailyAverages(usage);
        this.calculateAndUpdateNetChange(usage);
        this.restartDailyAverageCycle();
        this.updatePeriodStats();

        sitesWithTime.sort((a, b) => b.todayTime - a.todayTime);
        this.renderTopSites(sitesWithTime, sitesWithTime[0] ? sitesWithTime[0].todayTime : 0);

        this.chart.render();
        this.heatmap.render();
        this.renderMiniCharts();
        this.setupMiniChartPeriodButtons();
    };

    AnalyticsUI.prototype.updatePeriodStats = function updatePeriodStats() {
        const usage = this.controller.usage || {};
        const { periodTotal, periodDays, periodLabel } = this.calculatePeriodTotal(usage);

        const totalEl = document.getElementById('analyticsTotalTime');
        this.setStatCardValue(totalEl, formatTime(periodTotal), `Total ${periodLabel}`);
    };

    AnalyticsUI.prototype.setStatCardValue = function setStatCardValue(valueEl, value, label) {
        if (!valueEl) return;
        valueEl.textContent = value;
        const labelEl = valueEl.closest('.stat-card')?.querySelector('.stat-label');
        if (labelEl) labelEl.textContent = label;
    };

    AnalyticsUI.prototype.updateStat = function updateStat(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    AnalyticsUI.prototype.updateSitesCount = function updateSitesCount(count) {
        const el = document.getElementById('heatmapSitesCount');
        if (el) el.textContent = `${count} Sites Tracked`;
    };

    AnalyticsUI.prototype.calculateAverageForDays = function calculateAverageForDays(
        usage,
        days,
        offset = 0
    ) {
        const now = new Date();
        let total = 0;
        let validDays = 0;

        for (let i = offset; i < offset + days; i++) {
            const date = new Date(now);
            date.setDate(now.getDate() - i);
            const dateStr = formatDateString(date);
            if (this.earliestDate && dateStr >= this.earliestDate) {
                validDays++;
                for (const domain of Object.keys(usage)) {
                    total += (usage[domain][dateStr] || 0) * 1000;
                }
            }
        }

        return { total, count: validDays };
    };

    AnalyticsUI.prototype.calculateAndStoreDailyAverages = function calculateAndStoreDailyAverages(
        usage
    ) {
        const periods = [7, 14, 30, 100];
        const dailyAverages = [];

        for (const days of periods) {
            const { total, count } = this.calculateAverageForDays(usage, days);
            if (count > 0) {
                dailyAverages.push({ days, average: Math.round(total / count) });
            }
        }

        if (dailyAverages.length === 0) {
            const totalOverall = this.calculateTotalOverall(usage);
            const daysSinceStart = this.earliestDate
                ? Math.ceil(
                      Math.max(0, Date.now() - new Date(this.earliestDate).getTime()) / 86400000
                  ) || 1
                : 1;
            const allTimeAvg = daysSinceStart > 0 ? Math.round(totalOverall / daysSinceStart) : 0;
            dailyAverages.push({ days: 'All', average: allTimeAvg });
        }

        this._dailyAverages = dailyAverages;
        this._currentAvgIndex = 0;
        this._updateDailyAverageDisplay();
    };

    AnalyticsUI.prototype.calculateTotalOverall = function calculateTotalOverall(usage) {
        let total = 0;
        for (const domain of Object.keys(usage)) {
            total += (usage[domain].cumulative || 0) * 1000;
        }
        return total;
    };

    AnalyticsUI.prototype._updateDailyAverageDisplay = function _updateDailyAverageDisplay() {
        const avgEl = document.getElementById('analyticsWeekAverage');
        if (!avgEl || !this._dailyAverages || this._dailyAverages.length === 0) return;
        const entry = this._dailyAverages[this._currentAvgIndex];
        const label = `${entry.days}d Daily Average`;
        this.setStatCardValue(avgEl, formatTime(entry.average), label);
        avgEl.classList.remove('stat-value-cycle');
        void avgEl.offsetWidth;
        avgEl.classList.add('stat-value-cycle');
    };

    AnalyticsUI.prototype.restartDailyAverageCycle = function restartDailyAverageCycle() {
        if (this._avgInterval) {
            clearInterval(this._avgInterval);
            this._avgInterval = null;
        }

        if (this._avgIsHovering) return;

        const tick = () => {
            if (this._dailyAverages && this._dailyAverages.length > 0) {
                this._currentAvgIndex = (this._currentAvgIndex + 1) % this._dailyAverages.length;
                this._updateDailyAverageDisplay();
            }
        };

        this._avgInterval = setInterval(tick, 4000);

        this._attachAvgHoverListeners();
    };

    AnalyticsUI.prototype._attachAvgHoverListeners = function _attachAvgHoverListeners() {
        if (this._avgHoverAttached) return;
        this._avgHoverAttached = true;

        const card = document.getElementById('analyticsWeekAverage')?.closest('.stat-card');
        if (!card) return;

        card.addEventListener('mouseenter', () => {
            this._avgIsHovering = true;
            if (this._avgPauseTimeout) {
                clearTimeout(this._avgPauseTimeout);
                this._avgPauseTimeout = null;
            }
            if (this._avgInterval) {
                clearInterval(this._avgInterval);
                this._avgInterval = null;
            }
        });

        card.addEventListener('mouseleave', () => {
            this._avgIsHovering = false;
            this._avgPauseTimeout = setTimeout(() => {
                if (!this._avgIsHovering) {
                    this.restartDailyAverageCycle();
                }
            }, 1000);
        });
    };

    AnalyticsUI.prototype.calculateAndUpdateNetChange = function calculateAndUpdateNetChange(
        usage
    ) {
        const thisWeek = this.calculateAverageForDays(usage, 7, 0);
        const lastWeek = this.calculateAverageForDays(usage, 7, 7);

        const thisAvg = thisWeek.count > 0 ? Math.round(thisWeek.total / thisWeek.count) : 0;
        const lastAvg = lastWeek.count > 0 ? Math.round(lastWeek.total / lastWeek.count) : 0;

        let change, label;
        if (lastWeek.count > 0) {
            change = thisAvg - lastAvg;
            label = 'from last week to this week';
        } else {
            const totalOverall = this.calculateTotalOverall(usage);
            const daysSinceStart = this.earliestDate
                ? Math.ceil(
                      Math.max(0, Date.now() - new Date(this.earliestDate).getTime()) / 86400000
                  ) || 1
                : 1;
            const overallAvg = daysSinceStart > 0 ? Math.round(totalOverall / daysSinceStart) : 0;
            change = thisAvg - overallAvg;
            label = 'since you started using the extension';
        }

        const el = document.getElementById('analyticsNetChange');
        if (!el) return;
        const prefix = change > 0 ? '+' : change < 0 ? '\u2212' : '\u00b1';
        el.textContent = `${prefix}${formatTime(Math.abs(change))}`;
        const labelEl = el.closest('.stat-card')?.querySelector('.stat-label');
        if (labelEl) labelEl.textContent = label;

        const iconWrapper = el.closest('.stat-card')?.querySelector('.stat-icon-wrapper');
        if (iconWrapper) {
            iconWrapper.style.color = change >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
            iconWrapper.style.background =
                change >= 0 ? 'var(--success-fade)' : 'var(--danger-fade)';
        }
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
            periodDays = this.earliestDate
                ? Math.ceil(Math.max(0, now - new Date(this.earliestDate)) / 86400000) || 1
                : 1;
            return { periodTotal, periodDays, periodLabel };
        }

        if (this.currentPeriod === 'week') {
            const endDate = new Date(now);
            endDate.setDate(now.getDate() + this.chart.offset * 7);
            const startDate = new Date(endDate);
            startDate.setDate(endDate.getDate() - 6);
            periodLabel = this.chart.offset === 0 ? 'Past 7 Days' : 'Selected Week';
            for (let i = 0; i < 7; i++) {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + i);
                const dateStr = formatDateString(date);
                if (isValidDay(dateStr)) periodDays++;
                for (const domain of domains) periodTotal += (usage[domain][dateStr] || 0) * 1000;
            }
        } else if (this.currentPeriod === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth() + this.chart.offset, 1);
            const daysInMonth = new Date(
                now.getFullYear(),
                now.getMonth() + this.chart.offset + 1,
                0
            ).getDate();
            periodLabel = this.chart.offset === 0 ? 'This Month' : 'Selected Month';
            for (let i = 1; i <= daysInMonth; i++) {
                const date = new Date(startOfMonth);
                date.setDate(i);
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
                    for (const domain of domains)
                        periodTotal += (usage[domain][dateStr] || 0) * 1000;
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

    // ── Mini bar charts (restricted time) ────────────────────────────────────

    AnalyticsUI.prototype._miniChartPeriods = { restricted: 'week' };

    AnalyticsUI.prototype.renderMiniCharts = function renderMiniCharts() {
        const usage = this.controller.usage || {};
        this._renderSingleMiniChart(
            'restrictedTimeChart',
            this._miniChartPeriods.restricted,
            usage
        );
    };

    AnalyticsUI.prototype._renderSingleMiniChart = function _renderSingleMiniChart(
        containerId,
        period,
        usage
    ) {
        const el = document.getElementById(containerId);
        if (!el) return;

        const days = period === 'month' ? 30 : 7;
        const now = new Date();
        const labels = [];
        const values = [];

        const restrictedDomains = new Set(this.controller.restrictedDomains || []);

        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const dateStr = formatDateString(d);
            labels.push(dateStr);

            let dayTotal = 0;
            for (const domain of Object.keys(usage)) {
                if (!restrictedDomains.has(domain)) continue;
                // Key: "2026-07-09_restricted"
                dayTotal += usage[domain][`${dateStr}_restricted`] || 0;
            }
            values.push(dayTotal);
        }

        const max = Math.max(...values, 1);

        const formatVal = (v) => {
            const h = Math.floor(v / 3600);
            const m = Math.floor((v % 3600) / 60);
            if (h === 0 && m === 0) return '< 1m';
            if (h === 0) return `${m}m`;
            if (m === 0) return `${h}h`;
            return `${h}h\u00a0${m}m`;
        };

        const shortLabel = (ds) => {
            const d = new Date(ds + 'T00:00:00');
            if (days <= 7) return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
            return `${d.getMonth() + 1}/${d.getDate()}`;
        };

        const allZero = values.every((v) => v === 0);

        if (allZero) {
            el.innerHTML = `<div class="mini-bar-empty">No restricted-site activity yet for this period</div>`;
            return;
        }

        el.innerHTML = `<div class="mini-bar-chart-inner" role="img" aria-label="Restricted time per day">
            ${values
                .map((v, i) => {
                    const pct = Math.round((v / max) * 100);
                    return `<div class="mini-bar-col mini-bar-col--clickable" data-date="${labels[i]}" role="button" tabindex="0" aria-label="${shortLabel(labels[i])}: ${formatVal(v)}">
                        <div class="mini-bar-tooltip" role="tooltip">${formatVal(v)}<br><span>${labels[i]}</span></div>
                        <div class="mini-bar-track">
                            <div class="mini-bar-fill${v > 0 ? ' has-data' : ''}" style="height:${pct}%" aria-hidden="true"></div>
                        </div>
                        <div class="mini-bar-label" aria-hidden="true">${shortLabel(labels[i])}</div>
                    </div>`;
                })
                .join('')}
        </div>`;

        el.querySelectorAll('.mini-bar-col--clickable').forEach((col) => {
            col.addEventListener('click', () => this._onRestrictedBarClick(col.dataset.date));
            col.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._onRestrictedBarClick(col.dataset.date);
                }
            });
        });
    };

    AnalyticsUI.prototype._onRestrictedBarClick = function _onRestrictedBarClick(dateStr) {
        const heading = document.getElementById('topSitesHeading');
        const container = document.getElementById('analyticsTopSites');
        if (!heading || !container) return;

        const todayStr = formatDateString(new Date());
        const isToday = dateStr === todayStr;
        const localDate = new Date(dateStr + 'T00:00:00');
        const displayDate = localDate.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
        });

        heading.textContent = isToday ? 'Top Sites Today' : `Restricted Sites on ${displayDate}`;

        const usage = this.controller.usage || {};
        const restrictedDomains = new Set(this.controller.restrictedDomains || []);
        const sitesWithTime = [];

        for (const domain of Object.keys(usage)) {
            if (!restrictedDomains.has(domain)) continue;
            const seconds = usage[domain][`${dateStr}_restricted`] || 0;
            if (seconds > 0) sitesWithTime.push({ domain, todayTime: seconds * 1000 });
        }

        sitesWithTime.sort((a, b) => b.todayTime - a.todayTime);

        if (sitesWithTime.length === 0) {
            container.innerHTML = `<div class="analytics-empty-state">No restricted-site activity${isToday ? ' today' : ` on ${displayDate}`}.</div>`;
            return;
        }

        const maxTime = sitesWithTime[0].todayTime;
        container.innerHTML = sitesWithTime
            .slice(0, 10)
            .map((site) => {
                const barWidth = maxTime > 0 ? Math.round((site.todayTime / maxTime) * 100) : 0;
                const faviconUrl = `https://www.google.com/s2/favicons?domain=${site.domain}&sz=32`;
                const escaped = site.domain
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                const time = (() => {
                    const s = Math.floor(site.todayTime / 1000);
                    const h = Math.floor(s / 3600);
                    const m = Math.floor((s % 3600) / 60);
                    if (h === 0) return `${m}m`;
                    if (m === 0) return `${h}h`;
                    return `${h}h\u00a0${m}m`;
                })();
                return `<div class="analytics-site-item">
                <img class="analytics-site-favicon" src="${faviconUrl}" alt="" onerror="this.style.display='none'">
                <div class="analytics-site-info">
                    <div class="analytics-site-name">${escaped}</div>
                    <div class="analytics-site-time">${time}</div>
                </div>
                <div class="analytics-site-bar">
                    <div class="analytics-site-bar-fill" style="width:${barWidth}%"></div>
                </div>
            </div>`;
            })
            .join('');

        // Highlight selected bar
        const chart = document.getElementById('restrictedTimeChart');
        if (chart) {
            chart
                .querySelectorAll('.mini-bar-col--selected')
                .forEach((el) => el.classList.remove('mini-bar-col--selected'));
            if (!isToday) {
                const selected = chart.querySelector(`[data-date="${dateStr}"]`);
                if (selected) selected.classList.add('mini-bar-col--selected');
            }
        }
    };

    AnalyticsUI.prototype.setupMiniChartPeriodButtons = function setupMiniChartPeriodButtons() {
        if (this._miniChartButtonsSetup) return;
        this._miniChartButtonsSetup = true;

        document.querySelectorAll('[data-restrict-period]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                document
                    .querySelectorAll('[data-restrict-period]')
                    .forEach((b) => b.classList.remove('active'));
                e.target.classList.add('active');
                this._miniChartPeriods.restricted = e.target.dataset.restrictPeriod;
                const usage = this.controller.usage || {};
                this._renderSingleMiniChart(
                    'restrictedTimeChart',
                    this._miniChartPeriods.restricted,
                    usage
                );
            });
        });
    };
}
