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
                this.addSiteRule(restrictedDomainInput.value.trim(), 'RESTRICTED', this._restrictedMinutes);
                restrictedDomainInput.value = '';
            });

            restrictedDomainInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addSiteRule(restrictedDomainInput.value.trim(), 'RESTRICTED', this._restrictedMinutes);
                    restrictedDomainInput.value = '';
                }
            });
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
            const response = await chrome.runtime.sendMessage({ type: 'GET_SITE_RULES' });
            this.renderBlockedList(response.blocked || []);
            this.renderRestrictedList(response.restricted || []);
            this.controller.updateRestrictedDomains(
                response.restricted ? response.restricted.map((r) => r.domain) : []
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
     *
     * @param sites
     */
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
            list.appendChild(li);
        });
    }

    /** Build the circular SVG time picker — no external number input */
    _buildCircularPicker() {
        const container = document.getElementById('restrictedPickerMount');
        if (!container) return;

        const SIZE = 110;
        const CX = SIZE / 2;
        const CY = SIZE / 2;
        const R = 42;

        let maxMin = 120;

        const minutesToAngle = (m) => (m / maxMin) * 360 - 90;
        const angleToMinutes = (deg) => {
            const d = ((deg + 90) % 360 + 360) % 360;
            return Math.max(0, Math.min(maxMin, Math.round((d / 360) * maxMin)));
        };
        const polarToXY = (angleDeg, r) => {
            const rad = (angleDeg * Math.PI) / 180;
            return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
        };
        const describeArc = (startAngle, endAngle, r) => {
            const e = polarToXY(endAngle, r);
            const large = ((endAngle - startAngle) + 360) % 360 > 180 ? 1 : 0;
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

        // Center input — type to set value directly
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

        // Max input — recalibrate ring scale
        const maxInput = document.getElementById('restrictedMaxInput');
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
