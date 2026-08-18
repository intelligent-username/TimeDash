/* global TimeUtils */
import { GROUP_ICONS, createLimitInput } from './blocking-helpers.js';
import { createDomainRow } from './domain-row.js';

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
        });
        domainList.appendChild(row);
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
