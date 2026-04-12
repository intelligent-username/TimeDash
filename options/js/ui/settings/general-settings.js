export const generalSettingsMethods = {
    setupGeneral() {
        this.bindSettings({
            trackingEnabled: 'trackingEnabled',
            dailyTimeLimitMinutes: 'dailyLimit',
            notificationsEnabled: 'notificationsEnabled',
            quotaWarnings: 'quotaWarnings',
            badgeEnabled: 'badgeEnabled'
        });

        this.setupThemeToggle();
        this.setupColorPicker('accentColorPicker', 'accentColor');
        this.setupColorPicker('overlayColorPicker', 'overlayColor');
    },

    setupThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        if (!themeToggle) return;

        themeToggle.addEventListener('change', () => {
            this.controller.updateSetting('theme', themeToggle.checked ? 'dark' : 'light');
        });
    },

    setupColorPicker(pickerId, settingKey) {
        const picker = document.getElementById(pickerId);
        if (!picker) return;

        picker.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.swatch-delete');
            if (deleteBtn) {
                e.stopPropagation();
                const customSwatch = deleteBtn.closest('.custom-swatch');
                const swatch = customSwatch ? customSwatch.querySelector('.color-swatch') : null;
                if (!swatch) return;

                const colorToDelete = swatch.dataset.color;
                const customSettingKey = settingKey === 'accentColor' ? 'customAccentColors' : 'customOverlayColors';
                const currentCustoms = this.controller.settings[customSettingKey] || [];
                const updated = currentCustoms.filter(c => c !== colorToDelete);

                this.controller.updateSetting(customSettingKey, updated);
                this.renderCustomColors(pickerId, updated, settingKey);

                if (this.controller.settings[settingKey] === colorToDelete) {
                    this.controller.updateSetting(settingKey, 'blue');
                    this.populateColorPicker(pickerId, 'blue');
                }
                return;
            }

            const swatch = e.target.closest('.color-swatch');
            if (!swatch) return;

            picker.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            this.controller.updateSetting(settingKey, swatch.dataset.color);
        });

        const customInput = picker.querySelector('.custom-color-input');
        if (customInput) {
            customInput.addEventListener('change', () => {
                const color = customInput.value.toLowerCase();
                const customSettingKey = settingKey === 'accentColor' ? 'customAccentColors' : 'customOverlayColors';
                const currentCustoms = this.controller.settings[customSettingKey] || [];

                if (currentCustoms.length >= 5) return;

                if (!currentCustoms.includes(color)) {
                    const updated = [...currentCustoms, color];
                    this.controller.updateSetting(customSettingKey, updated);
                    this.renderCustomColors(pickerId, updated, settingKey);
                }

                this.controller.updateSetting(settingKey, color);
                this.populateColorPicker(pickerId, color);
            });
        }
    }
};
