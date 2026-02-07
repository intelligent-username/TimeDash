import { formatTime, formatDateString } from '../utils/formatting.js';

export class AnalyticsChart {
    constructor(dataContext) {
        this.dataContext = dataContext; // { usage, earliestDate } getter
        this.period = 'week';
        this.offset = 0;
    }

    setPeriod(period) {
        this.period = period;
        this.offset = 0;
    }

    navigate(direction) {
        if (direction === 'prev') {
            const minOffset = this.getMinOffset();
            if (this.offset > minOffset) this.offset--;
        } else if (direction === 'next') {
            if (this.offset < 0) this.offset++;
        }
    }

    render() {
        const chartContent = document.getElementById('chartContent');
        const chartXAxis = document.getElementById('chartXAxis');
        const chartYAxis = document.getElementById('chartYAxis');
        const periodLabel = document.getElementById('chartPeriodLabel');
        const nextBtn = document.getElementById('chartNext');
        const prevBtn = document.getElementById('chartPrev');

        if (!chartContent) return;

        const { dates, label, xLabels, isYearly, year } = this.getDateRange();
        if (periodLabel) periodLabel.textContent = label;

        if (nextBtn) nextBtn.disabled = this.offset >= 0;

        if (prevBtn) {
            const minOffset = this.getMinOffset();
            prevBtn.disabled = this.offset <= minOffset;
        }

        const dailyTotals = this.calculateTotals(dates, isYearly, year);
        // Filter nulls for max calculation
        const validTotals = dailyTotals.filter(d => d.time !== null);
        const maxTime = Math.max(...validTotals.map(d => d.time), 0);

        // Render Y-axis
        const yLabels = [formatTime(maxTime), formatTime(maxTime / 2), '0'];
        if (chartYAxis) chartYAxis.innerHTML = yLabels.map(l => `<span>${l}</span>`).join('');

        this.renderSvgChart(chartContent, dailyTotals, maxTime, isYearly);

        if (chartXAxis) chartXAxis.innerHTML = xLabels.map(l => `<span>${l}</span>`).join('');
    }

    calculateTotals(dates, isYearly, year) {
        const dailyTotals = [];
        const usage = this.dataContext.getUsage();

        if (isYearly) {
            // Future check for year view if needed, but usually we just show 0 for months
            // Assuming we want to show all months as 0 if not passed?
            // Or just keep logic: Year view usually shows full year 0s.
            // Let's keep existing Year logic (it calculates full year)
            for (let month = 0; month < 12; month++) {
                let monthTotal = 0;
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = formatDateString(new Date(year, month, day));
                    for (const domain of Object.keys(usage)) {
                        monthTotal += (usage[domain][dateStr] || 0) * 1000;
                    }
                }
                const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                dailyTotals.push({ date: monthLabel, time: monthTotal });
            }
        } else {
            const todayStr = formatDateString(new Date());
            for (const date of dates) {
                if (date > todayStr) {
                    dailyTotals.push({ date, time: null }); // Placeholder for future
                    continue;
                }
                let dayTotal = 0;
                for (const domain of Object.keys(usage)) {
                    dayTotal += (usage[domain][date] || 0) * 1000;
                }
                dailyTotals.push({ date, time: dayTotal });
            }
        }
        return dailyTotals;
    }

    renderSvgChart(container, dailyTotals, maxTime, isYearly) {
        const width = container.clientWidth || 600;
        const height = container.clientHeight || 180;
        const padding = 10;

        // Spacing based on full range (dailyTotals now has full length)
        const pointSpacing = (width - padding * 2) / Math.max(dailyTotals.length - 1, 1);

        let pathD = '';
        const points = [];
        const earliestDate = this.dataContext.getEarliestDate();

        // Track last valid x point for area closure
        let lastX = padding;

        dailyTotals.forEach((day, i) => {
            if (day.time === null) return; // Skip future

            const x = padding + (i * pointSpacing);
            const yRatio = maxTime > 0 ? day.time / maxTime : 0;
            const y = height - padding - (yRatio * (height - padding * 2));

            if (pathD === '') pathD = `M ${x} ${y}`;
            else pathD += ` L ${x} ${y}`;

            lastX = x;

            const isEarliest = !isYearly && day.date === earliestDate;
            points.push({ x, y, day, isEarliest });
        });

        if (points.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" style="stop-color:#1976d2;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#64b5f6;stop-opacity:1" />
                    </linearGradient>
                    <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:#1976d2;stop-opacity:0.3" />
                        <stop offset="100%" style="stop-color:#1976d2;stop-opacity:0.05" />
                    </linearGradient>
                </defs>
                <path d="${pathD} L ${lastX} ${height - padding} L ${padding} ${height - padding} Z" fill="url(#areaGradient)" />
                <path d="${pathD}" fill="none" stroke="url(#lineGradient)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="5" fill="${p.isEarliest ? '#ff9800' : '#1976d2'}" stroke="white" stroke-width="2" class="chart-point" />`).join('')}
            </svg>
            <div class="chart-points-overlay">
                ${points.map(p => `
                    <div class="chart-point-hitarea" style="left: ${p.x}px; top: ${p.y}px;" data-date="${p.day.date}" data-time="${formatTime(p.day.time)}">
                        <div class="chart-tooltip">${p.day.date}<br><strong>${formatTime(p.day.time)}</strong></div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    getDateRange() {
        const now = new Date();
        let dates = [];
        let label = '';
        let xLabels = [];

        if (this.period === 'week') {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay() + (this.offset * 7));
            for (let i = 0; i < 7; i++) {
                const d = new Date(startOfWeek);
                d.setDate(startOfWeek.getDate() + i);
                dates.push(formatDateString(d));
            }
            xLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            if (this.offset === 0) label = 'This Week';
            else if (this.offset === -1) label = 'Last Week';
            else {
                const weekStart = new Date(startOfWeek);
                label = `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
            }
        } else if (this.period === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth() + this.offset, 1);
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + this.offset + 1, 0).getDate();
            for (let i = 0; i < daysInMonth; i++) {
                const d = new Date(startOfMonth);
                d.setDate(i + 1);
                dates.push(formatDateString(d));
            }
            xLabels = ['1', '', '', '', '5', '', '', '', '', '10', '', '', '', '', '15', '', '', '', '', '20', '', '', '', '', '25', '', '', '', '', '30', ''];
            xLabels = xLabels.slice(0, daysInMonth);
            if (this.offset === 0) label = 'This Month';
            else if (this.offset === -1) label = 'Last Month';
            else label = startOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        } else if (this.period === 'year') {
            const year = now.getFullYear() + this.offset;
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            xLabels = monthNames;
            if (this.offset === 0) label = 'This Year';
            else if (this.offset === -1) label = 'Last Year';
            else label = year.toString();
            return { dates: [], label, xLabels, isYearly: true, year };
        }
        return { dates, label, xLabels, isYearly: false, year: null };
    }

    getMinOffset() {
        const earliestDate = this.dataContext.getEarliestDate();
        if (!earliestDate) return -52;
        const now = new Date();
        const earliest = new Date(earliestDate);

        if (this.period === 'week') {
            const diffTime = Math.abs(now - earliest);
            const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
            return -(diffWeeks + 1);
        } else if (this.period === 'month') {
            const monthDiff = (now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth());
            return -(monthDiff + 1);
        } else if (this.period === 'year') {
            const yearDiff = now.getFullYear() - earliest.getFullYear();
            return -(yearDiff + 1);
        }
        return -10;
    }
}
