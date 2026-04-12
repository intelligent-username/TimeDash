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
            badgeEnabled: 'badgeEnabled'
        });

        this.setupThemeToggle();

        // Color picker setup
        this.setupColorPicker('accentColorPicker', 'accentColor');
        this.setupColorPicker('overlayColorPicker', 'overlayColor');
    }

    setupThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        if (!themeToggle) return;

        themeToggle.addEventListener('change', () => {
            const theme = themeToggle.checked ? 'dark' : 'light';
            this.controller.updateSetting('theme', theme);
        });
    }

    setupColorPicker(pickerId, settingKey) {
        const picker = document.getElementById(pickerId);
        if (!picker) {
            console.log('[TimeDash] Color picker not found:', pickerId);
            return;
        }

        // Delegated click for all swatches (preset + custom)
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
                
                // If we deleted the active color, reset to default
                if (this.controller.settings[settingKey] === colorToDelete) {
                    this.controller.updateSetting(settingKey, 'blue');
                    this.populateColorPicker(pickerId, 'blue');
                }
                return;
            }

            const swatch = e.target.closest('.color-swatch');
            if (!swatch) return;

            console.log('[TimeDash] Color chosen:', swatch.dataset.color);
            
            // UI Update
            picker.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            
            const color = swatch.dataset.color;
            this.controller.updateSetting(settingKey, color);
        });

        // Add custom color
        const customInput = picker.querySelector('.custom-color-input');
        if (customInput) {
            customInput.addEventListener('change', () => {
                const color = customInput.value.toLowerCase();
                const customSettingKey = settingKey === 'accentColor' ? 'customAccentColors' : 'customOverlayColors';
                const currentCustoms = this.controller.settings[customSettingKey] || [];
                
                if (currentCustoms.length >= 5) {
                    console.warn('[TimeDash] Max 5 custom colors allowed');
                    return;
                }

                if (!currentCustoms.includes(color)) {
                    const updated = [...currentCustoms, color];
                    this.controller.updateSetting(customSettingKey, updated);
                    this.renderCustomColors(pickerId, updated, settingKey);
                }

                // Activate new color
                this.controller.updateSetting(settingKey, color);
                this.populateColorPicker(pickerId, color);
            });
        }
    }

    renderCustomColors(pickerId, colors, settingKey) {
        const wrapperId = pickerId === 'accentColorPicker' ? 'customAccentColors' : 'customOverlayColors';
        const wrapper = document.getElementById(wrapperId);
        if (!wrapper) return;

        const activeColor = this.controller.settings[settingKey];

        wrapper.innerHTML = colors.map(color => `
            <div class="custom-swatch">
                <button type="button" class="color-swatch ${color === activeColor ? 'active' : ''}" 
                    data-color="${color}" 
                    style="background: ${color};" 
                    title="${color}">
                </button>
                <div class="swatch-delete" title="Delete Color">×</div>
            </div>
        `).join('');

        // Hide "+" button if at cap
        const container = document.getElementById(pickerId);
        const addBtn = container.querySelector('.custom-color-container');
        if (addBtn) {
            addBtn.style.display = colors.length >= 5 ? 'none' : 'flex';
        }
    }

    setupVideo() {
        this.bindSettings({
            currentPlaybackSpeed: 'currentPlaybackSpeed',
            defaultPlaybackSpeed: 'defaultSpeed',
            maxPlaybackSpeed: 'maxSpeed',
            speedStep: 'speedStep'
        });

        const currentSpeedNum = document.getElementById('currentPlaybackSpeed');
        const currentSpeedSlider = document.getElementById('currentSpeedSlider');
        if (currentSpeedNum && currentSpeedSlider) {
            currentSpeedSlider.addEventListener('input', () => {
                currentSpeedNum.value = currentSpeedSlider.value;
                this.controller.updateSetting('currentPlaybackSpeed', parseFloat(currentSpeedSlider.value));
            });
            currentSpeedNum.addEventListener('input', () => {
                const rawValue = parseFloat(currentSpeedNum.value);
                if (isNaN(rawValue)) return;

                const maxAllowed = parseFloat((this.controller.settings && this.controller.settings.maxPlaybackSpeed) || currentSpeedSlider.max || 16);
                const clamped = Math.max(0.05, Math.min(maxAllowed, rawValue));

                currentSpeedNum.value = clamped;
                currentSpeedSlider.value = clamped;
                this.controller.updateSetting('currentPlaybackSpeed', clamped);
            });

            currentSpeedNum.addEventListener('change', () => {
                const rawValue = parseFloat(currentSpeedNum.value);
                if (isNaN(rawValue)) return;

                const maxAllowed = parseFloat((this.controller.settings && this.controller.settings.maxPlaybackSpeed) || currentSpeedSlider.max || 16);
                const clamped = Math.max(0.05, Math.min(maxAllowed, rawValue));

                currentSpeedNum.value = clamped;
                currentSpeedSlider.value = clamped;
                this.controller.updateSetting('currentPlaybackSpeed', clamped);
            });
        }

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
                // Sync current speed slider max
                if (currentSpeedSlider) {
                    currentSpeedSlider.max = value;
                }

                // Clamp current speed immediately if max lowered below it
                if (currentSpeedNum) {
                    const currentVal = parseFloat(currentSpeedNum.value);
                    if (!isNaN(currentVal) && !isNaN(value) && currentVal > value) {
                        currentSpeedNum.value = value;
                        if (currentSpeedSlider) currentSpeedSlider.value = value;
                        this.controller.updateSetting('currentPlaybackSpeed', value);
                    }
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
            autoPurgeDays: 'autoPurgeDays',
            storageLimitMB: 'storageLimitMB'
        });

        // Refresh storage usage display when limit changes
        const limitInput = document.getElementById('storageLimitMB');
        if (limitInput) {
            limitInput.addEventListener('input', () => {
                // Delay slightly so the setting saves first
                setTimeout(() => {
                    if (this.controller.dataManager && this.controller.dataManager.updateStorageUsage) {
                        this.controller.dataManager.updateStorageUsage();
                    }
                }, 100);
            });
        }

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
            badgeEnabled: 'badgeEnabled',
            currentPlaybackSpeed: 'currentPlaybackSpeed',
            defaultPlaybackSpeed: 'defaultSpeed',
            maxPlaybackSpeed: 'maxSpeed',
            speedStep: 'speedStep',
            incognitoTracking: 'incognitoTracking',
            trackingFrequency: 'trackingFrequency',
            autoPurgeEnabled: 'autoPurgeEnabled',
            autoPurgeDays: 'autoPurgeDays',
            storageLimitMB: 'storageLimitMB'
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
            if (settings.maxPlaybackSpeed !== undefined) {
                speedSlider.max = settings.maxPlaybackSpeed;
            }
            if (settings.currentPlaybackSpeed !== undefined) {
                speedSlider.value = settings.currentPlaybackSpeed;
            }
        }

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

        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const effectiveTheme = settings.theme === 'dark' ? 'dark' : 'light';
            themeToggle.checked = effectiveTheme === 'dark';
        }

        const autoPurgeParams = document.getElementById('autoPurgeSettings');
        if (autoPurgeParams) autoPurgeParams.style.display = settings.autoPurgeEnabled ? 'block' : 'none';

        this.renderWhitelist(settings.whitelist || []);

        // Color pickers
        this.renderCustomColors('accentColorPicker', settings.customAccentColors || [], 'accentColor');
        this.renderCustomColors('overlayColorPicker', settings.customOverlayColors || [], 'overlayColor');
        
        this.populateColorPicker('accentColorPicker', settings.accentColor || 'blue');
        this.populateColorPicker('overlayColorPicker', settings.overlayColor || 'blue');

        // Apply theme and accent to document
        console.log('[TimeDash] Initial load - theme:', settings.theme, 'accent:', settings.accentColor);
        document.documentElement.setAttribute('data-theme', settings.theme === 'dark' ? 'dark' : 'light');
        document.documentElement.setAttribute('data-accent', settings.accentColor || 'blue');
    }

    populateColorPicker(pickerId, value) {
        const picker = document.getElementById(pickerId);
        if (!picker) return;

        let foundMatch = false;
        picker.querySelectorAll('.color-swatch').forEach(swatch => {
            const isActive = swatch.dataset.color === value;
            swatch.classList.toggle('active', isActive);
            if (isActive) foundMatch = true;
        });

        const customContainer = picker.querySelector('.custom-color-container');
        const customInput = picker.querySelector('.custom-color-input');
        if (customContainer && customInput) {
            if (!foundMatch && value && value.startsWith('#')) {
                customContainer.classList.add('active');
                customContainer.style.background = value;
                customInput.value = value;
            } else {
                customContainer.classList.remove('active');
                customContainer.style.background = '';
            }
        }
    }
}
