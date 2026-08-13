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
            await chrome.runtime.sendMessage({ type: 'FLUSH_PENDING_UPDATES' }).catch(() => {});
            await this.controller.storageManager.compactStorage();
            await this.controller.loadAllData();
            this.controller.refreshUI();
            this.updateStorageUsage();
            this.controller.showSuccess('Storage compacted successfully');
        } catch (error) {
            console.error('Failed to compact storage:', error);
            this.controller.showError('Failed to compact storage');
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
                            <button class="rule-delete-btn" data-delete-domain="${d}">Delete</button>
                        </div>
                    `
                        )
                        .join('');
                } else {
                    resultsDiv.style.display = 'block';
                    resultsDiv.innerHTML =
                        '<div style="padding: 8px; color: var(--text-secondary);">No matches found</div>';
                }
            });

            resultsDiv.addEventListener('click', async (e) => {
                if (e.target.classList.contains('rule-delete-btn')) {
                    const domain = e.target.dataset.deleteDomain;
                    if (confirm(`Delete all data for ${domain}?`)) {
                        delete this.controller.usage[domain];
                        // Save directly via chrome.storage as StorageManager.saveUsage might be missing/generic
                        await chrome.storage.local.set({ usage: this.controller.usage });

                        this.controller.showSuccess(`Deleted data for ${domain}`);
                        this.controller.refreshUI();
                        this.updateStorageUsage();
                        searchInput.dispatchEvent(new Event('input')); // Refresh list
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
        if (quotaEl) quotaEl.textContent = `${percentStr} of ${limitMB}MB limit`;

        // Show or hide the warning banner
        const warningEl = document.getElementById('storageLimitWarning');
        const warningDetailEl = document.getElementById('storageLimitWarningDetail');
        if (warningEl) {
            warningEl.style.display = exceeded ? 'flex' : 'none';
        }
        if (warningDetailEl && exceeded) {
            warningDetailEl.textContent = `Using ${usageText} of your ${limitMB}MB limit. Consider purging old data or increasing your limit.`;
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
            a.href = url;
            a.download = `TDE_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);

            this.controller.showSuccess('Data exported successfully');
        } catch (error) {
            console.error('Failed to export data:', error);
            this.controller.showError('Failed to export data');
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
                    'Should the imported data be appended to the currently-existing data or replace it?\n\nClick OK to Append.\nClick Cancel to Replace.'
                );
                resolve(choice ? 'merge' : 'overwrite');
                return;
            }

            title.textContent = 'Import Data';
            msg.textContent =
                'Should the imported data be appended to the currently-existing data or replace it?';

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

    mergeUsage(existingUsage, importedUsage) {
        const merged = JSON.parse(JSON.stringify(existingUsage || {}));
        if (!importedUsage) return merged;

        for (const [domain, impData] of Object.entries(importedUsage)) {
            if (!merged[domain]) {
                merged[domain] = JSON.parse(JSON.stringify(impData));
                continue;
            }
            const cur = merged[domain];

            for (const [k, v] of Object.entries(impData)) {
                if (typeof v === 'number') {
                    if (/^\d{4}-\d{2}-\d{2}$/.test(k)) {
                        cur[k] = (cur[k] || 0) + v;
                    } else if (/^\d{4}-\d{2}-\d{2}_general$/.test(k)) {
                        cur[k] = (cur[k] || 0) + v;
                    } else if (/^\d{4}-\d{2}-\d{2}_restricted$/.test(k)) {
                        cur[k] = (cur[k] || 0) + v;
                    } else if (/^\d{4}-\d{2}-\d{2}_blocked$/.test(k)) {
                        cur[k] = (cur[k] || 0) + v;
                    } else if (k === 'blockedToday') {
                        cur[k] = (cur[k] || 0) + v;
                    }
                } else if (!(k in cur)) {
                    cur[k] = v;
                }
            }

            // Recalculate cumulative totals accurately from daily timestamps
            let totalGeneral = 0;
            let totalRestricted = 0;
            for (const [k, v] of Object.entries(cur)) {
                if (typeof v === 'number') {
                    if (/^\d{4}-\d{2}-\d{2}_general$/.test(k)) totalGeneral += v;
                    else if (/^\d{4}-\d{2}-\d{2}_restricted$/.test(k)) totalRestricted += v;
                }
            }

            if (totalGeneral > 0 || totalRestricted > 0) {
                cur.cumulative_general = totalGeneral;
                cur.cumulative_restricted = totalRestricted;
                cur.cumulative = totalGeneral + totalRestricted;
            } else {
                let dailySum = 0;
                for (const [k, v] of Object.entries(cur)) {
                    if (typeof v === 'number' && /^\d{4}-\d{2}-\d{2}$/.test(k)) {
                        dailySum += v;
                    }
                }
                cur.cumulative = dailySum;
            }
        }
        return merged;
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
                if (data.usage) {
                    const existingUsage = (await chrome.storage.local.get('usage')).usage || {};
                    const mergedUsage = this.mergeUsage(existingUsage, data.usage);
                    await chrome.storage.local.set({ usage: mergedUsage });
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
                    await chrome.storage.local.set({ usage: data.usage || {} });
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
                `Data ${importMode === 'merge' ? 'appended' : 'replaced'} successfully`
            );
        } catch (error) {
            console.error('Failed to import:', error);
            this.controller.showError('Failed to import data');
        } finally {
            event.target.value = '';
        }
    }

    /**
     *
     */
    async resetSettings() {
        if (!confirm('Reset ALL settings and data? This cannot be undone.')) return;

        try {
            await this.controller.storageManager.clearAllData();

            await this.controller.loadAllData();
            this.controller.refreshUI();
            this.controller.showSuccess('Settings reset to defaults');
        } catch (error) {
            console.error('Failed to reset settings:', error);
            this.controller.showError('Failed to reset settings');
        }
    }
}
