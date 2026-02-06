import { getFaviconUrl, showToast } from '../utils/dom.js';

export class SiteSpeedList {
    constructor(controller) {
        this.controller = controller;
        this.siteSpeeds = {};
    }

    async setup() {
        // Load speeds
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_SITE_SPEEDS' });
            this.siteSpeeds = response?.speeds || {};
        } catch (e) {
            console.error(e);
        }

        const addBtn = document.getElementById('addSiteSpeed');
        const domainInput = document.getElementById('newSiteDomain');

        if (addBtn && domainInput) {
            addBtn.addEventListener('click', () => this.addSiteSpeed());
            domainInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addSiteSpeed();
            });
        }

        this.render();

        const list = document.getElementById('siteSpeedsList');
        if (list) {
            list.addEventListener('click', (e) => this.handleAction(e));
            list.addEventListener('change', (e) => this.handleChange(e));
        }
    }

    async addSiteSpeed() {
        const domainInput = document.getElementById('newSiteDomain');
        const speedInput = document.getElementById('newSiteSpeed'); // Make sure this input exists in HTML if mimicking logic

        if (!domainInput) return; // Silent fail if elements missing

        const domain = domainInput.value.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
        const speed = speedInput ? parseFloat(speedInput.value) : 1.0;

        if (!domain) return showToast('Invalid domain', 'error');

        try {
            const res = await chrome.runtime.sendMessage({ type: 'SET_SITE_SPEED', domain, speed });
            if (res.success) {
                this.siteSpeeds[domain] = speed;
                this.render();
                domainInput.value = '';
                showToast(`Speed set for ${domain}`, 'success');
            }
        } catch (e) {
            showToast('Failed to set speed', 'error');
        }
    }

    async handleAction(e) {
        if (e.target.closest('.remove-speed')) {
            const domain = e.target.closest('.remove-speed').dataset.domain;
            if (confirm(`Remove custom speed for ${domain}?`)) {
                await chrome.runtime.sendMessage({ type: 'REMOVE_SITE_SPEED', domain });
                delete this.siteSpeeds[domain];
                this.render();
                showToast('Removed', 'success');
            }
        }
    }

    async handleChange(e) {
        if (e.target.classList.contains('site-speed-select')) {
            const domain = e.target.dataset.domain;
            const speed = parseFloat(e.target.value);
            await chrome.runtime.sendMessage({ type: 'SET_SITE_SPEED', domain, speed });
            this.siteSpeeds[domain] = speed;
            showToast('Speed updated', 'success');
        }
    }

    render() {
        const container = document.getElementById('siteSpeedsList');
        if (!container) return;

        const speeds = Object.entries(this.siteSpeeds);
        if (speeds.length === 0) {
            container.innerHTML = '<div class="empty-state">No custom speeds.</div>';
            return;
        }

        // ... Render logic from site-controls.js ...
        container.innerHTML = speeds.map(([domain, speed]) => `
            <div class="site-item" data-domain="${domain}">
                <div class="site-item-info">
                    <img class="site-favicon" src="${getFaviconUrl(domain)}" alt="">
                    <span class="site-name">${domain}</span>
                </div>
                <div class="site-actions">
                     <select class="site-speed-select" data-domain="${domain}">
                         ${[0.5, 1, 1.25, 1.5, 2, 3].map(s => `<option value="${s}" ${s === speed ? 'selected' : ''}>${s}x</option>`).join('')}
                     </select>
                     <button class="remove-speed" data-domain="${domain}">×</button>
                </div>
            </div>
        `).join('');
    }
}
