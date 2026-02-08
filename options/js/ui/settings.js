export class SettingsManager {
    constructor(controller) {
        this.controller = controller;
    }

    setup() {
        this.setupGeneral();
        this.setupVideo();
        this.setupPrivacy();
        this.setupAnalytics();
    }

    setupGeneral() {
        this.bindSettings({
            trackingEnabled: 'trackingEnabled',
            dailyTimeLimitMinutes: 'dailyLimit',
            notificationsEnabled: 'notificationsEnabled',
            quotaWarnings: 'quotaWarnings',
            theme: 'theme',
            badgeEnabled: 'badgeEnabled'
        });

        // Color picker setup
        this.setupColorPicker('accentColorPicker', 'accentColor');
        this.setupColorPicker('overlayColorPicker', 'overlayColor');
    }

    setupColorPicker(pickerId, settingKey) {
        const picker = document.getElementById(pickerId);
        if (!picker) {
            console.log('[TimeDash] Color picker not found:', pickerId);
            return;
        }

        picker.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                console.log('[TimeDash] Color swatch clicked:', swatch.dataset.color);
                // Remove active from all
                picker.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                // Add active to clicked
                swatch.classList.add('active');
                // Update setting
                const color = swatch.dataset.color;
                this.controller.updateSetting(settingKey, color);
            });
        });
    }

    setupVideo() {
        this.bindSettings({
            defaultPlaybackSpeed: 'defaultSpeed',
            maxPlaybackSpeed: 'maxSpeed',
            speedStep: 'speedStep'
        });

        const defaultSpeed = document.getElementById('defaultSpeed');
        const maxSpeed = document.getElementById('maxSpeed');

        if (defaultSpeed && maxSpeed) {
            defaultSpeed.addEventListener('input', () => {
                const value = parseFloat(defaultSpeed.value);
                const max = parseFloat(maxSpeed.value);
                if (!isNaN(value) && !isNaN(max) && value > max) {
                    maxSpeed.value = value;
                    this.controller.updateSetting('maxPlaybackSpeed', value);
                }
            });

            maxSpeed.addEventListener('input', () => {
                const value = parseFloat(maxSpeed.value);
                const defaultVal = parseFloat(defaultSpeed.value);
                if (!isNaN(value) && !isNaN(defaultVal) && value < defaultVal) {
                    defaultSpeed.value = value;
                    this.controller.updateSetting('defaultPlaybackSpeed', value);
                }
            });
        }

        this.setupKeyRecording();
    }

    setupKeyRecording() {
        const keyInputs = [
            { id: 'increaseSpeedKey', key: 'increaseSpeedKey' },
            { id: 'decreaseSpeedKey', key: 'decreaseSpeedKey' },
            { id: 'resetSpeedKey', key: 'resetSpeedKey' }
        ];

        const normalizationMap = {
            'NumpadSubtract': 'Minus',
            'Minus': 'Minus',
            'NumpadAdd': 'Plus',
            'Equal': 'Plus',
            'NumpadEnter': 'Enter',
            'Enter': 'Enter',
            'NumpadDecimal': 'Period',
            'NumpadComma': 'Period',
            'Period': 'Period',
            'NumpadMultiply': 'Asterisk',
            'NumpadDivide': 'Slash',
            'Slash': 'Slash',
            'NumpadEqual': 'Equal'
        };
        for (let i = 0; i <= 9; i++) {
            normalizationMap[`Numpad${i}`] = '' + i;
            normalizationMap[`Digit${i}`] = '' + i;
        }

        keyInputs.forEach(({ id, key }) => {
            const el = document.getElementById(id);
            if (!el) return;

            el.addEventListener('click', () => {
                el.value = 'Press any key...';
                el.classList.add('recording');

                const handler = (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

                    let code = e.code;
                    if (normalizationMap[code]) {
                        code = normalizationMap[code];
                    }

                    el.value = code;
                    el.classList.remove('recording');
                    this.controller.updateSetting(key, code);

                    document.removeEventListener('keydown', handler, true);
                    document.removeEventListener('click', cancelHandler);
                };

                const cancelHandler = (e) => {
                    if (e.target !== el) {
                        document.removeEventListener('keydown', handler, true);
                        document.removeEventListener('click', cancelHandler);
                        el.classList.remove('recording');
                        if (el.value === 'Press any key...') {
                            const current = this.controller.settings[key];
                            let defaultKey = 'Plus';
                            if (key === 'decreaseSpeedKey') defaultKey = 'Minus';
                            if (key === 'resetSpeedKey') defaultKey = 'Period';
                            el.value = current || defaultKey;
                        }
                    }
                };

                document.addEventListener('keydown', handler, true);
                setTimeout(() => document.addEventListener('click', cancelHandler), 0);
            });
        });
    }

    setupPrivacy() {
        this.bindSettings({
            incognitoTracking: 'incognitoTracking',
            autoPurgeEnabled: 'autoPurgeEnabled',
            autoPurgeDays: 'autoPurgeDays'
        });

        // Tracking Paused logic (inverse)
        const pausedCheckbox = document.getElementById('trackingPaused');
        const mainCheckbox = document.getElementById('trackingEnabled');
        if (pausedCheckbox) {
            pausedCheckbox.addEventListener('change', () => {
                const enabled = !pausedCheckbox.checked;
                this.controller.updateSetting('trackingEnabled', enabled);
                if (mainCheckbox) mainCheckbox.checked = enabled;
            });
            // Sync main checkbox to paused
            if (mainCheckbox) {
                mainCheckbox.addEventListener('change', () => {
                    pausedCheckbox.checked = !mainCheckbox.checked;
                });
            }
        }

        // Auto purge visibility
        const autoPurgeCheck = document.getElementById('autoPurgeEnabled');
        const autoPurgeParams = document.getElementById('autoPurgeSettings');
        if (autoPurgeCheck && autoPurgeParams) {
            autoPurgeCheck.addEventListener('change', () => {
                autoPurgeParams.style.display = autoPurgeCheck.checked ? 'block' : 'none';
            });
        }

        // Whitelist UI
        const addBtn = document.getElementById('addWhitelistBtn');
        const input = document.getElementById('whitelistInput');
        const list = document.getElementById('whitelistList');

        if (addBtn && input && list) {
            addBtn.addEventListener('click', () => {
                const domain = input.value.trim().toLowerCase();
                if (domain) {
                    const whitelist = this.controller.settings.whitelist || [];
                    if (!whitelist.includes(domain)) {
                        const newWhitelist = [...whitelist, domain];
                        this.controller.updateSetting('whitelist', newWhitelist);
                        this.renderWhitelist(newWhitelist);
                    }
                    input.value = '';
                }
            });

            list.addEventListener('click', (e) => {
                if (e.target.classList.contains('rule-delete-btn')) {
                    const domain = e.target.dataset.domain;
                    const newWhitelist = (this.controller.settings.whitelist || []).filter(d => d !== domain);
                    this.controller.updateSetting('whitelist', newWhitelist);
                    this.renderWhitelist(newWhitelist);
                }
            });
        }
    }

    renderWhitelist(whitelist) {
        const list = document.getElementById('whitelistList');
        if (list) {
            list.innerHTML = whitelist.map(domain => `
                <li class="rule-item">
                    <span class="rule-domain">${domain}</span>
                    <button class="rule-delete-btn" data-domain="${domain}">Remove</button>
                </li>
            `).join('');
        }
    }

    setupAnalytics() {
        this.bindSettings({
            trackingFrequency: 'trackingFrequency'
        });
    }

    bindSettings(mapping) {
        Object.entries(mapping).forEach(([key, elementId]) => {
            const element = document.getElementById(elementId);
            if (!element) return;

            const eventType = (element.type === 'checkbox' || element.tagName === 'SELECT') ? 'change' : 'input';
            element.addEventListener(eventType, () => {
                let val;
                if (element.type === 'checkbox') val = element.checked;
                else if (element.type === 'number') val = parseFloat(element.value);
                else val = element.value;

                this.controller.updateSetting(key, val);
            });
        });
    }

    populateAll(settings) {
        const mapping = {
            trackingEnabled: 'trackingEnabled',
            dailyTimeLimitMinutes: 'dailyLimit',
            notificationsEnabled: 'notificationsEnabled',
            quotaWarnings: 'quotaWarnings',
            theme: 'theme',
            badgeEnabled: 'badgeEnabled',
            defaultPlaybackSpeed: 'defaultSpeed',
            maxPlaybackSpeed: 'maxSpeed',
            speedStep: 'speedStep',
            incognitoTracking: 'incognitoTracking',
            trackingFrequency: 'trackingFrequency',
            autoPurgeEnabled: 'autoPurgeEnabled',
            autoPurgeDays: 'autoPurgeDays'
        };

        Object.entries(mapping).forEach(([key, id]) => {
            const val = settings[key];
            const el = document.getElementById(id);
            if (!el) return;
            if (el.type === 'checkbox') el.checked = Boolean(val);
            else el.value = val !== undefined ? val : '';
        });

        // Keys
        const incKey = document.getElementById('increaseSpeedKey');
        if (incKey) incKey.value = settings.increaseSpeedKey || 'Plus';
        const decKey = document.getElementById('decreaseSpeedKey');
        if (decKey) decKey.value = settings.decreaseSpeedKey || 'Minus';
        const resKey = document.getElementById('resetSpeedKey');
        if (resKey) resKey.value = settings.resetSpeedKey || 'Period';

        // Privacy specific
        const paused = document.getElementById('trackingPaused');
        if (paused) paused.checked = !settings.trackingEnabled;

        const autoPurgeParams = document.getElementById('autoPurgeSettings');
        if (autoPurgeParams) autoPurgeParams.style.display = settings.autoPurgeEnabled ? 'block' : 'none';

        this.renderWhitelist(settings.whitelist || []);

        // Color pickers
        this.populateColorPicker('accentColorPicker', settings.accentColor || 'blue');
        this.populateColorPicker('overlayColorPicker', settings.overlayColor || 'blue');

        // Apply theme and accent to document
        console.log('[TimeDash] Initial load - theme:', settings.theme, 'accent:', settings.accentColor);
        document.documentElement.setAttribute('data-theme', settings.theme || 'auto');
        document.documentElement.setAttribute('data-accent', settings.accentColor || 'blue');
    }

    populateColorPicker(pickerId, value) {
        const picker = document.getElementById(pickerId);
        if (!picker) return;
        picker.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.classList.toggle('active', swatch.dataset.color === value);
        });
    }
}
