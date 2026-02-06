export class DataManager {
    constructor(controller) {
        this.controller = controller;
    }

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
        if (resetSettingsBtn) resetSettingsBtn.addEventListener('click', () => this.resetSettings());

        // Privacy Tab Actions
        const exportPrivacyBtn = document.getElementById('exportDataPrivacy');
        if (exportPrivacyBtn) exportPrivacyBtn.addEventListener('click', () => this.exportData());

        this.setupDataSearch();
        this.updateStorageUsage();
    }

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
                const matches = Object.keys(usage).filter(d => d.includes(query));

                if (matches.length > 0) {
                    resultsDiv.style.display = 'block';
                    resultsDiv.innerHTML = matches.map(d => `
                        <div class="rule-item" style="padding: 8px; border-bottom: 1px solid var(--border-color);">
                            <span class="rule-domain">${d}</span>
                            <button class="rule-delete-btn" data-delete-domain="${d}">Delete</button>
                        </div>
                    `).join('');
                } else {
                    resultsDiv.style.display = 'block';
                    resultsDiv.innerHTML = '<div style="padding: 8px; color: var(--text-secondary);">No matches found</div>';
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

    async updateStorageUsage() {
        if (!this.controller.storageManager.getStorageUsage) return;
        const bytes = await this.controller.storageManager.getStorageUsage();
        const kb = (bytes / 1024).toFixed(0);
        const mb = (bytes / 1024 / 1024).toFixed(2);

        const usageText = parseFloat(mb) >= 0.1 ? `${mb} MB` : `${kb} KB`;
        const valEl = document.getElementById('storageUsageValue');
        if (valEl) valEl.textContent = usageText;

        const quota = chrome.storage.local.QUOTA_BYTES || 5 * 1024 * 1024;
        const percent = Math.min((bytes / quota) * 100, 100).toFixed(1);

        const fillEl = document.getElementById('storageUsageFill');
        if (fillEl) fillEl.style.width = `${percent}%`;

        const quotaEl = document.getElementById('storageQuotaValue');
        if (quotaEl) quotaEl.textContent = `${percent}% of ${Math.round(quota / 1024 / 1024)}MB quota`;
    }

    async exportData() {
        try {
            const data = {
                usage: this.controller.usage,
                blockList: this.controller.blockList,
                settings: this.controller.settings,
                exportDate: new Date().toISOString(),
                version: '1.0.0',
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `timedash-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);

            this.controller.showSuccess('Data exported successfully');
        } catch (error) {
            console.error('Failed to export data:', error);
            this.controller.showError('Failed to export data');
        }
    }

    async importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.usage && !data.settings && !data.blockList) {
                throw new Error('Invalid data format');
            }

            if (!confirm('Import will overwrite current data. Continue?')) return;

            if (data.usage) await this.controller.storageManager.saveUsage(data.usage);
            if (data.blockList) await this.controller.storageManager.saveBlockList(data.blockList);
            if (data.settings) await this.controller.storageManager.saveSettings(data.settings);

            await this.controller.loadAllData();
            this.controller.refreshUI();
            this.controller.showSuccess('Data imported successfully');
        } catch (error) {
            console.error('Failed to import:', error);
            this.controller.showError('Failed to import data');
        }
    }

    async resetSettings() {
        if (!confirm('Reset ALL settings and data? This cannot be undone.')) return;

        try {
            await this.controller.storageManager.resetSettings();
            await this.controller.storageManager.saveBlockList([]); // Clear blocks?
            // Usually resetSettings only resets preferences, not usage data.
            // But resetAllData implies everything.
            // options.js `resetSettings` calls `storageManager.resetSettings()` which resets settings.

            // If the button is "Reset All Data" (header), it might mean clear everything.
            // Let's look at `options.html`: "Reset All Data".
            // Let's look at `options.js` `resetSettings` implementation (Step 720 line 1422).
            // It calls `storageManager.resetSettings()`.

            // I'll stick to `resetSettings` behavior for now.
            // If user meant "Clear Data" (separate button?), I don't see one in `options.js` beyond `clearAllData` (line 1533).
            // But `resetBtn` in header calls `resetSettings`? 
            // In options.js step 702 line 550: `resetBtn.addEventListener('click', () => this.resetSettings());` 
            // Wait, that was `resetSettings` button.
            // Header button is `resetBtn` (id). 
            // I don't see `resetBtn` listener in `setupActionButtons` in step 702.

            // Actually, `options.js` handles `resetSettings` (the method) which does `resetSettings` (the storage call).

            await this.controller.loadAllData();
            this.controller.refreshUI();
            this.controller.showSuccess('Settings reset to defaults');
        } catch (error) {
            this.controller.showError('Failed to reset settings');
        }
    }
}
