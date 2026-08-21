/**
 * @param {typeof AnalyticsUI} AnalyticsUI - Target class to extend with setup methods.
 */
export function applyAnalyticsUISetupMethods(AnalyticsUI) {
    AnalyticsUI.prototype.setup = function setup() {
        document.querySelectorAll('.period-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                document
                    .querySelectorAll('.period-btn')
                    .forEach((button) => button.classList.remove('active'));
                e.target.classList.add('active');
                this.currentPeriod = e.target.dataset.period;
                this.chart.setPeriod(this.currentPeriod);
                this.chart.render();
                this.updatePeriodStats();
            });
        });

        const prevBtn = document.getElementById('chartPrev');
        const nextBtn = document.getElementById('chartNext');
        const todayBtn = document.getElementById('chartToday');
        const rollingToggle = document.getElementById('rollingAverageToggle');
        const heatmapFilter = document.getElementById('heatmapFilter');

        if (prevBtn) prevBtn.addEventListener('click', () => this.navigateChart('prev'));
        if (nextBtn) nextBtn.addEventListener('click', () => this.navigateChart('next'));
        if (todayBtn) todayBtn.addEventListener('click', () => this.resetChartToToday());
        if (rollingToggle) rollingToggle.addEventListener('change', () => this.chart.render());
        if (heatmapFilter) heatmapFilter.addEventListener('change', () => this.heatmap.render());
    };

    AnalyticsUI.prototype.navigateChart = function navigateChart(direction) {
        this.chart.navigate(direction);
        this.chart.render();
        this.updatePeriodStats();
    };

    AnalyticsUI.prototype.resetChartToToday = function resetChartToToday() {
        this.chart.offset = 0;
        this.chart.render();
        this.updatePeriodStats();
    };
}
