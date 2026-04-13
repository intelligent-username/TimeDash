export const uiMethods = {
    updateUI() {
        if (this.settings) {
            this.applyThemeAndAccent();
            this.updateCurrentSpeed();
        }

        this.updateCurrentSite();
        this.updateQuickStats();
        this.updateTopSites();
        this.updateFooter();
    },

    async updateCurrentSpeed() {
        this.currentTabHasVideo = true;
        const speed = (this.settings && this.settings.currentPlaybackSpeed) || 1.0;
        document.getElementById('currentSpeed').textContent = `${Number(speed).toFixed(2)}x`;
    },

    updateCurrentSite() {
        const siteName = document.getElementById('siteName');
        const siteTime = document.getElementById('siteTime');
        const siteFavicon = document.getElementById('siteFavicon');
        const blockBtn = document.getElementById('blockBtn');

        if (!this.currentTab || !this.currentTab.url || !PopupHelpers.shouldTrackUrl(this.currentTab.url)) {
            siteName.textContent = 'Non-trackable page';
            siteTime.textContent = 'Time tracking disabled for this page';
            siteFavicon.style.display = 'none';
            blockBtn.style.display = 'none';
            return;
        }

        const domain = PopupHelpers.extractDomain(this.currentTab.url);
        const domainData = (this.usageData && this.usageData.domains)
            ? this.usageData.domains.find((d) => d.domain === domain)
            : null;

        siteName.textContent = PopupHelpers.capitalize(domain);
        siteTime.textContent = domainData
            ? `Today: ${PopupHelpers.formatDetailedTime(domainData.todayTime)}`
            : 'No time recorded today';

        siteFavicon.src = PopupHelpers.getFaviconUrl(domain);
        siteFavicon.style.display = 'block';

        const isBlocked = (domainData && domainData.isBlocked) || false;
        blockBtn.textContent = isBlocked ? 'Unblock Site' : 'Block Site';
        blockBtn.className = `action-btn block-btn ${isBlocked ? 'blocked' : ''}`;
    },

    updateQuickStats() {
        const todayTotal = document.getElementById('todayTotal');
        const weekAverage = document.getElementById('weekAverage');
        const totalTime = document.getElementById('totalTime');

        if (!this.usageData) return;

        const { totalToday, totalOverall } = this.usageData;
        todayTotal.textContent = PopupHelpers.formatTime(totalToday);
        totalTime.textContent = PopupHelpers.formatTime(totalOverall);
        weekAverage.textContent = PopupHelpers.formatTime(this.calculateWeeklyAverage());
    },

    updateTopSites() {
        const sitesList = document.getElementById('sitesList');

        if (!this.usageData || !this.usageData.domains || this.usageData.domains.length === 0) {
            sitesList.innerHTML = '<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.9L16.2,16.2Z"/></svg><p>No sites tracked yet.<br>Start browsing to see your usage!</p></div>';
            return;
        }

        const topSites = this.usageData.domains.filter((site) => site.todayTime > 0).slice(0, 5);

        if (topSites.length === 0) {
            sitesList.innerHTML = '<div class="empty-state"><p>No activity today yet.<br>Your tracked sites will appear here.</p></div>';
            return;
        }

        sitesList.innerHTML = '';
        topSites.forEach((siteData) => {
            const siteItem = PopupHelpers.createSiteItem(siteData);
            PopupHelpers.animateIn(siteItem);
            sitesList.appendChild(siteItem);
        });
    },

    updateFooter() {
        const trackingStatus = document.getElementById('trackingStatus');
        const sitesCount = document.getElementById('sitesCount');
        const toggleBtn = document.getElementById('toggleTracking');

        const isTracking = (this.settings && this.settings.trackingEnabled) !== false;
        const totalSites = (this.usageData && this.usageData.domains) ? this.usageData.domains.length : 0;

        trackingStatus.textContent = isTracking ? '● Tracking Active' : '● Tracking Paused';
        trackingStatus.className = `tracking-status ${isTracking ? 'active' : 'paused'}`;
        sitesCount.textContent = `${totalSites} sites tracked`;
        toggleBtn.textContent = isTracking ? 'Pause Tracking' : 'Resume Tracking';
        toggleBtn.className = `toggle-btn ${isTracking ? '' : 'paused'}`;
    },

    calculateWeeklyAverage() {
        if (!this.usageData?.domains) return 0;

        const todayTotal = this.usageData.totalToday || 0;
        const totalOverall = this.usageData.totalOverall || 0;

        if (totalOverall > 0 && todayTotal > 0) {
            const estimatedDays = Math.min(7, Math.max(1, Math.round(totalOverall / todayTotal)));
            return Math.round(totalOverall / estimatedDays);
        }

        return todayTotal;
    },

    applyThemeAndAccent() {
        const root = document.documentElement;
        root.setAttribute('data-theme', this.settings.theme || 'auto');

        const accent = this.settings.accentColor || 'blue';
        const isCustomHex = typeof accent === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent);

        if (!isCustomHex) {
            root.setAttribute('data-accent', accent);
            root.style.removeProperty('--accent-color');
            root.style.removeProperty('--accent-dark');
            root.style.removeProperty('--accent-light');
            root.style.removeProperty('--primary-color');
            root.style.removeProperty('--primary-dark');
            root.style.removeProperty('--primary-light');
            return;
        }

        const normalized = this.normalizeHex(accent);
        root.removeAttribute('data-accent');
        root.style.setProperty('--accent-color', normalized);
        root.style.setProperty('--accent-dark', this.mixHex(normalized, '#000000', 0.2));
        root.style.setProperty('--accent-light', this.mixHex(normalized, '#ffffff', 0.22));
        root.style.setProperty('--primary-color', normalized);
        root.style.setProperty('--primary-dark', this.mixHex(normalized, '#000000', 0.2));
        root.style.setProperty('--primary-light', this.mixHex(normalized, '#ffffff', 0.22));
    },

    normalizeHex(hex) {
        const value = String(hex).toLowerCase();
        if (value.length === 4) {
            return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
        }
        return value;
    },

    hexToRgb(hex) {
        const normalized = this.normalizeHex(hex).replace('#', '');
        if (normalized.length !== 6) return null;

        const int = parseInt(normalized, 16);
        if (Number.isNaN(int)) return null;

        return {
            r: (int >> 16) & 255,
            g: (int >> 8) & 255,
            b: int & 255
        };
    },

    rgbToHex(r, g, b) {
        const toHex = (n) => n.toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    },

    mixHex(hexA, hexB, ratio) {
        const a = this.hexToRgb(hexA);
        const b = this.hexToRgb(hexB);
        if (!a || !b) return hexA;

        const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
        const r = clamp(a.r + (b.r - a.r) * ratio);
        const g = clamp(a.g + (b.g - a.g) * ratio);
        const bl = clamp(a.b + (b.b - a.b) * ratio);
        return this.rgbToHex(r, g, bl);
    }
};
