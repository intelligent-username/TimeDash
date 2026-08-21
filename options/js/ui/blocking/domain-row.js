/* global TimeUtils */
import { getFaviconUrl } from '../../utils/dom.js';
import { setupFaviconFallback, createLimitInput } from './blocking-helpers.js';

/**
 * Builds a standardized domain row element for both standalone restricted rules and group member rows.
 * @param {object} params
 * @param {string} params.domain
 * @param {number} params.timeLimitMinutes
 * @param {number} params.maxCap
 * @param {object} params.controller
 * @param {Function} params.onSaveLimit
 * @param {Function} params.onDelete
 * @param {string} [params.deleteTitle]
 * @param {string} [params.groupId]
 * @param {Function} [params.onDragOut]
 * @param {Function} [params.onDragActive] - Called with true/false on group-row drag start/end
 * @returns {HTMLElement}
 */
export function createDomainRow({
    domain,
    timeLimitMinutes,
    maxCap,
    controller,
    onSaveLimit,
    onDelete,
    deleteTitle = 'Remove restriction',
    groupId = null,
    onDragOut = null,
    onDragActive = null,
}) {
    const isGroupRow = Boolean(groupId);
    const row = document.createElement(isGroupRow ? 'div' : 'li');
    row.className = isGroupRow ? 'group-domain-row' : 'rule-item restrict-item';
    row.draggable = true;

    row.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', domain);
        if (isGroupRow) {
            e.dataTransfer.setData('text/x-group-id', groupId);
        }
        e.dataTransfer.effectAllowed = 'move';
        row.classList.add('dragging');
        if (isGroupRow && typeof onDragActive === 'function') onDragActive(true);
    });

    row.addEventListener('dragend', (e) => {
        row.classList.remove('dragging');
        if (isGroupRow && typeof onDragActive === 'function') onDragActive(false);
        document
            .querySelectorAll('.drag-over')
            .forEach((el) => el.classList.remove('drag-over'));
        if (isGroupRow && e.dataTransfer.dropEffect === 'none' && typeof onDragOut === 'function') {
            onDragOut(domain);
        }
    });

    // Minimal dragover — Chrome needs DEEPEST element to call preventDefault
    if (isGroupRow) {
        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
    }

    // Drag handle
    const dragHandle = document.createElement('span');
    dragHandle.className = 'drag-handle-indicator';
    dragHandle.innerHTML = '⋮⋮';

    // Favicon
    const favicon = document.createElement('img');
    favicon.className = 'rule-favicon';
    favicon.src = getFaviconUrl(domain);
    setupFaviconFallback(favicon, domain);

    // Domain name & today's usage text
    const domainWrapper = document.createElement('div');
    domainWrapper.className = 'rule-domain-wrapper';

    const domainSpan = document.createElement('span');
    domainSpan.className = 'rule-domain';
    domainSpan.textContent = domain;
    domainSpan.title = domain;

    const usageSpan = document.createElement('span');
    usageSpan.className = 'rule-usage-today';
    const domainUsage = controller?.usage?.[domain] || {};
    const todaySeconds = typeof TimeUtils !== 'undefined' ? TimeUtils.calculateTodayTime(domainUsage) : 0;
    usageSpan.textContent =
        todaySeconds > 0 && typeof TimeUtils !== 'undefined'
            ? `${TimeUtils.formatTime(todaySeconds)} today`
            : '0s today';

    domainWrapper.appendChild(domainSpan);

    // Multi-label domains are exact-host rules: tracked separately from their parent
    if (domain.split('.').length > 2) {
        const badge = document.createElement('span');
        badge.className = 'rule-domain-badge';
        badge.textContent = chrome.i18n.getMessage('exactHostBadge') || 'exact';
        badge.title =
            chrome.i18n.getMessage('exactHostTooltip') ||
            'Subdomain specified exactly — time on it is tracked separately from its parent domain.';
        domainWrapper.appendChild(badge);
    }
    domainWrapper.appendChild(usageSpan);

    // Editable limit input
    const limitInput = createLimitInput(
        timeLimitMinutes,
        maxCap,
        onSaveLimit,
        isGroupRow ? 'Individual daily limit (minutes)' : `Edit daily limit (max ${maxCap} min)`
    );

    const suffixSpan = document.createElement('span');
    suffixSpan.className = 'limit-suffix';
    suffixSpan.textContent = 'min/day';

    // Delete/Remove button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'rule-delete-btn icon-btn';
    deleteBtn.title = deleteTitle;
    deleteBtn.innerHTML = isGroupRow
        ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg><span class="sr-only">Remove</span>`
        : `<svg class="icon-trash" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg><span class="sr-only">Remove</span>`;
    deleteBtn.addEventListener('click', () => onDelete(domain));

    // Columns
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

    row.appendChild(leftDiv);
    row.appendChild(middleDiv);
    row.appendChild(rightDiv);

    return row;
}
