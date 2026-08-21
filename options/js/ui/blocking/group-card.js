/* global TimeUtils */
import { GROUP_ICONS, createLimitInput } from './blocking-helpers.js';
import { createDomainRow } from './domain-row.js';

/**
 * Tracks which group (if any) a drag gesture originated from, so containers can
 * skip their own highlight/drop logic during same-group reorders.
 * @type {string | null}
 */
let activeDragGroupId = null;
document.addEventListener('dragstart', (e) => {
    activeDragGroupId = e.dataTransfer.getData('text/x-group-id') || null;
});
document.addEventListener('dragend', () => {
    activeDragGroupId = null;
});

/**
 * Moves an element within a list while animating all siblings from their old
 * positions to their new ones (FLIP technique) for smooth live reordering.
 * @param {HTMLElement} list
 * @param {Function} mutate - DOM mutation that changes row order
 */
function flipSwap(list, mutate) {
    const rows = [...list.children];
    const firstTop = new Map(rows.map((r) => [r, r.getBoundingClientRect().top]));
    mutate();
    rows.forEach((r) => {
        if (!list.contains(r)) return;
        const dy = firstTop.get(r) - r.getBoundingClientRect().top;
        if (!dy) return;
        r.style.transition = 'none';
        r.style.transform = `translateY(${dy}px)`;
        requestAnimationFrame(() => {
            r.style.transition = 'transform 150ms ease';
            r.style.transform = '';
            r.addEventListener(
                'transitionend',
                () => {
                    r.style.transition = '';
                },
                { once: true }
            );
        });
    });
}

/**
 * Renders an entire group rectangle container with drop zones, icon picker, domain rows, and statistics.
 * @param {object} group
 * @param {object} domainLimitMap
 * @param {object} context - BlockingUI instance providing action methods
 * @returns {HTMLElement}
 */
export function renderGroupRectangle(group, domainLimitMap, context) {
    const container = document.createElement('li');
    container.className = 'group-container';
    container.dataset.groupId = group.id;

    // Drop target for adding domains to this group
    const handleDrop = (e) => {
        e.preventDefault();
        container.classList.remove('drag-over');
        const domain = e.dataTransfer.getData('text/plain');
        const sourceGroupId = e.dataTransfer.getData('text/x-group-id');
        if (domain && sourceGroupId !== group.id) {
            context.addDomainToGroup(group.id, domain);
        }
    };
    container.addEventListener('dragover', (e) => {
        if (activeDragGroupId === group.id) return; // same-group reorder, not an incoming drop
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
    iconWrapper.title = I18n.t('changeGroupIcon');
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
                await context.updateGroupIcon(group.id, key);
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

    const limitInput = createLimitInput(
        group.timeLimitMinutes,
        1440,
        async (newLimit) => context.updateGroupLimit(group.id, newLimit),
        'Edit daily limit (minutes)'
    );

    const suffixSpan = document.createElement('span');
    suffixSpan.className = 'limit-suffix';
    suffixSpan.textContent = I18n.t('minPerDay');

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'rule-delete-btn icon-btn';
    deleteBtn.title = I18n.t('deleteGroup');
    deleteBtn.innerHTML = `
        <svg class="icon-trash" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
        <span class="sr-only">Delete Group</span>
    `;
    deleteBtn.addEventListener('click', () => context.deleteGroup(group.id));

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
        const individualLimit = domainLimitMap[domain] ?? 30;
        const row = createDomainRow({
            domain,
            timeLimitMinutes: individualLimit,
            maxCap: 1440,
            controller: context.controller,
            onSaveLimit: async (newLimit) => context.addSiteRule(domain, 'RESTRICTED', newLimit),
            onDelete: (d) => context.removeDomainFromGroup(group.id, d),
            deleteTitle: I18n.t('removeDomainFromGroup'),
            groupId: group.id,
            onDragOut: (d) => context.removeDomainFromGroup(group.id, d),
            onDragActive: (active) => domainList.classList.toggle('reorder-active', active),
        });
        domainList.appendChild(row);
    });

    // --- Live vertical-only reorder ---
    // A custom ghost follows the cursor but is clamped to the list's vertical
    // band (X is locked to the row's column). The source row is swapped in the
    // DOM in real time as the ghost crosses sibling midpoints, with FLIP
    // animation on the displaced rows. Order is persisted on dragend.
    let reorderState = null; // { row, ghost }

    domainList.addEventListener('dragstart', (e) => {
        const row = e.target.closest?.('.group-domain-row');
        if (!row || !domainList.contains(row)) return;
        if (e.dataTransfer.getData('text/x-group-id') !== group.id) return;

        // Suppress the native drag image — we render our own constrained ghost
        const hidden = document.createElement('div');
        hidden.style.cssText = 'position:fixed;top:-200px;left:-200px;width:1px;height:1px;opacity:0;';
        document.body.appendChild(hidden);
        e.dataTransfer.setDragImage(hidden, 0, 0);
        requestAnimationFrame(() => hidden.remove());

        const rect = row.getBoundingClientRect();
        const ghost = row.cloneNode(true);
        ghost.classList.remove('dragging');
        ghost.classList.add('drag-ghost');
        Object.assign(ghost.style, {
            position: 'fixed',
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            margin: '0',
            pointerEvents: 'none',
            zIndex: '1000',
        });
        document.body.appendChild(ghost);

        reorderState = { row, ghost };
        row.classList.add('drag-source');
    });

    domainList.addEventListener(
        'dragover',
        (e) => {
            if (!reorderState) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        }
    );

    domainList.addEventListener('drag', (e) => {
        if (!reorderState) return;
        const { ghost, row } = reorderState;
        const listRect = domainList.getBoundingClientRect();
        const h = ghost.offsetHeight;

        // Constrain ghost: vertical only, clamped to the list's band
        const y = Math.max(listRect.top, Math.min(listRect.bottom - h, e.clientY - h / 2));
        ghost.style.top = `${y}px`;

        // Live swap when the ghost crosses a sibling's vertical midpoint
        // (only while the cursor is actually over the list)
        if (e.clientY < listRect.top || e.clientY > listRect.bottom) return;
        const siblings = [...domainList.querySelectorAll('.group-domain-row:not(.drag-source)')];
        let target = null;
        for (const sib of siblings) {
            const rect = sib.getBoundingClientRect();
            if (e.clientY < rect.top + rect.height / 2) {
                target = sib;
                break;
            }
        }
        if (target && target !== row.nextElementSibling) {
            flipSwap(domainList, () => domainList.insertBefore(row, target));
        } else if (!target && siblings.length && row !== domainList.lastElementChild) {
            flipSwap(domainList, () => domainList.appendChild(row));
        }
    });

    // Swallow drops for same-group reorders (persistence happens on dragend)
    domainList.addEventListener('drop', (e) => {
        if (reorderState) {
            e.preventDefault();
            e.stopPropagation();
        }
    });

    domainList.addEventListener('dragend', () => {
        if (!reorderState) return;
        reorderState.ghost.remove();
        reorderState.row.classList.remove('drag-source');
        reorderState = null;

        const newDomains = [...domainList.querySelectorAll('.group-domain-row .rule-domain')].map(
            (el) => el.textContent
        );
        if (newDomains.join('\u0000') === group.domains.join('\u0000')) return;
        group.domains = newDomains;
        chrome.runtime.sendMessage({
            type: 'UPDATE_GROUP',
            id: group.id,
            domains: newDomains,
        })
            .then(() => context.loadSiteRules())
            .catch(() => {});
    });

    // Add domain input + button
    const addRow = document.createElement('div');
    addRow.className = 'group-add-domain-row';

    const addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.className = 'modern-input';
    addInput.placeholder = I18n.t('addDomainToGroup');
    addInput.style.flex = '1';

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-secondary btn-small';
    addBtn.textContent = I18n.t('addLabel');
    const doAdd = () => {
        const domain = addInput.value.trim();
        if (domain) {
            context.addDomainToGroup(group.id, domain);
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
        const domainUsage = context.controller?.usage?.[d] || {};
        totalGroupUsageSeconds += typeof TimeUtils !== 'undefined' ? TimeUtils.calculateTodayTime(domainUsage) : 0;
    });

    const limitMinutes = group.timeLimitMinutes;
    const limitSeconds = limitMinutes * 60;
    const usedPercent = limitSeconds > 0 ? Math.min(100, (totalGroupUsageSeconds / limitSeconds) * 100) : 0;

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
    const usedFormatted = typeof TimeUtils !== 'undefined' ? TimeUtils.formatTime(totalGroupUsageSeconds) : `${Math.floor(totalGroupUsageSeconds / 60)}m`;
    const limitFormatted = `${limitMinutes}m`;

    statsText.innerHTML = `<span><strong>${usedFormatted}</strong> / ${limitFormatted}</span>`;

    statsBar.appendChild(progressTrack);
    statsBar.appendChild(statsText);

    container.appendChild(header);
    container.appendChild(statsBar);
    container.appendChild(domainList);
    container.appendChild(addRow);

    return container;
}
