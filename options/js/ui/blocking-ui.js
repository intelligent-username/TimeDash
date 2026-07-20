import { getFaviconUrl } from '../utils/dom.js';

const GROUP_ICONS = {
    folder: `<svg class="icon-folder" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
    briefcase: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
    code: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
    book: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
    gamepad: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"></line><line x1="8" y1="10" x2="8" y2="14"></line><line x1="15" y1="13" x2="15.01" y2="13"></line><line x1="18" y1="11" x2="18.01" y2="11"></line><rect x="2" y="6" width="20" height="12" rx="3"></rect></svg>`,
    globe: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
    play: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
    message: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
    heart: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
    shopping: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`,
    music: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`,
    lock: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
};

/**
 *
 */
export class BlockingUI {
    /**
     *
     * @param controller
     */
    constructor(controller) {
        this.controller = controller;
        this.limitUpdateTimers = new Map();
        this._restrictedMinutes = 30;
        this.undoStack = [];
        this.isUndoing = false;
    }

    /**
     *
     */
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

        this._buildCircularPicker();

        if (addRestrictedBtn && restrictedDomainInput) {
            addRestrictedBtn.addEventListener('click', () => {
                this.addSiteRule(
                    restrictedDomainInput.value.trim(),
                    'RESTRICTED',
                    this._restrictedMinutes
                );
                restrictedDomainInput.value = '';
            });

            restrictedDomainInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addSiteRule(
                        restrictedDomainInput.value.trim(),
                        'RESTRICTED',
                        this._restrictedMinutes
                    );
                    restrictedDomainInput.value = '';
                }
            });
        }

        // New Group button
        const newGroupBtn = document.getElementById('newGroupBtn');
        if (newGroupBtn) {
            newGroupBtn.addEventListener('click', () => this._toggleNewGroupForm());
        }

        // Undo key listener
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                const pane = document.getElementById('blocking');
                if (!pane || !pane.classList.contains('active')) return;

                // Do not trigger undo if user is focusing an input/textarea
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

    /**
     * Set up favicon loading with protocol-fallback retries.
     * @param {HTMLImageElement} img
     * @param {string} domain
     */
    _setupFaviconFallback(img, domain) {
        if (!img || !domain) return;
        img.onerror = () => {
            if (!img.dataset.retryCount) {
                img.dataset.retryCount = '1';
                img.src = `https://www.google.com/s2/favicons?domain=https://${domain}&sz=32`;
            } else if (img.dataset.retryCount === '1') {
                img.dataset.retryCount = '2';
                img.src = `https://www.google.com/s2/favicons?domain=http://${domain}&sz=32`;
            } else {
                img.style.display = 'none';
            }
        };
    }

    /**
     *
     * @param domain
     * @param ruleType
     * @param timeLimitMinutes
     */
    async addSiteRule(domain, ruleType, timeLimitMinutes = 30) {
        if (!domain) {
            this.controller.showWarning('Please enter a domain');
            return;
        }

        const maxCap = this.controller?.settings?.restrictedSliderMax || 120;
        const cappedLimit = Math.min(timeLimitMinutes, maxCap);

        const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)+$/;
        const cleanDomain = domain
            .toLowerCase()
            .replace(/^(https?:\/\/)?(www\.)?/, '')
            .split('/')[0];

        if (!domainPattern.test(cleanDomain)) {
            this.controller.showWarning('Please enter a valid domain (e.g., facebook.com)');
            return;
        }

        try {
            await chrome.runtime.sendMessage({
                type: 'ADD_SITE_RULE',
                domain: cleanDomain,
                ruleType,
                timeLimitMinutes: cappedLimit,
            });
            await this.loadSiteRules();
            this.controller.showSuccess(`Added ${cleanDomain} to ${ruleType.toLowerCase()} list`);
        } catch (error) {
            console.error('Error adding site rule:', error);
            this.controller.showError('Failed to add site rule');
        }
    }

    /**
     *
     * @param domain
     */
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

    /**
     *
     */
    async loadSiteRules() {
        try {
            const [rulesResponse, groups] = await Promise.all([
                chrome.runtime.sendMessage({ type: 'GET_SITE_RULES' }),
                chrome.runtime.sendMessage({ type: 'GET_GROUPS' }).catch(() => []),
            ]);
            this.renderBlockedList(rulesResponse.blocked || []);
            this.renderRestrictedList(rulesResponse.restricted || [], groups || []);
            this.controller.updateRestrictedDomains(
                rulesResponse.restricted ? rulesResponse.restricted.map((r) => r.domain) : []
            );
        } catch (error) {
            console.error('Error loading site rules:', error);
        }
    }

    /**
     *
     * @param domains
     */
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
            this._setupFaviconFallback(img, domain);

            li.querySelector('.rule-delete-btn').addEventListener('click', () => {
                this.removeSiteRule(domain);
            });
            list.appendChild(li);
        });
    }

    /**
     * Render restricted sites with group rectangles interleaved.
     * Groups appear first, then standalone restricted items.
     * @param {Array} sites - Restricted site rule objects
     * @param {Array} groups - Group objects from background
     */
    renderRestrictedList(sites, groups = []) {
        const list = document.getElementById('restrictedList');
        if (!list) return;

        const groupedDomains = new Set();
        groups.forEach((g) => (g.domains || []).forEach((d) => groupedDomains.add(d)));
        const standalone = sites.filter((s) => !groupedDomains.has(s.domain));

        // Remove old drag listeners to avoid duplicates on re-render
        const oldList = list;
        const newList = oldList.cloneNode(false);
        oldList.parentNode.replaceChild(newList, oldList);

        const domainLimitMap = {};
        sites.forEach((s) => {
            domainLimitMap[s.domain] = s.timeLimitMinutes;
        });

        groups.forEach((group) => {
            const el = this._renderGroupRectangle(group, domainLimitMap);
            newList.appendChild(el);
        });

        standalone.forEach(({ domain, timeLimitMinutes }) => {
            const el = this._createRestrictedItem(domain, timeLimitMinutes);
            newList.appendChild(el);
        });
    }

    /**
     * Create a single restricted site list item
     * @param {string} domain
     * @param {number} timeLimitMinutes
     * @returns {HTMLLIElement}
     */
    _createRestrictedItem(domain, timeLimitMinutes) {
        const li = document.createElement('li');
        li.className = 'rule-item restrict-item';
        li.draggable = true;

        li.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', domain);
            e.dataTransfer.effectAllowed = 'move';
            li.classList.add('dragging');
        });
        li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
            document
                .querySelectorAll('.drag-over')
                .forEach((el) => el.classList.remove('drag-over'));
        });

        // Drag handle indicator
        const dragHandle = document.createElement('span');
        dragHandle.className = 'drag-handle-indicator';
        dragHandle.innerHTML = '⋮⋮';

        const favicon = document.createElement('img');
        favicon.className = 'rule-favicon';
        favicon.src = getFaviconUrl(domain);
        this._setupFaviconFallback(favicon, domain);

        const domainWrapper = document.createElement('div');
        domainWrapper.className = 'rule-domain-wrapper';

        const domainSpan = document.createElement('span');
        domainSpan.className = 'rule-domain';
        domainSpan.textContent = domain;

        const usageSpan = document.createElement('span');
        usageSpan.className = 'rule-usage-today';
        const domainUsage = this.controller.usage[domain] || {};
        const todaySeconds = TimeUtils.calculateTodayTime(domainUsage);
        usageSpan.textContent =
            todaySeconds > 0 ? `${TimeUtils.formatTime(todaySeconds)} today` : '0s today';

        domainWrapper.appendChild(domainSpan);
        domainWrapper.appendChild(usageSpan);

        const maxCap = this.controller?.settings?.restrictedSliderMax || 120;
        const initialValue = Math.min(timeLimitMinutes, maxCap);
        const limitInput = document.createElement('input');
        limitInput.type = 'number';
        limitInput.className = 'rule-limit-input-edit';
        limitInput.value = initialValue;
        limitInput.min = 0;
        limitInput.max = maxCap;
        limitInput.step = 1;
        limitInput.title = `Edit daily limit (max ${maxCap} min)`;

        const suffixSpan = document.createElement('span');
        suffixSpan.className = 'limit-suffix';
        suffixSpan.textContent = 'min/day';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'rule-delete-btn icon-btn';
        deleteBtn.title = 'Remove restriction';
        deleteBtn.innerHTML = `
            <svg class="icon-trash" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
            <span class="sr-only">Remove</span>
        `;
        deleteBtn.addEventListener('click', () => this.removeSiteRule(domain));

        const saveLimit = async () => {
            const currentCap = this.controller?.settings?.restrictedSliderMax || 120;
            let newLimit = parseInt(limitInput.value, 10);
            if (!Number.isNaN(newLimit)) {
                newLimit = Math.min(Math.max(0, newLimit), currentCap);
                limitInput.value = newLimit;
                if (newLimit !== timeLimitMinutes) {
                    await this.addSiteRule(domain, 'RESTRICTED', newLimit);
                    timeLimitMinutes = newLimit;
                }
            } else {
                limitInput.value = timeLimitMinutes;
            }
        };

        // Only save on blur (user leaves the field) so focus is never
        // destroyed mid-edit by a re-render. This lets arrow keys, held
        // down or tapped repeatedly, change the value freely.
        limitInput.addEventListener('blur', async () => {
            const existingTimer = this.limitUpdateTimers.get(domain);
            if (existingTimer) {
                clearTimeout(existingTimer);
                this.limitUpdateTimers.delete(domain);
            }
            await saveLimit();
        });

        // Arrow keys: increment/decrement locally without saving yet.
        // preventDefault stops the browser from firing a 'change' event
        // on its own schedule which would have triggered a re-render.
        limitInput.addEventListener('keydown', async (event) => {
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                const cur = parseInt(limitInput.value, 10);
                const next = (Number.isNaN(cur) ? 0 : cur) + 1;
                if (next <= 1440) limitInput.value = next;
                return;
            }
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                const cur = parseInt(limitInput.value, 10);
                const next = (Number.isNaN(cur) ? 0 : cur) - 1;
                if (next >= 0) limitInput.value = next;
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                await saveLimit();
                limitInput.blur();
            }
        });

        const leftDiv = document.createElement('div');
        leftDiv.className = 'rule-row-left';
        leftDiv.appendChild(dragHandle);
        leftDiv.appendChild(favicon);
        leftDiv.appendChild(domainWrapper);

        const middleDiv = document.createElement('div');
        middleDiv.className = 'rule-row-middle';
        middleDiv.appendChild(limitInput);
        middleDiv.appendChild(suffixSpan);

        const rightDiv = document.createElement('div');
        rightDiv.className = 'rule-row-right';
        rightDiv.appendChild(deleteBtn);

        li.appendChild(leftDiv);
        li.appendChild(middleDiv);
        li.appendChild(rightDiv);
        return li;
    }

    // ── Group Rectangle Rendering ──────────────────────────────────────────

    /**
     * Render a group rectangle within the restricted list
     * @param {object} group - Group data from background
     * @param {object} domainLimitMap - Map of domain -> individual timeLimitMinutes
     * @returns {HTMLElement}
     */
    _renderGroupRectangle(group, domainLimitMap = {}) {
        const container = document.createElement('li');
        container.className = 'group-container';
        container.dataset.groupId = group.id;

        // Drop target for adding domains to this group
        const handleDrop = (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');
            const domain = e.dataTransfer.getData('text/plain');
            const sourceGroupId = e.dataTransfer.getData('text/x-group-id');
            // Skip same-group drops — handled by domainList reorder handler
            if (domain && sourceGroupId !== group.id) {
                this.addDomainToGroup(group.id, domain);
            }
        };
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            container.classList.add('drag-over');
        });
        container.addEventListener('dragleave', () => {
            container.classList.remove('drag-over');
        });
        container.addEventListener('drop', handleDrop);

        // Header: name + limit input + delete button
        const header = document.createElement('div');
        header.className = 'group-header';

        const groupTitleSection = document.createElement('div');
        groupTitleSection.className = 'group-title-section';

        const iconWrapper = document.createElement('button');
        iconWrapper.className = 'group-icon-picker-btn';
        iconWrapper.title = 'Change group icon';
        iconWrapper.type = 'button';
        iconWrapper.innerHTML = GROUP_ICONS[group.icon] || GROUP_ICONS.folder;

        const closePicker = () => {
            const dropdown = groupTitleSection.querySelector('.group-icon-picker-dropdown');
            if (dropdown) dropdown.remove();
            document.removeEventListener('click', closePicker);
        };

        iconWrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            const existingPicker = groupTitleSection.querySelector('.group-icon-picker-dropdown');
            if (existingPicker) {
                const wasThisOne = existingPicker.dataset.groupId === group.id;
                existingPicker.remove();
                if (wasThisOne) {
                    document.removeEventListener('click', closePicker);
                    return;
                }
            }

            const picker = document.createElement('div');
            picker.className = 'group-icon-picker-dropdown';
            picker.dataset.groupId = group.id;

            Object.entries(GROUP_ICONS).forEach(([key, svgMarkup]) => {
                const optBtn = document.createElement('button');
                optBtn.type = 'button';
                optBtn.className = `icon-picker-option${group.icon === key ? ' active' : ''}`;
                optBtn.innerHTML = svgMarkup;
                optBtn.title = key;
                optBtn.addEventListener('click', async (optEv) => {
                    optEv.stopPropagation();
                    picker.remove();
                    document.removeEventListener('click', closePicker);
                    iconWrapper.innerHTML = svgMarkup;
                    group.icon = key;
                    await this.updateGroupIcon(group.id, key);
                });
                picker.appendChild(optBtn);
            });

            groupTitleSection.appendChild(picker);
            document.addEventListener('click', closePicker);
        });

        groupTitleSection.appendChild(iconWrapper);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'group-name-text';
        nameSpan.textContent = group.name;
        groupTitleSection.appendChild(nameSpan);

        const limitInput = document.createElement('input');
        limitInput.type = 'number';
        limitInput.className = 'rule-limit-input-edit';
        limitInput.value = group.timeLimitMinutes;
        limitInput.min = 1;
        limitInput.max = 1440;
        limitInput.step = 1;
        limitInput.title = 'Edit daily limit (minutes)';

        const suffixSpan = document.createElement('span');
        suffixSpan.className = 'limit-suffix';
        suffixSpan.textContent = 'min/day';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'rule-delete-btn icon-btn';
        deleteBtn.title = 'Delete group';
        deleteBtn.innerHTML = `
            <svg class="icon-trash" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
            <span class="sr-only">Delete Group</span>
        `;
        deleteBtn.addEventListener('click', () => this.deleteGroup(group.id));

        const leftDiv = document.createElement('div');
        leftDiv.className = 'rule-row-left';
        leftDiv.appendChild(groupTitleSection);

        const middleDiv = document.createElement('div');
        middleDiv.className = 'rule-row-middle';
        middleDiv.appendChild(limitInput);
        middleDiv.appendChild(suffixSpan);

        const rightDiv = document.createElement('div');
        rightDiv.className = 'rule-row-right';
        rightDiv.appendChild(deleteBtn);

        header.appendChild(leftDiv);
        header.appendChild(middleDiv);
        header.appendChild(rightDiv);

        // Domain list
        const domainList = document.createElement('div');
        domainList.className = 'group-domain-list';

        group.domains.forEach((domain) => {
            const row = document.createElement('div');
            row.className = 'group-domain-row';
            row.draggable = true;

            row.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', domain);
                e.dataTransfer.setData('text/x-group-id', group.id);
                e.dataTransfer.effectAllowed = 'move';
                row.classList.add('dragging');
            });
            row.addEventListener('dragend', (e) => {
                row.classList.remove('dragging');
                document
                    .querySelectorAll('.drag-over')
                    .forEach((el) => el.classList.remove('drag-over'));
                // Dropped outside any valid target → remove from group (make general)
                if (e.dataTransfer.dropEffect === 'none') {
                    this.removeDomainFromGroup(group.id, domain);
                }
            });
            // Drag handle indicator
            const dragHandle = document.createElement('span');
            dragHandle.className = 'drag-handle-indicator';
            dragHandle.innerHTML = '⋮⋮';

            const favicon = document.createElement('img');
            favicon.className = 'rule-favicon';
            favicon.src = getFaviconUrl(domain);
            this._setupFaviconFallback(favicon, domain);

            const domainWrapper = document.createElement('div');
            domainWrapper.className = 'rule-domain-wrapper';

            const domainSpan = document.createElement('span');
            domainSpan.className = 'rule-domain';
            domainSpan.textContent = domain;

            const usageSpan = document.createElement('span');
            usageSpan.className = 'rule-usage-today';
            const domainUsage = this.controller.usage[domain] || {};
            const todaySeconds = TimeUtils.calculateTodayTime(domainUsage);
            usageSpan.textContent =
                todaySeconds > 0 ? `${TimeUtils.formatTime(todaySeconds)} today` : '0s today';

            domainWrapper.appendChild(domainSpan);
            domainWrapper.appendChild(usageSpan);

            const individualLimit = domainLimitMap[domain] || 30;
            const limitInput = document.createElement('input');
            limitInput.type = 'number';
            limitInput.className = 'rule-limit-input-edit';
            limitInput.value = individualLimit;
            limitInput.min = 0;
            limitInput.max = 1440;
            limitInput.step = 1;
            limitInput.title = 'Individual daily limit (minutes)';

            const suffixSpan = document.createElement('span');
            suffixSpan.className = 'limit-suffix';
            suffixSpan.textContent = 'min/day';

            const removeBtn = document.createElement('button');
            removeBtn.className = 'rule-delete-btn icon-btn';
            removeBtn.title = 'Remove domain from group';
            removeBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                <span class="sr-only">Remove</span>
            `;
            removeBtn.addEventListener('click', () => this.removeDomainFromGroup(group.id, domain));

            // Save individual limit change via ADD_SITE_RULE (updates existing rule)
            const saveLimit = async () => {
                const val = parseInt(limitInput.value, 10);
                if (!isNaN(val) && val >= 0 && val <= 1440 && val !== individualLimit) {
                    await this.addSiteRule(domain, 'RESTRICTED', val);
                }
            };
            limitInput.addEventListener('blur', saveLimit);
            limitInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveLimit().then(() => limitInput.blur());
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const cur = parseInt(limitInput.value, 10);
                    if (!isNaN(cur)) limitInput.value = cur + 1;
                }
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const cur = parseInt(limitInput.value, 10);
                    if (!isNaN(cur) && cur > 0) limitInput.value = cur - 1;
                }
            });

            const leftDiv = document.createElement('div');
            leftDiv.className = 'rule-row-left';
            leftDiv.appendChild(dragHandle);
            leftDiv.appendChild(favicon);
            leftDiv.appendChild(domainWrapper);

            const middleDiv = document.createElement('div');
            middleDiv.className = 'rule-row-middle';
            middleDiv.appendChild(limitInput);
            middleDiv.appendChild(suffixSpan);

            const rightDiv = document.createElement('div');
            rightDiv.className = 'rule-row-right';
            rightDiv.appendChild(removeBtn);

            row.appendChild(leftDiv);
            row.appendChild(middleDiv);
            row.appendChild(rightDiv);
            domainList.appendChild(row);
        });

        // Add domain input + button
        const addRow = document.createElement('div');
        addRow.className = 'group-add-domain-row';

        const addInput = document.createElement('input');
        addInput.type = 'text';
        addInput.className = 'modern-input';
        addInput.placeholder = 'Add domain to group...';
        addInput.style.flex = '1';

        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-secondary btn-small';
        addBtn.textContent = 'Add';
        const doAdd = () => {
            const domain = addInput.value.trim();
            if (domain) {
                this.addDomainToGroup(group.id, domain);
                addInput.value = '';
            }
        };
        addBtn.addEventListener('click', doAdd);
        addInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') doAdd();
        });

        addRow.appendChild(addInput);
        addRow.appendChild(addBtn);

        // Statistics bar
        let totalGroupUsageSeconds = 0;
        group.domains.forEach((d) => {
            const domainUsage = this.controller.usage[d] || {};
            totalGroupUsageSeconds += TimeUtils.calculateTodayTime(domainUsage);
        });

        const limitMinutes = group.timeLimitMinutes;
        const limitSeconds = limitMinutes * 60;
        const usedPercent = Math.min(100, (totalGroupUsageSeconds / limitSeconds) * 100);

        const statsBar = document.createElement('div');
        statsBar.className = 'group-stats-bar';

        const progressTrack = document.createElement('div');
        progressTrack.className = 'group-progress-track';

        const progressFill = document.createElement('div');
        progressFill.className = 'group-progress-fill';
        progressFill.style.width = `${usedPercent}%`;
        if (usedPercent >= 90) {
            progressFill.classList.add('danger');
        } else if (usedPercent >= 70) {
            progressFill.classList.add('warning');
        }
        progressTrack.appendChild(progressFill);

        const statsText = document.createElement('div');
        statsText.className = 'group-stats-text';

        const usedFormatted = TimeUtils.formatTime(totalGroupUsageSeconds);
        const limitFormatted = `${limitMinutes}m`;

        statsText.innerHTML = `
            <span><strong>${usedFormatted}</strong> / ${limitFormatted}</span>
        `;

        statsBar.appendChild(progressTrack);
        statsBar.appendChild(statsText);

        container.appendChild(header);
        container.appendChild(statsBar);
        container.appendChild(domainList);
        container.appendChild(addRow);

        // Bind limit change
        let timeout;
        limitInput.addEventListener('blur', () => {
            clearTimeout(timeout);
            const val = parseInt(limitInput.value, 10);
            if (!isNaN(val) && val > 0 && val !== group.timeLimitMinutes) {
                this.updateGroupLimit(group.id, val);
            }
        });
        limitInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                limitInput.blur();
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                const cur = parseInt(limitInput.value, 10);
                if (!isNaN(cur)) limitInput.value = cur + 1;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const cur = parseInt(limitInput.value, 10);
                if (!isNaN(cur) && cur > 1) limitInput.value = cur - 1;
            }
        });

        return container;
    }

    // ── New Group Inline Form ──────────────────────────────────────────────

    /**
     * Toggle the inline "New Group" creation form
     */
    _toggleNewGroupForm() {
        const existing = document.getElementById('newGroupForm');
        if (existing) {
            existing.remove();
            return;
        }
        const list = document.getElementById('restrictedList');
        if (!list) return;
        const form = this._createCreateGroupForm();
        list.parentNode.insertBefore(form, list);
        const nameInput = form.querySelector('.new-group-name-input');
        if (nameInput) nameInput.focus();
    }

    /**
     * Create the inline form element for creating a new group
     * @returns {HTMLDivElement}
     */
    _createCreateGroupForm() {
        const form = document.createElement('div');
        form.id = 'newGroupForm';
        form.className = 'new-group-form';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'modern-input new-group-name-input';
        nameInput.placeholder = 'Group name...';
        nameInput.setAttribute('autocomplete', 'off');

        const limitInput = document.createElement('input');
        limitInput.type = 'number';
        limitInput.className = 'rule-limit-input-edit';
        limitInput.value = '30';
        limitInput.min = 1;
        limitInput.title = 'Daily limit (minutes)';

        const createBtn = document.createElement('button');
        createBtn.className = 'btn btn-primary btn-small';
        createBtn.textContent = 'Create';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary btn-small';
        cancelBtn.textContent = 'Cancel';

        const doCreate = () => {
            const name = nameInput.value.trim();
            const limit = parseInt(limitInput.value, 10) || 30;
            if (!name) {
                this.controller.showWarning('Please enter a group name');
                return;
            }
            this.createGroup(name, [], limit);
            form.remove();
        };

        createBtn.addEventListener('click', doCreate);
        cancelBtn.addEventListener('click', () => form.remove());
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') doCreate();
        });

        form.appendChild(nameInput);
        form.appendChild(limitInput);
        form.appendChild(createBtn);
        form.appendChild(cancelBtn);

        return form;
    }

    // ── Group Budget CRUD ──────────────────────────────────────────────────

    /**
     * Create a new budget group
     * @param {string} name
     * @param {string[]} domains
     * @param {number} limit
     */
    async createGroup(name, domains, limit) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'CREATE_GROUP',
                name,
                domains,
                timeLimitMinutes: limit,
            });
            if (response.success) {
                await this.loadSiteRules();
                this.controller.showSuccess(`Created group "${name}"`);
            } else {
                this.controller.showWarning(response.error || 'Failed to create group');
            }
        } catch (error) {
            console.error('Error creating group:', error);
            this.controller.showError('Failed to create group');
        }
    }

    /**
     * Update a group's time limit
     * @param {string} id
     * @param {number} limit
     */
    async updateGroupLimit(id, limit) {
        try {
            await chrome.runtime.sendMessage({
                type: 'UPDATE_GROUP',
                id,
                timeLimitMinutes: limit,
            });
            await this.loadSiteRules();
        } catch (error) {
            console.error('Error updating group limit:', error);
        }
    }

    /**
     * Update a group's icon setting
     * @param {string} id
     * @param {string} icon
     */
    async updateGroupIcon(id, icon) {
        try {
            await chrome.runtime.sendMessage({
                type: 'UPDATE_GROUP',
                id,
                icon,
            });
        } catch (error) {
            console.error('Error updating group icon:', error);
        }
    }

    /**
     * Soft-delete a group
     * @param {string} id
     */
    async deleteGroup(id) {
        try {
            await chrome.runtime.sendMessage({ type: 'DELETE_GROUP', id });
            await this.loadSiteRules();
            this.controller.showSuccess('Group removed');
        } catch (error) {
            console.error('Error deleting group:', error);
        }
    }

    /**
     * Add a domain to a group
     * @param {string} groupId
     * @param {string} domain
     */
    async addDomainToGroup(groupId, domain) {
        const cleanDomain = domain
            .toLowerCase()
            .replace(/^www\./, '')
            .trim();
        if (!cleanDomain) return;
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'ADD_DOMAIN_TO_GROUP',
                groupId,
                domain: cleanDomain,
            });
            if (response.success) {
                if (!this.isUndoing) {
                    if (response.previousGroupId) {
                        // Moved from another group — undo moves it back
                        this.undoStack.push({
                            type: 'move',
                            domain: cleanDomain,
                            fromGroupId: response.previousGroupId,
                        });
                    } else {
                        // Fresh add — undo removes from group
                        this.undoStack.push({ type: 'remove', domain: cleanDomain, groupId });
                    }
                }
                await this.loadSiteRules();
            } else {
                this.controller.showWarning(response.error || 'Failed to add domain');
            }
        } catch (error) {
            console.error('Error adding domain to group:', error);
        }
    }

    /**
     * Remove a domain from a group
     * @param {string} groupId
     * @param {string} domain
     */
    async removeDomainFromGroup(groupId, domain) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'REMOVE_DOMAIN_FROM_GROUP',
                groupId,
                domain,
            });
            if (response.success) {
                if (!this.isUndoing) {
                    this.undoStack.push({ type: 'add', domain, groupId });
                }
                await this.loadSiteRules();
            } else {
                this.controller.showWarning(response.error || 'Failed to remove domain');
            }
        } catch (error) {
            console.error('Error removing domain from group:', error);
        }
    }

    /**
     * Undo the last grouping action (add or remove from group)
     */
    async undoLastGroupingChange() {
        if (this.undoStack.length === 0) {
            this.controller.showWarning('Nothing to undo');
            return;
        }

        const action = this.undoStack.pop();
        this.isUndoing = true;
        try {
            if (action.type === 'remove') {
                await this.removeDomainFromGroup(action.groupId, action.domain);
                this.controller.showSuccess(`Undid: Removed ${action.domain} from group`);
            } else if (action.type === 'add') {
                await this.addDomainToGroup(action.groupId, action.domain);
                this.controller.showSuccess(`Undid: Re-added ${action.domain} to group`);
            } else if (action.type === 'move') {
                await this.addDomainToGroup(action.fromGroupId, action.domain);
                this.controller.showSuccess(`Undid: Moved ${action.domain} back to original group`);
            }
        } catch (error) {
            console.error('Error executing undo:', error);
            this.controller.showError('Failed to undo grouping change');
        } finally {
            this.isUndoing = false;
        }
    }

    /**
     *
     */
    _buildCircularPicker() {
        const container = document.getElementById('restrictedPickerMount');
        if (!container) return;

        const SIZE = 110;
        const CX = SIZE / 2;
        const CY = SIZE / 2;
        const R = 42;

        let maxMin = this.controller?.settings?.restrictedSliderMax || 120;

        const minutesToAngle = (m) => (m / maxMin) * 360 - 90;
        const angleToMinutes = (deg) => {
            const d = (((deg + 90) % 360) + 360) % 360;
            return Math.max(0, Math.min(maxMin, Math.round((d / 360) * maxMin)));
        };
        const polarToXY = (angleDeg, r) => {
            const rad = (angleDeg * Math.PI) / 180;
            return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
        };
        const describeArc = (startAngle, endAngle, r) => {
            const e = polarToXY(endAngle, r);
            const large = (endAngle - startAngle + 360) % 360 > 180 ? 1 : 0;
            return `M ${CX} ${CY - r} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
        };

        // Wrapper for position:relative (needed for overlay input)
        const wrap = document.createElement('div');
        wrap.className = 'circ-picker-inner-wrap';

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
        svg.setAttribute('class', 'circ-picker-svg');
        svg.setAttribute('aria-hidden', 'true');

        const trackCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        trackCircle.setAttribute('cx', CX);
        trackCircle.setAttribute('cy', CY);
        trackCircle.setAttribute('r', R);
        trackCircle.setAttribute('class', 'circ-track');
        svg.appendChild(trackCircle);

        const arcPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arcPath.setAttribute('class', 'circ-arc');
        svg.appendChild(arcPath);

        const handleCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        handleCircle.setAttribute('r', 6);
        handleCircle.setAttribute('class', 'circ-handle');
        handleCircle.setAttribute('tabindex', '0');
        handleCircle.setAttribute('role', 'slider');
        handleCircle.setAttribute('aria-label', 'Time limit');
        svg.appendChild(handleCircle);

        wrap.appendChild(svg);

        // Editable center input overlaid on the SVG
        const centerInput = document.createElement('input');
        centerInput.type = 'number';
        centerInput.className = 'circ-center-input';
        centerInput.min = '0';
        centerInput.setAttribute('aria-label', 'Daily time limit in minutes');
        centerInput.setAttribute('autocomplete', 'off');
        centerInput.setAttribute('name', 'restricted-minutes');
        wrap.appendChild(centerInput);

        container.appendChild(wrap);

        const formatLabel = (m) => {
            if (m === 0) return '0';
            if (m >= 60) {
                const h = Math.floor(m / 60);
                const rem = m % 60;
                return rem ? `${h}h${rem}m` : `${h}h`;
            }
            return `${m}`;
        };

        const update = (minutes) => {
            this._restrictedMinutes = Math.max(0, Math.min(maxMin, minutes));
            const angle = minutesToAngle(this._restrictedMinutes);
            const hPos = polarToXY(angle, R);
            handleCircle.setAttribute('cx', hPos.x);
            handleCircle.setAttribute('cy', hPos.y);
            handleCircle.setAttribute('aria-valuenow', this._restrictedMinutes);
            handleCircle.setAttribute('aria-valuemin', '0');
            handleCircle.setAttribute('aria-valuemax', maxMin);

            if (this._restrictedMinutes > 0) {
                arcPath.setAttribute('d', describeArc(-90, angle, R));
                arcPath.style.display = '';
            } else {
                arcPath.style.display = 'none';
            }

            // Only update input value if not focused (don't interrupt typing)
            if (document.activeElement !== centerInput) {
                centerInput.value = this._restrictedMinutes;
            }
            centerInput.max = maxMin;
        };

        update(this._restrictedMinutes);

        const getAngleFromEvent = (e) => {
            const rect = svg.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
        };

        let dragging = false;

        const startDrag = (e) => {
            dragging = true;
            document.body.style.userSelect = 'none';
            e.preventDefault();
        };
        const moveDrag = (e) => {
            if (!dragging) return;
            e.preventDefault();
            update(angleToMinutes(getAngleFromEvent(e)));
        };
        const stopDrag = () => {
            dragging = false;
            document.body.style.userSelect = '';
        };

        handleCircle.addEventListener('mousedown', startDrag);
        handleCircle.addEventListener('touchstart', startDrag, { passive: false });
        svg.addEventListener('mousemove', moveDrag);
        svg.addEventListener('touchmove', moveDrag, { passive: false });
        window.addEventListener('mouseup', stopDrag);
        window.addEventListener('touchend', stopDrag);

        // Click track to jump
        svg.addEventListener('click', (e) => {
            if (e.target === handleCircle) return;
            update(angleToMinutes(getAngleFromEvent(e)));
        });

        // Keyboard on handle
        handleCircle.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault();
                update(this._restrictedMinutes + 1);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault();
                update(this._restrictedMinutes - 1);
            }
        });

        centerInput.addEventListener('input', () => {
            const v = parseInt(centerInput.value, 10);
            if (!isNaN(v) && v >= 0) {
                this._restrictedMinutes = Math.min(maxMin, v);
                update(this._restrictedMinutes);
            }
        });
        centerInput.addEventListener('blur', () => {
            // Clamp and sync on blur
            update(this._restrictedMinutes);
        });

        const maxInput = document.getElementById('restrictedSliderMax');
        if (maxInput) {
            maxInput.addEventListener('change', () => {
                const v = parseInt(maxInput.value, 10);
                if (!isNaN(v) && v >= 1) {
                    maxMin = v;
                    update(Math.min(this._restrictedMinutes, maxMin));
                }
            });
        }
    }
}
