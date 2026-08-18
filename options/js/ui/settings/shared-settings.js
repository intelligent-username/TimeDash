export const sharedSettingsMethods = {
    setupAnalytics() {
        this.bindSettings({ trackingFrequency: 'trackingFrequency' });
    },

    bindSettings(mapping) {
        Object.entries(mapping).forEach(([key, elementId]) => {
            const element = document.getElementById(elementId);
            if (!element) return;

            const eventType =
                element.type === 'checkbox' || element.tagName === 'SELECT' ? 'change' : 'input';
            element.addEventListener(eventType, () => {
                let val;
                if (element.type === 'checkbox') val = element.checked;
                else if (element.type === 'number') val = parseFloat(element.value);
                else val = element.value;
                this.controller.updateSetting(key, val);
            });
        });
    },

    renderCustomColors(pickerId, colors, settingKey) {
        const wrapperId =
            pickerId === 'accentColorPicker' ? 'customAccentColors' : 'customOverlayColors';
        const wrapper = document.getElementById(wrapperId);
        if (!wrapper) return;

        const activeColor = this.controller.settings[settingKey];
        wrapper.innerHTML = colors
            .map(
                (color) => `
            <div class="custom-swatch">
                <button type="button" class="color-swatch ${color === activeColor ? 'active' : ''}" data-color="${color}" style="background: ${color};" title="${color}"></button>
                <div class="swatch-delete" title="${chrome.i18n.getMessage('deleteColor')}">×</div>
            </div>
        `
            )
            .join('');

        const container = document.getElementById(pickerId);
        const addBtn = container ? container.querySelector('.custom-color-container') : null;
        if (addBtn) addBtn.style.display = colors.length >= 5 ? 'none' : 'flex';
    },

    populateColorPicker(pickerId, value) {
        const picker = document.getElementById(pickerId);
        if (!picker) return;

        let foundMatch = false;
        picker.querySelectorAll('.color-swatch').forEach((swatch) => {
            const isActive = swatch.dataset.color === value;
            swatch.classList.toggle('active', isActive);
            if (isActive) foundMatch = true;
        });

        const customContainer = picker.querySelector('.custom-color-container');
        const customInput = picker.querySelector('.custom-color-input');
        if (!customContainer || !customInput) return;

        if (!foundMatch && value && value.startsWith('#')) {
            customContainer.classList.add('active');
            customContainer.style.background = value;
            customInput.value = value;
        } else {
            customContainer.classList.remove('active');
            customContainer.style.background = '';
        }
    },

    populateAll(settings) {
        const mapping = {
            trackingEnabled: 'trackingEnabled',
            dailyTimeLimitMinutes: 'dailyLimit',
            restrictedSliderMax: 'restrictedSliderMax',
            notificationsEnabled: 'notificationsEnabled',
            quotaWarnings: 'quotaWarnings',
            badgeEnabled: 'badgeEnabled',
            animationsEnabled: 'animationsEnabled',
            currentPlaybackSpeed: 'currentPlaybackSpeed',
            defaultPlaybackSpeed: 'defaultSpeed',
            maxPlaybackSpeed: 'maxSpeed',
            speedStep: 'speedStep',
            controllerSkipPace: 'controllerSkipPace',
            incognitoTracking: 'incognitoTracking',
            trackingFrequency: 'trackingFrequency',
            autoPurgeEnabled: 'autoPurgeEnabled',
            autoPurgeDays: 'autoPurgeDays',
            storageLimitMB: 'storageLimitMB',
        };

        Object.entries(mapping).forEach(([key, id]) => {
            const val = settings[key];
            const el = document.getElementById(id);
            if (!el) return;
            if (el.type === 'checkbox') el.checked = Boolean(val);
            else el.value = val !== undefined ? val : '';
        });

        const speedSlider = document.getElementById('currentSpeedSlider');
        if (speedSlider) {
            if (settings.maxPlaybackSpeed !== undefined)
                speedSlider.max = settings.maxPlaybackSpeed;
            if (settings.currentPlaybackSpeed !== undefined)
                speedSlider.value = settings.currentPlaybackSpeed;
        }

        const controllerSkipPace = document.getElementById('controllerSkipPace');
        if (
            controllerSkipPace &&
            (!Number.isFinite(settings.controllerSkipPace) || settings.controllerSkipPace <= 0)
        ) {
            controllerSkipPace.value = 10;
        }

        const incKey = document.getElementById('increaseSpeedKey');
        if (incKey) incKey.value = settings.increaseSpeedKey || 'Plus';
        const decKey = document.getElementById('decreaseSpeedKey');
        if (decKey) decKey.value = settings.decreaseSpeedKey || 'Minus';
        const resKey = document.getElementById('resetSpeedKey');
        if (resKey) resKey.value = settings.resetSpeedKey || 'Period';

        const helpShortcuts = document.getElementById('helpCurrentShortcuts');
        if (helpShortcuts) {
            const formatKey = (k) => {
                if (k === 'Plus') return '+';
                if (k === 'Minus') return '-';
                if (k === 'Period') return '.';
                return k;
            };
            const inc = formatKey(settings.increaseSpeedKey || 'Plus');
            const dec = formatKey(settings.decreaseSpeedKey || 'Minus');
            const res = formatKey(settings.resetSpeedKey || 'Period');
            helpShortcuts.innerHTML = `<code>${inc}</code> / <code>${dec}</code>, and <code>${res}</code>`;
        }

        const paused = document.getElementById('trackingPaused');
        if (paused) paused.checked = !settings.trackingEnabled;

        const autoPurgeParams = document.getElementById('autoPurgeSettings');
        if (autoPurgeParams)
            autoPurgeParams.classList.toggle('visible', Boolean(settings.autoPurgeEnabled));

        this.renderWhitelist(settings.whitelist || []);
        this.renderCustomColors(
            'accentColorPicker',
            settings.customAccentColors || [],
            'accentColor'
        );
        this.renderCustomColors(
            'overlayColorPicker',
            settings.customOverlayColors || [],
            'overlayColor'
        );
        this.populateColorPicker('accentColorPicker', settings.accentColor || 'blue');
        this.populateColorPicker('overlayColorPicker', settings.overlayColor || 'blue');

        // Theme and accent application are centralized in OptionsController.applyImmediateChanges
    },
};
