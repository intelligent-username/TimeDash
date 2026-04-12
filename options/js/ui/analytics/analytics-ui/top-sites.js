import { formatTime, escapeHtml } from '../../../utils/formatting.js';

export function applyAnalyticsUITopSitesMethods(AnalyticsUI) {
    AnalyticsUI.prototype.renderTopSites = function renderTopSites(sites, maxTime) {
        const container = document.getElementById('analyticsTopSites');
        if (!container) return;

        if (sites.length === 0) {
            container.innerHTML = '<div class="analytics-empty-state">No activity recorded today.</div>';
            return;
        }

        container.innerHTML = sites.slice(0, 10).map((site) => {
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
    };
}
