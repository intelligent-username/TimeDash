/**
 *
 */
export class DataManager {
    /**
     *
     * @param controller
     */
    constructor(controller) {
        this.controller = controller;
    }

    /**
     *
     */
    setup() {
        // Header actions
        const exportBtn = document.getElementById('exportBtn'); // In header
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportData());

        const resetBtn = document.getElementById('resetBtn'); // In header
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetSettings());

        // Potential settings panel actions
        const exportDataBtn = document.getElementById('exportData');
        if (exportDataBtn) exportDataBtn.addEventListener('click', () => this.exportData());

        const importBtn = document.getElementById('importData');
        const importFile = document.getElementById('importFile');
        if (importBtn && importFile) {
            importBtn.addEventListener('click', () => importFile.click());
            importFile.addEventListener('change', (e) => this.importData(e));
        }

        const resetSettingsBtn = document.getElementById('resetSettings');
        if (resetSettingsBtn)
            resetSettingsBtn.addEventListener('click', () => this.resetSettings());

        // Privacy Tab Actions
        const exportPrivacyBtn = document.getElementById('exportDataPrivacy');
        if (exportPrivacyBtn) exportPrivacyBtn.addEventListener('click', () => this.exportData());

        const compactBtn = document.getElementById('compactStorageBtn');
        if (compactBtn) {
            compactBtn.addEventListener('click', () => this.compactStorage());
        }

        this.setupDataSearch();
        this.updateStorageUsage();
    }

    /**
     *
     */
    async compactStorage() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'COMPACT_STORAGE' });
            if (!response || response.success !== true) {
                throw new Error('Background compact failed');
            }
            await this.controller.loadAllData();
            this.controller.refreshUI();
            this.updateStorageUsage();
            this.controller.showSuccess(chrome.i18n.getMessage('storageCompacted'));
        } catch (error) {
            console.error('Failed to compact storage:', error);
            this.controller.showError(chrome.i18n.getMessage('failedCompactStorage'));
        }
    }

    /**
     *
     */
    setupDataSearch() {
        const searchInput = document.getElementById('deleteDataSearch');
        const resultsDiv = document.getElementById('deleteDataResults');

        if (searchInput && resultsDiv) {
            searchInput.addEventListener('input', () => {
                const query = searchInput.value.trim().toLowerCase();
                if (!query) {
                    resultsDiv.style.display = 'none';
                    return;
                }

                const usage = this.controller.usage || {};
                const matches = Object.keys(usage).filter((d) => d.includes(query));

                if (matches.length > 0) {
                    resultsDiv.style.display = 'block';
                    resultsDiv.innerHTML = matches
                        .map(
                            (d) => `
                        <div class="rule-item" style="padding: 8px; border-bottom: 1px solid var(--border-color);">
                            <span class="rule-domain">${d}</span>
                            <button class="rule-delete-btn" data-delete-domain="${d}">${chrome.i18n.getMessage('delete')}</button>
                        </div>
                    `
                        )
                        .join('');
                } else {
                    resultsDiv.style.display = 'block';
                    resultsDiv.innerHTML =
                        `<div style="padding: 8px; color: var(--text-secondary);">${chrome.i18n.getMessage('noMatchesFound')}</div>`;
                }
            });

            resultsDiv.addEventListener('click', async (e) => {
                if (e.target.classList.contains('rule-delete-btn')) {
                    const domain = e.target.dataset.deleteDomain;
                    if (confirm(chrome.i18n.getMessage('deleteDataForDomainConfirm', [domain]))) {
                        const response = await chrome.runtime.sendMessage({
                            type: 'DELETE_DOMAIN_DATA',
                            domain,
                        });
                        if (response && response.success) {
                            delete this.controller.usage[domain];
                            this.controller.showSuccess(chrome.i18n.getMessage('deletedDataForDomain', [domain]));
                            this.controller.refreshUI();
                            this.updateStorageUsage();
                            searchInput.dispatchEvent(new Event('input')); // Refresh list
                        }
                    }
                }
            });
        }
    }

    /**
     *
     */
    async updateStorageUsage() {
        if (!this.controller.storageManager.getStorageUsage) return;
        const bytes = await this.controller.storageManager.getStorageUsage();
        
        let usageText = '0 KB';
        if (bytes >= 1024 * 1024) {
            usageText = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        } else if (bytes >= 1024) {
            usageText = `${(bytes / 1024).toFixed(1)} KB`;
        } else {
            usageText = `${bytes} B`;
        }

        const valEl = document.getElementById('storageUsageValue');
        if (valEl) valEl.textContent = usageText;

        // Use the user's custom storage limit, falling back to 10MB
        const settings = this.controller.settings || {};
        const limitMB = Number(settings.storageLimitMB) || 10;
        const limitBytes = limitMB * 1024 * 1024;
        const rawPercent = (bytes / limitBytes) * 100;
        
        let percentStr;
        if (rawPercent === 0) percentStr = '0%';
        else if (rawPercent < 0.01) percentStr = '<0.01%';
        else if (rawPercent < 1) percentStr = `${rawPercent.toFixed(2)}%`;
        else percentStr = `${rawPercent.toFixed(1)}%`;

        const exceeded = bytes >= limitBytes;

        const fillEl = document.getElementById('storageUsageFill');
        if (fillEl) {
            fillEl.style.width = `${Math.min(rawPercent, 100)}%`;
            fillEl.classList.toggle('exceeded', exceeded);
        }

        const quotaEl = document.getElementById('storageQuotaValue');
            if (quotaEl) quotaEl.textContent = chrome.i18n.getMessage('storageQuotaOfLimit', [percentStr, limitMB]);

        // Show or hide the warning banner
        const warningEl = document.getElementById('storageLimitWarning');
        const warningDetailEl = document.getElementById('storageLimitWarningDetail');
        if (warningEl) {
            warningEl.style.display = exceeded ? 'flex' : 'none';
        }
        if (warningDetailEl && exceeded) {
            warningDetailEl.textContent = chrome.i18n.getMessage('storageWarningDetail', [
                usageText,
                limitMB,
            ]);
        }
    }

    /**
     *
     */
    async exportData() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'EXPORT_DATA_JSON' });
            const data = response?.data;
            if (!data) throw new Error('Missing export payload');

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const now = new Date();
            const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            a.href = url;
            a.download = `TDE_${localDate}.json`;
            a.click();
            URL.revokeObjectURL(url);

            this.controller.showSuccess(chrome.i18n.getMessage('dataExportedSuccess'));
        } catch (error) {
            console.error('Failed to export data:', error);
            this.controller.showError(chrome.i18n.getMessage('failedExportData'));
        }
    }

    /**
     *
     * @param event
     */
    promptImportMode() {
        return new Promise((resolve) => {
            const modal = document.getElementById('importModal');
            const title = document.getElementById('importModalTitle');
            const msg = document.getElementById('importModalMessage');
            const appendBtn = document.getElementById('importAppendBtn');
            const replaceBtn = document.getElementById('importReplaceBtn');
            const cancelBtn = document.getElementById('importCancelBtn');

            if (!modal || !title || !msg || !appendBtn || !replaceBtn || !cancelBtn) {
                const choice = confirm(
                    chrome.i18n.getMessage('importDataPrompt')
                );
                resolve(choice ? 'merge' : 'overwrite');
                return;
            }

            title.textContent = chrome.i18n.getMessage('importData');
            msg.textContent =
                chrome.i18n.getMessage('importDataMessage');

            modal.classList.add('show');

            const cleanup = () => {
                modal.classList.remove('show');
                appendBtn.removeEventListener('click', onAppend);
                replaceBtn.removeEventListener('click', onReplace);
                cancelBtn.removeEventListener('click', onCancel);
            };

            const onAppend = () => {
                cleanup();
                resolve('merge');
            };

            const onReplace = () => {
                cleanup();
                resolve('overwrite');
            };

            const onCancel = () => {
                cleanup();
                resolve(null);
            };

            appendBtn.addEventListener('click', onAppend);
            replaceBtn.addEventListener('click', onReplace);
            cancelBtn.addEventListener('click', onCancel);
        });
    }

    /**
     *
     * @param event
     */
    async importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (
                !data.usage &&
                !data.settings &&
                !data.blockList &&
                !data.siteRules &&
                !data.siteGroups
            ) {
                throw new Error('Invalid data format');
            }

            const importMode = await this.promptImportMode();
            if (!importMode) return;

            if (importMode === 'merge') {
                // Flush any lingering in-memory updates from background before merging
                await chrome.runtime.sendMessage({ type: 'FLUSH_PENDING_UPDATES' }).catch(() => {});

                if (data.usage !== undefined) {
                    const usageResponse = await chrome.runtime.sendMessage({
                        type: 'IMPORT_USAGE',
                        usage: data.usage,
                        mode: 'merge',
                    });
                    if (!usageResponse || usageResponse.success !== true) {
                        throw new Error('Failed to import usage data');
                    }
                }

                if (data.settings) {
                    const existingSettings = await this.controller.storageManager.getSettings();
                    const currentLimit = this.controller.settings?.storageLimitMB || existingSettings.storageLimitMB;
                    const mergedSettings = { ...existingSettings, ...data.settings };
                    // Preserve the user's actively configured storage limit
                    if (currentLimit !== undefined) {
                        mergedSettings.storageLimitMB = currentLimit;
                    }
                    await this.controller.storageManager.saveSettings(mergedSettings);
                }

                let rulesToSave = [];
                const existingRulesObj = (await chrome.storage.local.get('siteRules')) || {};
                const existingRules = Array.isArray(existingRulesObj.siteRules)
                    ? existingRulesObj.siteRules
                    : [];
                rulesToSave = [...existingRules];

                const existingKeys = new Set(existingRules.map((r) => `${r.domain}|${r.type}`));

                if (data.siteRules) {
                    if (Array.isArray(data.siteRules.blocked)) {
                        for (const item of data.siteRules.blocked) {
                            const domain = typeof item === 'string' ? item : item.domain;
                            if (!domain) continue;
                            const key = `${domain}|BLOCKED`;
                            if (!existingKeys.has(key)) {
                                existingKeys.add(key);
                                rulesToSave.push({
                                    domain,
                                    type: 'BLOCKED',
                                    isEnabled: true,
                                    createdAt: Date.now(),
                                });
                            }
                        }
                    }
                    if (Array.isArray(data.siteRules.restricted)) {
                        for (const rule of data.siteRules.restricted) {
                            const domain = typeof rule === 'string' ? rule : rule.domain;
                            if (!domain) continue;
                            const key = `${domain}|RESTRICTED`;
                            if (!existingKeys.has(key)) {
                                existingKeys.add(key);
                                rulesToSave.push({
                                    domain,
                                    type: 'RESTRICTED',
                                    isEnabled: true,
                                    timeLimitMinutes: rule.timeLimitMinutes ?? 30,
                                    createdAt: Date.now(),
                                });
                            }
                        }
                    }
                } else if (Array.isArray(data.blockList)) {
                    for (const domain of data.blockList) {
                        const key = `${domain}|BLOCKED`;
                        if (!existingKeys.has(key)) {
                            existingKeys.add(key);
                            rulesToSave.push({
                                domain,
                                type: 'BLOCKED',
                                subdomainsIncluded: true,
                                isEnabled: true,
                                createdAt: Date.now(),
                            });
                        }
                    }
                }

                await chrome.storage.local.set({ siteRules: rulesToSave });

                if (Array.isArray(data.siteGroups)) {
                    const existingGroupsObj = (await chrome.storage.local.get('siteGroups')) || {};
                    const existingGroups = Array.isArray(existingGroupsObj.siteGroups)
                        ? existingGroupsObj.siteGroups
                        : [];
                    const existingGroupIds = new Set(existingGroups.map((g) => g.id));
                    const mergedGroups = [...existingGroups];

                    for (const g of data.siteGroups) {
                        if (g && g.id && !existingGroupIds.has(g.id)) {
                            existingGroupIds.add(g.id);
                            mergedGroups.push(g);
                        }
                    }
                    await chrome.storage.local.set({ siteGroups: mergedGroups });
                }
            } else {
                // Clear any lingering in-memory updates from background so old data isn't re-saved
                await chrome.runtime.sendMessage({ type: 'FLUSH_PENDING_UPDATES' }).catch(() => {});

                if (data.usage !== undefined) {
                    const usageResponse = await chrome.runtime.sendMessage({
                        type: 'IMPORT_USAGE',
                        usage: data.usage,
                        mode: 'replace',
                    });
                    if (!usageResponse || usageResponse.success !== true) {
                        throw new Error('Failed to import usage data');
                    }
                }
                if (data.settings !== undefined) {
                    await this.controller.storageManager.saveSettings(data.settings);
                }

                let rulesToSave = [];
                if (data.siteRules) {
                    if (Array.isArray(data.siteRules.blocked)) {
                        for (const item of data.siteRules.blocked) {
                            const domain = typeof item === 'string' ? item : item.domain;
                            if (!domain) continue;
                            rulesToSave.push({
                                domain,
                                type: 'BLOCKED',
                                isEnabled: true,
                                createdAt: Date.now(),
                            });
                        }
                    }
                    if (Array.isArray(data.siteRules.restricted)) {
                        for (const rule of data.siteRules.restricted) {
                            const domain = typeof rule === 'string' ? rule : rule.domain;
                            if (!domain) continue;
                            rulesToSave.push({
                                domain,
                                type: 'RESTRICTED',
                                isEnabled: true,
                                timeLimitMinutes: rule.timeLimitMinutes ?? 30,
                                createdAt: Date.now(),
                            });
                        }
                    }
                } else if (Array.isArray(data.blockList)) {
                    for (const domain of data.blockList) {
                        rulesToSave.push({
                            domain,
                            type: 'BLOCKED',
                            isEnabled: true,
                            createdAt: Date.now(),
                        });
                    }
                }

                await chrome.storage.local.set({
                    siteRules: rulesToSave,
                    siteGroups: Array.isArray(data.siteGroups) ? data.siteGroups : [],
                });
            }

            // Sync controller data and update all UI views
            this.controller.isDirty = false;
            await this.controller.loadAllData();
            this.controller.refreshUI();
            this.controller.showSuccess(
                chrome.i18n.getMessage(importMode === 'merge' ? 'dataAppended' : 'dataReplaced')
            );
        } catch (error) {
            console.error('Failed to import:', error);
            this.controller.showError(chrome.i18n.getMessage('failedImportData'));
        } finally {
            event.target.value = '';
        }
    }

    /**
     *
     */
    async resetSettings() {
        if (!confirm(chrome.i18n.getMessage('resetAllConfirm'))) return;

        try {
            await this.controller.storageManager.clearAllData();

            await this.controller.loadAllData();
            this.controller.refreshUI();
            this.controller.showSuccess(chrome.i18n.getMessage('settingsResetDefaults'));
        } catch (error) {
            console.error('Failed to reset settings:', error);
            this.controller.showError(chrome.i18n.getMessage('failedResetSettings'));
        }
    }
}
