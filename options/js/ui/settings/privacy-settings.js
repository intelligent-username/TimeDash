export const privacySettingsMethods = {
    setupPrivacy() {
        this.bindSettings({
            incognitoTracking: 'incognitoTracking',
            autoPurgeEnabled: 'autoPurgeEnabled',
            autoPurgeDays: 'autoPurgeDays',
            storageLimitMB: 'storageLimitMB'
        });

        const limitInput = document.getElementById('storageLimitMB');
        if (limitInput) {
            limitInput.addEventListener('input', () => {
                setTimeout(() => {
                    if (this.controller.dataManager && this.controller.dataManager.updateStorageUsage) {
                        this.controller.dataManager.updateStorageUsage();
                    }
                }, 100);
            });
        }

        const pausedCheckbox = document.getElementById('trackingPaused');
        const mainCheckbox = document.getElementById('trackingEnabled');
        if (pausedCheckbox) {
            pausedCheckbox.addEventListener('change', () => {
                const enabled = !pausedCheckbox.checked;
                this.controller.updateSetting('trackingEnabled', enabled);
                if (mainCheckbox) mainCheckbox.checked = enabled;
            });

            if (mainCheckbox) {
                mainCheckbox.addEventListener('change', () => {
                    pausedCheckbox.checked = !mainCheckbox.checked;
                });
            }
        }

        const autoPurgeCheck = document.getElementById('autoPurgeEnabled');
        const autoPurgeParams = document.getElementById('autoPurgeSettings');
        if (autoPurgeCheck && autoPurgeParams) {
            autoPurgeCheck.addEventListener('change', () => {
                autoPurgeParams.style.display = autoPurgeCheck.checked ? 'block' : 'none';
            });
        }

        const addBtn = document.getElementById('addWhitelistBtn');
        const input = document.getElementById('whitelistInput');
        const list = document.getElementById('whitelistList');

        if (addBtn && input && list) {
            addBtn.addEventListener('click', () => {
                const domain = input.value.trim().toLowerCase();
                if (!domain) return;

                const whitelist = this.controller.settings.whitelist || [];
                if (!whitelist.includes(domain)) {
                    const newWhitelist = [...whitelist, domain];
                    this.controller.updateSetting('whitelist', newWhitelist);
                    this.renderWhitelist(newWhitelist);
                }
                input.value = '';
            });

            list.addEventListener('click', (e) => {
                if (!e.target.classList.contains('rule-delete-btn')) return;
                const domain = e.target.dataset.domain;
                const newWhitelist = (this.controller.settings.whitelist || []).filter(d => d !== domain);
                this.controller.updateSetting('whitelist', newWhitelist);
                this.renderWhitelist(newWhitelist);
            });
        }
    },

    renderWhitelist(whitelist) {
        const list = document.getElementById('whitelistList');
        if (!list) return;

        list.innerHTML = whitelist.map(domain => `
            <li class="rule-item">
                <span class="rule-domain">${domain}</span>
                <button class="rule-delete-btn" data-domain="${domain}">Remove</button>
            </li>
        `).join('');
    }
};
