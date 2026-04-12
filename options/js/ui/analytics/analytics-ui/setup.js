export function applyAnalyticsUISetupMethods(AnalyticsUI) {
    AnalyticsUI.prototype.setup = function setup() {
        document.querySelectorAll('.period-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.period-btn').forEach((button) => button.classList.remove('active'));
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

        this.addAllTimePeriodOption();
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

    AnalyticsUI.prototype.addAllTimePeriodOption = function addAllTimePeriodOption() {
        const periodSelector = document.querySelector('.chart-period-selector');
        if (!periodSelector) return;

        const existingAll = periodSelector.querySelector('[data-period="all"]');
        if (existingAll) return;

        const allBtn = document.createElement('button');
        allBtn.className = 'period-btn';
        allBtn.dataset.period = 'all';
        allBtn.textContent = 'All Time';
        periodSelector.appendChild(allBtn);

        allBtn.addEventListener('click', (e) => {
            document.querySelectorAll('.period-btn').forEach((button) => button.classList.remove('active'));
            e.target.classList.add('active');
            this.currentPeriod = 'all';
            this.chart.setPeriod('all');
            this.chart.render();
            this.updatePeriodStats();
        });
    };
}
