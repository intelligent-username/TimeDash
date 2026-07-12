import { getFaviconUrl } from '../utils/dom.js';

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
                timeLimitMinutes,
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

        // Drop target: dropping a group domain row ungroups it
        newList.addEventListener('dragover', (e) => {
            if (e.dataTransfer.types.includes('text/x-group-id')) {
                e.preventDefault();
                newList.classList.add('drag-ungroup');
            }
        });
        newList.addEventListener('dragleave', () => {
            newList.classList.remove('drag-ungroup');
        });
        newList.addEventListener('drop', (e) => {
            e.preventDefault();
            newList.classList.remove('drag-ungroup');
            const domain = e.dataTransfer.getData('text/plain');
            const groupId = e.dataTransfer.getData('text/x-group-id');
            if (domain && groupId) {
                this.removeDomainFromGroup(groupId, domain);
            }
        });

        const domainLimitMap = {};
        sites.forEach((s) => { domainLimitMap[s.domain] = s.timeLimitMinutes; });

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
            document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
        });

        const infoDiv = document.createElement('div');
        infoDiv.className = 'rule-item-info';

        const favicon = document.createElement('img');
        favicon.className = 'rule-favicon';
        favicon.src = getFaviconUrl(domain);
        favicon.onerror = () => {
            favicon.style.display = 'none';
        };

        const domainSpan = document.createElement('span');
        domainSpan.className = 'rule-domain';
        domainSpan.textContent = domain;

        const limitInput = document.createElement('input');
        limitInput.type = 'number';
        limitInput.className = 'rule-limit-input-edit';
        limitInput.value = timeLimitMinutes;
        limitInput.min = 0;
        limitInput.max = 1440;
        limitInput.step = 1;
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

        const saveLimit = async () => {
            const newLimit = parseInt(limitInput.value, 10);
            if (
                !Number.isNaN(newLimit) &&
                newLimit >= 0 &&
                newLimit <= 1440 &&
                newLimit !== timeLimitMinutes
            ) {
                await this.addSiteRule(domain, 'RESTRICTED', newLimit);
                timeLimitMinutes = newLimit;
            } else if (Number.isNaN(newLimit) || newLimit < 0 || newLimit > 1440) {
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

        li.appendChild(infoDiv);
        li.appendChild(deleteBtn);
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
            if (domain) {
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

        const nameSpan = document.createElement('span');
        nameSpan.className = 'group-name-text';
        nameSpan.textContent = group.name;

        const controls = document.createElement('div');
        controls.className = 'group-controls';

        const limitInput = document.createElement('input');
        limitInput.type = 'number';
        limitInput.className = 'rule-limit-input-edit';
        limitInput.value = group.timeLimitMinutes;
        limitInput.min = 1;
        limitInput.title = 'Daily limit (minutes)';

        const suffixSpan = document.createElement('span');
        suffixSpan.className = 'limit-suffix';
        suffixSpan.textContent = 'min/day';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'rule-delete-btn';
        deleteBtn.textContent = 'Delete Group';
        deleteBtn.addEventListener('click', () => this.deleteGroup(group.id));

        controls.appendChild(limitInput);
        controls.appendChild(suffixSpan);
        controls.appendChild(deleteBtn);

        header.appendChild(nameSpan);
        header.appendChild(controls);

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
            row.addEventListener('dragend', () => {
                row.classList.remove('dragging');
                document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
            });

            const domainSpan = document.createElement('span');
            domainSpan.className = 'rule-domain';
            domainSpan.textContent = domain;

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
            removeBtn.className = 'rule-delete-btn';
            removeBtn.textContent = 'Remove';
            removeBtn.style.fontSize = '0.8rem';
            removeBtn.addEventListener('click', () =>
                this.removeDomainFromGroup(group.id, domain)
            );

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

            const controls = document.createElement('div');
            controls.className = 'group-controls';
            controls.appendChild(limitInput);
            controls.appendChild(suffixSpan);
            controls.appendChild(removeBtn);

            row.appendChild(domainSpan);
            row.appendChild(controls);
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

        container.appendChild(header);
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
        const cleanDomain = domain.toLowerCase().replace(/^www\./, '').trim();
        if (!cleanDomain) return;
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'ADD_DOMAIN_TO_GROUP',
                groupId,
                domain: cleanDomain,
            });
            if (response.success) {
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
            await chrome.runtime.sendMessage({
                type: 'REMOVE_DOMAIN_FROM_GROUP',
                groupId,
                domain,
            });
            await this.loadSiteRules();
        } catch (error) {
            console.error('Error removing domain from group:', error);
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
