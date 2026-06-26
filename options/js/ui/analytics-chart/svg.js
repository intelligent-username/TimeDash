import { formatTime, formatDateString } from '../../utils/formatting.js';

const LINE_COLOR = '#3b82f6';
const EARLIEST_COLOR = '#f59e0b';

export function applyAnalyticsChartSvgMethods(AnalyticsChart) {
    AnalyticsChart.prototype.renderSvgChart = function renderSvgChart(container, dailyTotals, maxTime, isYearly) {
        const width = container.clientWidth || 600;
        const height = container.clientHeight || 180;
        const padding = 10;
        const pointSpacing = (width - padding * 2) / Math.max(dailyTotals.length - 1, 1);

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

        const pointCount = validPoints.length;
        const pointR = Math.max(2, Math.min(7, 80 / pointCount));

        const pathD = generateCubicPath(validPoints);
        const areaD = pathD
            ? `${pathD} L ${lastX} ${height - padding} L ${padding} ${height - padding} Z`
            : '';
        const avgPathD = this.buildRollingAverageSvg(dailyTotals, pointSpacing, maxTime, padding, height);

        const pointSvg = points.map(p => {
            const fill = p.isEarliest ? EARLIEST_COLOR : LINE_COLOR;
            return `<circle cx="${p.x}" cy="${p.y}" r="${pointR}" fill="${fill}" stroke="white" stroke-width="2" class="chart-point" />`;
        }).join('');

        const hitareas = points.map(point => {
            let displayDate;
            if (isYearly) {
                displayDate = point.day.date;
            } else {
                const [y, m, d] = point.day.date.split('-').map(Number);
                const localDate = new Date(y, m - 1, d);
                displayDate = localDate.toLocaleDateString(undefined, {
                    weekday: 'short', month: 'short', day: 'numeric'
                });
            }
            return `<div class="chart-point-hitarea" style="left:${point.x}px;top:${point.y}px;" data-date="${point.day.date}" data-time="${formatTime(point.day.time)}">
                <div class="chart-tooltip">${displayDate}<br><strong>${formatTime(point.day.time)}</strong></div>
            </div>`;
        }).join('');

        container.innerHTML = [
            '<div class="chart-html-wrap">',
            `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">`,
            '<defs>',
            `<linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">`,
            `<stop offset="0%" stop-color="${LINE_COLOR}" stop-opacity="0.22" />`,
            `<stop offset="100%" stop-color="${LINE_COLOR}" stop-opacity="0.02" />`,
            '</linearGradient>',
            '</defs>',
            areaD ? `<path d="${areaD}" fill="url(#areaGrad)" />` : '',
            avgPathD,
            pathD ? `<path d="${pathD}" fill="none" stroke="${LINE_COLOR}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />` : '',
            pointSvg,
            '</svg>',
            `<div class="chart-points-overlay">${hitareas}</div>`,
            '</div>'
        ].join('');
    };

    AnalyticsChart.prototype.buildRollingAverageSvg = function buildRollingAverageSvg(dailyTotals, pointSpacing, maxTime, padding, height) {
        const rollingToggle = document.getElementById('rollingAverageToggle');
        if (!rollingToggle || !rollingToggle.checked) return '';

        const usage = this.dataContext.getUsage();
        const k = 7;
        const rollingQueue = [];
        let rollingSum = 0;
        const avgPoints = [];
        const earliestDate = this.dataContext.getEarliestDate();

        const firstDay = dailyTotals[0];
        if (firstDay && firstDay.date.includes('-')) {
            const [y, m, d] = firstDay.date.split('-').map(Number);
            const startDate = new Date(y, m - 1, d);

            for (let i = k - 1; i >= 1; i--) {
                const prevDate = new Date(startDate);
                prevDate.setDate(startDate.getDate() - i);
                const prevStr = formatDateString(prevDate);

                if (earliestDate && prevStr < earliestDate) continue;

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

        const pathD = generateCubicPath(avgPoints);
        if (!pathD) return '';

        return `<path d="${pathD}" fill="none" stroke="var(--accent-color)" stroke-width="2" stroke-dasharray="4,4" opacity="0.5" />`;
    };
}

function generateCubicPath(points) {
    if (points.length === 0) return '';
    if (points.length === 1) return '';

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
}
