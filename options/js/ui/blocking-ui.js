import { getFaviconUrl } from '../utils/dom.js';
import { setupFaviconFallback } from './blocking/blocking-helpers.js';
import { createDomainRow } from './blocking/domain-row.js';
import { renderGroupRectangle, beginLiveReorder } from './blocking/group-card.js';
import { buildCircularPicker } from './blocking/circular-picker.js';
import { blockingRuleActions } from './blocking/rule-actions.js';
import { groupActions } from './blocking/group-actions.js';
import { toggleNewGroupForm } from './blocking/group-form.js';

export class BlockingUI {
    constructor(controller) {
        this.controller = controller;
        this.limitUpdateTimers = new Map();
        this._restrictedMinutes = 30;
        this.undoStack = [];
        this.isUndoing = false;
    }

    setup() {
        const addBlockedBtn = document.getElementById('addBlockedBtn');
        const blockedDomainInput = document.getElementById('blockedDomainInput');

        if (addBlockedBtn && blockedDomainInput) {
            const handleAddBlocked = () => {
                this.addSiteRule(blockedDomainInput.value.trim(), 'BLOCKED');
                blockedDomainInput.value = '';
            };
            addBlockedBtn.addEventListener('click', handleAddBlocked);
            blockedDomainInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleAddBlocked();
            });
        }

        const addRestrictedBtn = document.getElementById('addRestrictedBtn');
        const restrictedDomainInput = document.getElementById('restrictedDomainInput');

        buildCircularPicker(this);

        if (addRestrictedBtn && restrictedDomainInput) {
            const handleAddRestricted = () => {
                this.addSiteRule(
                    restrictedDomainInput.value.trim(),
                    'RESTRICTED',
                    this._restrictedMinutes
                );
                restrictedDomainInput.value = '';
            };
            addRestrictedBtn.addEventListener('click', handleAddRestricted);
            restrictedDomainInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleAddRestricted();
            });
        }

        const newGroupBtn = document.getElementById('newGroupBtn');
        if (newGroupBtn) {
            newGroupBtn.addEventListener('click', () => toggleNewGroupForm(this));
        }

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                const pane = document.getElementById('blocking');
                if (!pane || !pane.classList.contains('active')) return;

                if (
                    e.target.tagName === 'INPUT' ||
                    e.target.tagName === 'TEXTAREA' ||
                    e.target.isContentEditable
                ) {
                    return;
                }

                e.preventDefault();
                this.undoLastGroupingChange();
            }
        });
    }

    // ── Rule CRUD Orchestration ──────────────────────────────────────────────

    async addSiteRule(domain, ruleType, timeLimitMinutes = 30) {
        return blockingRuleActions.addSiteRule(this, domain, ruleType, timeLimitMinutes);
    }

    async removeSiteRule(domain) {
        return blockingRuleActions.removeSiteRule(this, domain);
    }

    async loadSiteRules() {
        return blockingRuleActions.loadSiteRules(this);
    }

    // ── Group CRUD Orchestration ─────────────────────────────────────────────

    async createGroup(name, domains, limit) {
        return groupActions.createGroup(this, name, domains, limit);
    }

    async updateGroupLimit(id, limit) {
        return groupActions.updateGroupLimit(this, id, limit);
    }

    async updateGroupIcon(id, icon) {
        return groupActions.updateGroupIcon(this, id, icon);
    }

    async deleteGroup(id) {
        return groupActions.deleteGroup(this, id);
    }

    async addDomainToGroup(groupId, domain) {
        return groupActions.addDomainToGroup(this, groupId, domain);
    }

    async removeDomainFromGroup(groupId, domain) {
        return groupActions.removeDomainFromGroup(this, groupId, domain);
    }

    async undoLastGroupingChange() {
        return groupActions.undoLastGroupingChange(this);
    }

    // ── List Rendering ───────────────────────────────────────────────────────

    renderBlockedList(domains) {
        const list = document.getElementById('blockedList');
        if (!list) return;

        list.innerHTML = '';
        domains.forEach((domain) => {
            const li = document.createElement('li');
            li.className = 'rule-item';
            li.innerHTML = `
                <div class="rule-item-info">
                    <img class="rule-favicon" src="${getFaviconUrl(domain)}" alt="">
                    <span class="rule-domain">${domain}</span>
                </div>
                <button class="rule-delete-btn icon-btn" title="Remove block">
                    <svg class="icon-trash" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    <span class="sr-only">Remove</span>
                </button>
            `;
            const img = li.querySelector('.rule-favicon');
            setupFaviconFallback(img, domain);

            li.querySelector('.rule-delete-btn').addEventListener('click', () => {
                this.removeSiteRule(domain);
            });
            list.appendChild(li);
        });
    }

    renderRestrictedList(sites, groups = []) {
        const list = document.getElementById('restrictedList');
        if (!list) return;

        const groupedDomains = new Set();
        groups.forEach((g) => (g.domains || []).forEach((d) => groupedDomains.add(d)));
        const standalone = sites.filter((s) => !groupedDomains.has(s.domain));

        const oldList = list;
        const newList = oldList.cloneNode(false);
        oldList.parentNode.replaceChild(newList, oldList);

        const domainLimitMap = {};
        sites.forEach((s) => {
            domainLimitMap[s.domain] = s.timeLimitMinutes;
        });

        groups.forEach((group) => {
            const el = renderGroupRectangle(group, domainLimitMap, this);
            newList.appendChild(el);
        });

        const maxCap = this.controller?.settings?.restrictedSliderMax || 120;
        standalone.forEach(({ domain, timeLimitMinutes }) => {
            const el = createDomainRow({
                domain,
                timeLimitMinutes,
                maxCap,
                controller: this.controller,
                onSaveLimit: async (newLimit) => this.addSiteRule(domain, 'RESTRICTED', newLimit),
                onDelete: (d) => this.removeSiteRule(d),
                deleteTitle: 'Remove restriction',
            });
            newList.appendChild(el);
        });
    }
}
