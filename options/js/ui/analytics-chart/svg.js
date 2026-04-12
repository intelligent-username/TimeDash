import { formatTime, formatDateString } from '../../utils/formatting.js';

export function applyAnalyticsChartSvgMethods(AnalyticsChart) {
    AnalyticsChart.prototype.renderSvgChart = function renderSvgChart(container, dailyTotals, maxTime, isYearly) {
        const width = container.clientWidth || 600;
        const height = container.clientHeight || 180;
        const padding = 10;
        const pointSpacing = (width - padding * 2) / Math.max(dailyTotals.length - 1, 1);

        const generateCubicPath = (points) => {
            if (points.length === 0) return '';
            if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

            let path = `M ${points[0].x} ${points[0].y}`;
            for (let i = 0; i < points.length - 1; i++) {
                const p0 = points[i - 1] || points[i];
                const p1 = points[i];
                const p2 = points[i + 1];
                const p3 = points[i + 2] || points[i + 1];

                const cp1x = p1.x + (p2.x - p0.x) / 6;
                const cp1y = p1.y + (p2.y - p0.y) / 6;
                const cp2x = p2.x - (p3.x - p1.x) / 6;
                const cp2y = p2.y - (p3.y - p1.y) / 6;

                path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
            }

            return path;
        };

        const points = [];
        const validPoints = [];
        const earliestDate = this.dataContext.getEarliestDate();
        let lastX = padding;

        dailyTotals.forEach((day, i) => {
            if (day.time === null) return;

            const x = padding + (i * pointSpacing);
            const yRatio = maxTime > 0 ? day.time / maxTime : 0;
            const y = height - padding - (yRatio * (height - padding * 2));

            lastX = x;
            points.push({ x, y, day, isEarliest: !isYearly && day.date === earliestDate });
            validPoints.push({ x, y });
        });

        if (points.length === 0) {
            container.innerHTML = '';
            return;
        }

        const pathD = generateCubicPath(validPoints);
        const avgPathD = this.buildRollingAveragePath(dailyTotals, pointSpacing, maxTime, padding, height, generateCubicPath);

        container.innerHTML = `
            <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" style="stop-color:var(--accent-color);stop-opacity:1" />
                        <stop offset="100%" style="stop-color:var(--accent-hover);stop-opacity:1" />
                    </linearGradient>
                    <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:var(--accent-color);stop-opacity:0.3" />
                        <stop offset="100%" style="stop-color:var(--accent-color);stop-opacity:0.05" />
                    </linearGradient>
                </defs>
                <path d="${pathD} L ${lastX} ${height - padding} L ${padding} ${height - padding} Z" fill="url(#areaGradient)" />
                <path d="${pathD}" fill="none" stroke="url(#lineGradient)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                ${avgPathD ? `<path d="${avgPathD}" fill="none" stroke="var(--accent-color)" stroke-width="2" stroke-dasharray="4,4" opacity="0.6" />` : ''}
                ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4.5" fill="${point.isEarliest ? 'var(--secondary-color)' : 'var(--accent-color)'}" stroke="white" stroke-width="2" class="chart-point" />`).join('')}
            </svg>
            <div class="chart-points-overlay">
                ${points.map((point) => `
                    <div class="chart-point-hitarea" style="left: ${point.x}px; top: ${point.y}px;" data-date="${point.day.date}" data-time="${formatTime(point.day.time)}">
                        <div class="chart-tooltip">${point.day.date}<br><strong>${formatTime(point.day.time)}</strong></div>
                    </div>
                `).join('')}
            </div>
        `;
    };

    AnalyticsChart.prototype.buildRollingAveragePath = function buildRollingAveragePath(dailyTotals, pointSpacing, maxTime, padding, height, generateCubicPath) {
        const rollingToggle = document.getElementById('rollingAverageToggle');
        if (!rollingToggle || !rollingToggle.checked) return '';

        const settings = this.dataContext.getSettings();
        const usage = this.dataContext.getUsage();
        const installDate = settings?.firstInstallDate || Date.now();
        const daysSinceInstall = Math.max(1, (Date.now() - installDate) / (1000 * 60 * 60 * 24));
        const k = Math.max(2, Math.ceil(daysSinceInstall * 0.2));

        const rollingQueue = [];
        let rollingSum = 0;
        const avgPoints = [];

        const firstDay = dailyTotals[0];
        if (firstDay && firstDay.date.includes('-')) {
            const [y, m, d] = firstDay.date.split('-').map(Number);
            const startDate = new Date(y, m - 1, d);

            for (let i = k - 1; i >= 1; i--) {
                const prevDate = new Date(startDate);
                prevDate.setDate(startDate.getDate() - i);
                const prevStr = formatDateString(prevDate);

                let prevTotal = 0;
                for (const domain of Object.keys(usage)) {
                    prevTotal += (usage[domain][prevStr] || 0) * 1000;
                }

                rollingQueue.push(prevTotal);
                rollingSum += prevTotal;
            }
        }

        dailyTotals.forEach((day, i) => {
            if (day.time === null) return;

            rollingQueue.push(day.time);
            rollingSum += day.time;

            if (rollingQueue.length > k) {
                rollingSum -= rollingQueue.shift();
            }

            const avg = rollingSum / rollingQueue.length;
            const x = padding + (i * pointSpacing);
            const yRatio = maxTime > 0 ? avg / maxTime : 0;
            const y = height - padding - (yRatio * (height - padding * 2));

            avgPoints.push({ x, y });
        });

        return generateCubicPath(avgPoints);
    };
}
