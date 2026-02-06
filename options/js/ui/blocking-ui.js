import { getFaviconUrl } from '../utils/dom.js';

export class BlockingUI {
    constructor(controller) {
        this.controller = controller;
    }

    setup() {
        const addBlockedBtn = document.getElementById('addBlockedBtn');
        const blockedDomainInput = document.getElementById('blockedDomainInput');

        if (addBlockedBtn && blockedDomainInput) {
            addBlockedBtn.addEventListener('click', () => {
                this.addSiteRule(blockedDomainInput.value.trim(), 'BLOCKED');
                blockedDomainInput.value = '';
            });

            blockedDomainInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addSiteRule(blockedDomainInput.value.trim(), 'BLOCKED');
                    blockedDomainInput.value = '';
                }
            });
        }

        const addRestrictedBtn = document.getElementById('addRestrictedBtn');
        const restrictedDomainInput = document.getElementById('restrictedDomainInput');
        const restrictedLimitInput = document.getElementById('restrictedLimitInput');

        if (addRestrictedBtn && restrictedDomainInput) {
            addRestrictedBtn.addEventListener('click', () => {
                const limit = parseInt(restrictedLimitInput?.value) || 30;
                this.addSiteRule(restrictedDomainInput.value.trim(), 'RESTRICTED', limit);
                restrictedDomainInput.value = '';
                if (restrictedLimitInput) restrictedLimitInput.value = '';
            });

            restrictedDomainInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const limit = parseInt(restrictedLimitInput?.value) || 30;
                    this.addSiteRule(restrictedDomainInput.value.trim(), 'RESTRICTED', limit);
                    restrictedDomainInput.value = '';
                    if (restrictedLimitInput) restrictedLimitInput.value = '';
                }
            });
        }
    }

    async addSiteRule(domain, ruleType, timeLimitMinutes = 30) {
        if (!domain) {
            this.controller.showWarning('Please enter a domain');
            return;
        }

        const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)+$/;
        const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];

        if (!domainPattern.test(cleanDomain)) {
            this.controller.showWarning('Please enter a valid domain (e.g., facebook.com)');
            return;
        }

        try {
            await chrome.runtime.sendMessage({
                type: 'ADD_SITE_RULE',
                domain: cleanDomain,
                ruleType,
                timeLimitMinutes,
            });
            await this.loadSiteRules();
            this.controller.showSuccess(`Added ${cleanDomain} to ${ruleType.toLowerCase()} list`);
        } catch (error) {
            console.error('Error adding site rule:', error);
            this.controller.showError('Failed to add site rule');
        }
    }

    async removeSiteRule(domain) {
        try {
            await chrome.runtime.sendMessage({
                type: 'REMOVE_SITE_RULE',
                domain,
            });
            await this.loadSiteRules();
            this.controller.showSuccess(`Removed ${domain}`);
        } catch (error) {
            console.error('Error removing site rule:', error);
            this.controller.showError('Failed to remove site rule');
        }
    }

    async loadSiteRules() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_SITE_RULES' });
            this.renderBlockedList(response.blocked || []);
            this.renderRestrictedList(response.restricted || []);
            this.controller.updateRestrictedDomains(response.restricted ? response.restricted.map(r => r.domain) : []);
        } catch (error) {
            console.error('Error loading site rules:', error);
        }
    }

    renderBlockedList(domains) {
        const list = document.getElementById('blockedList');
        if (!list) return;

        list.innerHTML = '';
        domains.forEach((domain) => {
            const li = document.createElement('li');
            li.className = 'rule-item';
            li.innerHTML = `
                <div class="rule-item-info">
                    <img class="rule-favicon" src="${getFaviconUrl(domain)}" alt="" onerror="this.style.display='none'">
                    <span class="rule-domain">${domain}</span>
                </div>
                <button class="rule-delete-btn" data-domain="${domain}" data-type="blocked">Remove</button>
            `;
            li.querySelector('.rule-delete-btn').addEventListener('click', (e) => {
                this.removeSiteRule(e.target.dataset.domain);
            });
            list.appendChild(li);
        });
    }

    renderRestrictedList(sites) {
        const list = document.getElementById('restrictedList');
        if (!list) return;

        list.innerHTML = '';
        sites.forEach(({ domain, timeLimitMinutes }) => {
            const li = document.createElement('li');
            li.className = 'rule-item restrict-item';

            const infoDiv = document.createElement('div');
            infoDiv.className = 'rule-item-info';

            const favicon = document.createElement('img');
            favicon.className = 'rule-favicon';
            favicon.src = getFaviconUrl(domain);
            favicon.onerror = () => { favicon.style.display = 'none'; };

            const domainSpan = document.createElement('span');
            domainSpan.className = 'rule-domain';
            domainSpan.textContent = domain;

            const limitInput = document.createElement('input');
            limitInput.type = 'number';
            limitInput.className = 'rule-limit-input-edit';
            limitInput.value = timeLimitMinutes;
            limitInput.min = 1;
            limitInput.max = 1440;
            limitInput.title = 'Edit daily limit (minutes)';

            const suffixSpan = document.createElement('span');
            suffixSpan.className = 'limit-suffix';
            suffixSpan.textContent = 'min/day';

            infoDiv.appendChild(favicon);
            infoDiv.appendChild(domainSpan);
            infoDiv.appendChild(limitInput);
            infoDiv.appendChild(suffixSpan);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'rule-delete-btn';
            deleteBtn.textContent = 'Remove';
            deleteBtn.addEventListener('click', () => this.removeSiteRule(domain));

            limitInput.addEventListener('change', () => {
                const newLimit = parseInt(limitInput.value);
                if (!isNaN(newLimit) && newLimit > 0 && newLimit <= 1440) {
                    this.addSiteRule(domain, 'RESTRICTED', newLimit);
                } else {
                    limitInput.value = timeLimitMinutes;
                }
            });

            li.appendChild(infoDiv);
            li.appendChild(deleteBtn);
            list.appendChild(li);
        });
    }
}
