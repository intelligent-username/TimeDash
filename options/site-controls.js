'use strict';

/**
 * Site controls for managing blocked sites and speed settings
 * Handles UI for adding, removing, and modifying site-specific settings
 */
export class SiteControls {
    constructor() {
        this.blockedSites = [];
        this.sitesSpeeds = {};
        this.init();
    }

    /**
     * Initialize site controls
     */
    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.renderBlockedSites();
        this.renderSiteSpeeds();
    }

    /**
     * Load data from storage
     */
    async loadData() {
        try {
            // Load blocked sites
            const blockResponse = await chrome.runtime.sendMessage({ type: 'GET_BLOCKED_SITES' });
            this.blockedSites = blockResponse?.sites || [];

            // Load site speeds
            const speedResponse = await chrome.runtime.sendMessage({ type: 'GET_SITE_SPEEDS' });
            this.siteSpeeds = speedResponse?.speeds || {};
        } catch (error) {
            console.error('Error loading site controls data:', error);
        }
    }

    /**
     * Set up event listeners for site controls
     */
    setupEventListeners() {
        // Add blocked site
        document.getElementById('addBlockedSite').addEventListener('click', () => {
            this.addBlockedSite();
        });

        // Add site speed
        document.getElementById('addSiteSpeed').addEventListener('click', () => {
            this.addSiteSpeed();
        });

        // Enter key handlers
        document.getElementById('newBlockedSite').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addBlockedSite();
            }
        });

        document.getElementById('newSiteDomain').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addSiteSpeed();
            }
        });

        // Delegated event handlers for dynamic content
        document.getElementById('blockedSitesList').addEventListener('click', (e) => {
            this.handleBlockedSiteAction(e);
        });

        document.getElementById('siteSpeedsList').addEventListener('click', (e) => {
            this.handleSiteSpeedAction(e);
        });

        document.getElementById('siteSpeedsList').addEventListener('change', (e) => {
            this.handleSiteSpeedChange(e);
        });
    }

    /**
     * Add a new blocked site
     */
    async addBlockedSite() {
        const input = document.getElementById('newBlockedSite');
        const domain = this.normalizeDomain(input.value.trim());

        if (!domain) {
            this.showToast('Please enter a valid domain', 'error');
            return;
        }

        if (!this.isValidDomain(domain)) {
            this.showToast('Please enter a valid domain (e.g., example.com)', 'error');
            return;
        }

        if (this.blockedSites.includes(domain)) {
            this.showToast('Domain is already blocked', 'warning');
            return;
        }

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'ADD_BLOCKED_SITE',
                domain: domain,
            });

            if (response.success) {
                this.blockedSites.push(domain);
                this.renderBlockedSites();
                input.value = '';
                this.showToast(`${domain} has been blocked`, 'success');
            } else {
                this.showToast('Failed to block site', 'error');
            }
        } catch (error) {
            console.error('Error adding blocked site:', error);
            this.showToast('Failed to block site', 'error');
        }
    }

    /**
     * Remove a blocked site
     */
    async removeBlockedSite(domain) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'REMOVE_BLOCKED_SITE',
                domain: domain,
            });

            if (response.success) {
                this.blockedSites = this.blockedSites.filter((site) => site !== domain);
                this.renderBlockedSites();
                this.showToast(`${domain} has been unblocked`, 'success');
            } else {
                this.showToast('Failed to unblock site', 'error');
            }
        } catch (error) {
            console.error('Error removing blocked site:', error);
            this.showToast('Failed to unblock site', 'error');
        }
    }

    /**
     * Add a new site speed setting
     */
    async addSiteSpeed() {
        const domainInput = document.getElementById('newSiteDomain');
        const speedInput = document.getElementById('newSiteSpeed');

        const domain = this.normalizeDomain(domainInput.value.trim());
        const speed = parseFloat(speedInput.value);

        if (!domain) {
            this.showToast('Please enter a valid domain', 'error');
            return;
        }

        if (!this.isValidDomain(domain)) {
            this.showToast('Please enter a valid domain (e.g., example.com)', 'error');
            return;
        }

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'SET_SITE_SPEED',
                domain: domain,
                speed: speed,
            });

            if (response.success) {
                this.siteSpeeds[domain] = speed;
                this.renderSiteSpeeds();
                domainInput.value = '';
                speedInput.value = '1.0';
                this.showToast(`Speed set for ${domain}: ${speed}x`, 'success');
            } else {
                this.showToast('Failed to set site speed', 'error');
            }
        } catch (error) {
            console.error('Error setting site speed:', error);
            this.showToast('Failed to set site speed', 'error');
        }
    }

    /**
     * Update site speed setting
     */
    async updateSiteSpeed(domain, speed) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'SET_SITE_SPEED',
                domain: domain,
                speed: speed,
            });

            if (response.success) {
                this.siteSpeeds[domain] = speed;
                this.showToast(`Speed updated for ${domain}: ${speed}x`, 'success');
            } else {
                this.showToast('Failed to update site speed', 'error');
            }
        } catch (error) {
            console.error('Error updating site speed:', error);
            this.showToast('Failed to update site speed', 'error');
        }
    }

    /**
     * Remove site speed setting
     */
    async removeSiteSpeed(domain) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'REMOVE_SITE_SPEED',
                domain: domain,
            });

            if (response.success) {
                delete this.siteSpeeds[domain];
                this.renderSiteSpeeds();
                this.showToast(`Speed setting removed for ${domain}`, 'success');
            } else {
                this.showToast('Failed to remove site speed', 'error');
            }
        } catch (error) {
            console.error('Error removing site speed:', error);
            this.showToast('Failed to remove site speed', 'error');
        }
    }

    /**
     * Render blocked sites list
     */
    renderBlockedSites() {
        const container = document.getElementById('blockedSitesList');

        if (this.blockedSites.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No sites are currently blocked.</p>
                    <small>Add domains above to start blocking distracting websites.</small>
                </div>
            `;
            return;
        }

        const html = this.blockedSites
            .map(
                (domain) => `
            <div class="site-item" data-domain="${domain}">
                <div class="site-item-info">
                    <img class="site-favicon" src="${this.getFaviconUrl(domain)}" alt="${domain}" onerror="this.style.display='none'">
                    <div class="site-details">
                        <div class="site-name">${this.capitalizeDomain(domain)}</div>
                        <div class="site-meta">Blocked site</div>
                    </div>
                </div>
                <div class="site-actions">
                    <button class="site-btn danger remove-blocked" data-domain="${domain}">
                        Remove
                    </button>
                </div>
            </div>
        `
            )
            .join('');

        container.innerHTML = html;
    }

    /**
     * Render site speeds list
     */
    renderSiteSpeeds() {
        const container = document.getElementById('siteSpeedsList');
        const speeds = Object.entries(this.siteSpeeds);

        if (speeds.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No custom speed settings configured.</p>
                    <small>Add domains above to set default speeds for specific sites.</small>
                </div>
            `;
            return;
        }

        const speedOptions = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 8.0, 16.0];

        const html = speeds
            .map(
                ([domain, speed]) => `
            <div class="site-item" data-domain="${domain}">
                <div class="site-item-info">
                    <img class="site-favicon" src="${this.getFaviconUrl(domain)}" alt="${domain}" onerror="this.style.display='none'">
                    <div class="site-details">
                        <div class="site-name">${this.capitalizeDomain(domain)}</div>
                        <div class="site-meta">Custom speed: ${speed}x</div>
                    </div>
                </div>
                <div class="site-actions">
                    <select class="site-speed-select" data-domain="${domain}">
                        ${speedOptions
                            .map(
                                (opt) => `
                            <option value="${opt}" ${opt === speed ? 'selected' : ''}>${opt}x</option>
                        `
                            )
                            .join('')}
                    </select>
                    <button class="site-btn danger remove-speed" data-domain="${domain}">
                        Remove
                    </button>
                </div>
            </div>
        `
            )
            .join('');

        container.innerHTML = html;
    }

    /**
     * Handle blocked site actions
     */
    handleBlockedSiteAction(event) {
        const button = event.target.closest('button');
        if (!button) return;

        const domain = button.dataset.domain;

        if (button.classList.contains('remove-blocked')) {
            this.confirmAction(
                'Remove blocked site',
                `Are you sure you want to unblock ${domain}?`,
                () => this.removeBlockedSite(domain)
            );
        }
    }

    /**
     * Handle site speed actions
     */
    handleSiteSpeedAction(event) {
        const button = event.target.closest('button');
        if (!button) return;

        const domain = button.dataset.domain;

        if (button.classList.contains('remove-speed')) {
            this.confirmAction(
                'Remove speed setting',
                `Are you sure you want to remove the custom speed setting for ${domain}?`,
                () => this.removeSiteSpeed(domain)
            );
        }
    }

    /**
     * Handle site speed changes
     */
    handleSiteSpeedChange(event) {
        const select = event.target.closest('select');
        if (!select || !select.classList.contains('site-speed-select')) return;

        const domain = select.dataset.domain;
        const speed = parseFloat(select.value);

        this.updateSiteSpeed(domain, speed);
    }

    /**
     * Normalize domain name
     */
    normalizeDomain(domain) {
        return domain
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/.*$/, '')
            .trim();
    }

    /**
     * Validate domain format
     */
    isValidDomain(domain) {
        const domainRegex =
            /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*$/;
        return domainRegex.test(domain) && domain.includes('.');
    }

    /**
     * Get favicon URL for domain
     */
    getFaviconUrl(domain) {
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=20`;
    }

    /**
     * Capitalize domain for display
     */
    capitalizeDomain(domain) {
        return domain.charAt(0).toUpperCase() + domain.slice(1);
    }

    /**
     * Show confirmation dialog
     */
    confirmAction(title, message, callback) {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const okBtn = document.getElementById('confirmOk');
        const cancelBtn = document.getElementById('confirmCancel');

        titleEl.textContent = title;
        messageEl.textContent = message;

        const closeModal = () => {
            modal.classList.remove('show');
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
        };

        const onOk = () => {
            callback();
            closeModal();
        };

        const onCancel = () => {
            closeModal();
        };

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);

        modal.classList.add('show');
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;

        const colors = {
            success: '#4CAF50',
            error: '#F44336',
            warning: '#FF9800',
            info: '#2196F3',
        };

        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            transform: translateX(100%);
            transition: transform 0.3s ease, opacity 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;

        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
        });

        // Auto-hide
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, 3000);
    }

    /**
     * Import blocked sites from text
     */
    async importBlockedSites(sitesText) {
        const domains = sitesText
            .split(/[\n,;]/)
            .map((domain) => this.normalizeDomain(domain))
            .filter((domain) => domain && this.isValidDomain(domain))
            .filter((domain) => !this.blockedSites.includes(domain));

        if (domains.length === 0) {
            this.showToast('No valid domains found to import', 'warning');
            return;
        }

        try {
            for (const domain of domains) {
                await chrome.runtime.sendMessage({
                    type: 'ADD_BLOCKED_SITE',
                    domain: domain,
                });
                this.blockedSites.push(domain);
            }

            this.renderBlockedSites();
            this.showToast(`Imported ${domains.length} blocked sites`, 'success');
        } catch (error) {
            console.error('Error importing blocked sites:', error);
            this.showToast('Failed to import some sites', 'error');
        }
    }

    /**
     * Export blocked sites as text
     */
    exportBlockedSites() {
        if (this.blockedSites.length === 0) {
            this.showToast('No blocked sites to export', 'warning');
            return;
        }

        const text = this.blockedSites.join('\n');

        // Create and download file
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timedash-blocked-sites-${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);

        this.showToast('Blocked sites exported', 'success');
    }

    /**
     * Clear all blocked sites
     */
    async clearAllBlockedSites() {
        if (this.blockedSites.length === 0) {
            this.showToast('No blocked sites to clear', 'warning');
            return;
        }

        this.confirmAction(
            'Clear all blocked sites',
            `Are you sure you want to remove all ${this.blockedSites.length} blocked sites?`,
            async () => {
                try {
                    for (const domain of this.blockedSites) {
                        await chrome.runtime.sendMessage({
                            type: 'REMOVE_BLOCKED_SITE',
                            domain: domain,
                        });
                    }

                    this.blockedSites = [];
                    this.renderBlockedSites();
                    this.showToast('All blocked sites cleared', 'success');
                } catch (error) {
                    console.error('Error clearing blocked sites:', error);
                    this.showToast('Failed to clear all sites', 'error');
                }
            }
        );
    }

    /**
     * Clear all site speed settings
     */
    async clearAllSiteSpeeds() {
        const speedCount = Object.keys(this.siteSpeeds).length;

        if (speedCount === 0) {
            this.showToast('No speed settings to clear', 'warning');
            return;
        }

        this.confirmAction(
            'Clear all speed settings',
            `Are you sure you want to remove all ${speedCount} custom speed settings?`,
            async () => {
                try {
                    for (const domain of Object.keys(this.siteSpeeds)) {
                        await chrome.runtime.sendMessage({
                            type: 'REMOVE_SITE_SPEED',
                            domain: domain,
                        });
                    }

                    this.siteSpeeds = {};
                    this.renderSiteSpeeds();
                    this.showToast('All speed settings cleared', 'success');
                } catch (error) {
                    console.error('Error clearing speed settings:', error);
                    this.showToast('Failed to clear all settings', 'error');
                }
            }
        );
    }
}

// Make available globally for options.js
window.SiteControls = SiteControls;
