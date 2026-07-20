import { formatTime, escapeHtml, formatDateString } from '../../../utils/formatting.js';

/**
 *
 * @param AnalyticsUI
 */
export function applyAnalyticsUITopSitesMethods(AnalyticsUI) {
    AnalyticsUI.prototype.renderTopSites = function renderTopSites(sites, maxTime) {
        const container = document.getElementById('analyticsTopSites');
        if (!container) return;

        if (sites.length === 0) {
            container.innerHTML =
                '<div class="analytics-empty-state">No activity recorded today.</div>';
            return;
        }

        container.innerHTML = sites
            .slice(0, 10)
            .map((site) => {
                const barWidth = maxTime > 0 ? Math.round((site.todayTime / maxTime) * 100) : 0;
                const faviconUrl = `https://www.google.com/s2/favicons?domain=${site.domain}&sz=32`;

                return `
                <div class="analytics-site-item">
                    <img class="analytics-site-favicon" src="${faviconUrl}" alt="" onerror="this.style.display='none'">
                    <div class="analytics-site-info">
                        <div class="analytics-site-name">${escapeHtml(site.domain)}</div>
                        <div class="analytics-site-time">${formatTime(site.todayTime, true)}</div>
                    </div>
                    <div class="analytics-site-bar">
                        <div class="analytics-site-bar-fill" style="width: ${barWidth}%"></div>
                    </div>
                </div>
            `;
            })
            .join('');
    };

    AnalyticsUI.prototype.showTopSitesForDate = function showTopSitesForDate(dateStr, pointData) {
        const heading = document.getElementById('topSitesHeading');
        const container = document.getElementById('analyticsTopSites');
        if (!heading || !container) return;

        const usage = this.controller.usage || {};
        const todayStr = formatDateString(new Date());
        const isToday = dateStr === todayStr;
        const sitesWithTime = [];

        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [y, m, d] = dateStr.split('-').map(Number);
            const localDate = new Date(y, m - 1, d);
            const isCurrentYear = localDate.getFullYear() === new Date().getFullYear();
            const displayDate = localDate.toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
                ...(!isCurrentYear && { year: 'numeric' }),
            });

            heading.textContent = isToday ? 'Top Sites Today' : `Top Sites on ${displayDate}`;

            for (const domain of Object.keys(usage)) {
                const domainData = usage[domain];
                const timeMs = (domainData[dateStr] || 0) * 1000;
                if (timeMs > 0) {
                    sitesWithTime.push({ domain, todayTime: timeMs });
                }
            }

            sitesWithTime.sort((a, b) => b.todayTime - a.todayTime);

            if (sitesWithTime.length === 0) {
                container.innerHTML = `<div class="analytics-empty-state">No activity recorded${isToday ? ' today' : ` on ${displayDate}`}.</div>`;
                return;
            }

            this.renderTopSites(sitesWithTime, sitesWithTime[0] ? sitesWithTime[0].todayTime : 0);
        } else if (pointData && pointData.year !== undefined) {
            const year = pointData.year;
            const month = pointData.month;

            if (month !== undefined) {
                heading.textContent = `Top Sites in ${dateStr}`;
                const daysInMonth = new Date(year, month + 1, 0).getDate();

                for (const domain of Object.keys(usage)) {
                    const domainData = usage[domain];
                    let monthTotalMs = 0;
                    for (let day = 1; day <= daysInMonth; day++) {
                        const dStr = formatDateString(new Date(year, month, day));
                        monthTotalMs += (domainData[dStr] || 0) * 1000;
                    }
                    if (monthTotalMs > 0) {
                        sitesWithTime.push({ domain, todayTime: monthTotalMs });
                    }
                }
            } else {
                heading.textContent = `Top Sites in ${dateStr}`;

                for (const domain of Object.keys(usage)) {
                    const domainData = usage[domain];
                    let yearTotalMs = 0;
                    for (let m = 0; m < 12; m++) {
                        const daysInMonth = new Date(year, m + 1, 0).getDate();
                        for (let day = 1; day <= daysInMonth; day++) {
                            const dStr = formatDateString(new Date(year, m, day));
                            yearTotalMs += (domainData[dStr] || 0) * 1000;
                        }
                    }
                    if (yearTotalMs > 0) {
                        sitesWithTime.push({ domain, todayTime: yearTotalMs });
                    }
                }
            }

            sitesWithTime.sort((a, b) => b.todayTime - a.todayTime);

            if (sitesWithTime.length === 0) {
                container.innerHTML = `<div class="analytics-empty-state">No activity recorded in ${dateStr}.</div>`;
                return;
            }

            this.renderTopSites(sitesWithTime, sitesWithTime[0] ? sitesWithTime[0].todayTime : 0);
        }
    };
}
