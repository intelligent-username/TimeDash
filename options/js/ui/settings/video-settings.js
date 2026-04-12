export const videoSettingsMethods = {
    setupVideo() {
        this.bindSettings({
            currentPlaybackSpeed: 'currentPlaybackSpeed',
            defaultPlaybackSpeed: 'defaultSpeed',
            maxPlaybackSpeed: 'maxSpeed',
            speedStep: 'speedStep',
            controllerSkipPace: 'controllerSkipPace'
        });

        const currentSpeedNum = document.getElementById('currentPlaybackSpeed');
        const currentSpeedSlider = document.getElementById('currentSpeedSlider');

        if (currentSpeedNum && currentSpeedSlider) {
            currentSpeedSlider.addEventListener('input', () => {
                currentSpeedNum.value = currentSpeedSlider.value;
                this.controller.updateSetting('currentPlaybackSpeed', parseFloat(currentSpeedSlider.value));
            });

            const syncCurrentSpeed = () => {
                const rawValue = parseFloat(currentSpeedNum.value);
                if (isNaN(rawValue)) return;

                const maxAllowed = parseFloat((this.controller.settings && this.controller.settings.maxPlaybackSpeed) || currentSpeedSlider.max || 16);
                const clamped = Math.max(0.05, Math.min(maxAllowed, rawValue));
                currentSpeedNum.value = clamped;
                currentSpeedSlider.value = clamped;
                this.controller.updateSetting('currentPlaybackSpeed', clamped);
            };

            currentSpeedNum.addEventListener('input', syncCurrentSpeed);
            currentSpeedNum.addEventListener('change', syncCurrentSpeed);
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

                if (currentSpeedSlider) currentSpeedSlider.max = value;

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
    },

    setupKeyRecording() {
        const keyInputs = [
            { id: 'increaseSpeedKey', key: 'increaseSpeedKey' },
            { id: 'decreaseSpeedKey', key: 'decreaseSpeedKey' },
            { id: 'resetSpeedKey', key: 'resetSpeedKey' }
        ];

        const normalizationMap = {
            NumpadSubtract: 'Minus',
            Minus: 'Minus',
            NumpadAdd: 'Plus',
            Equal: 'Plus',
            NumpadEnter: 'Enter',
            Enter: 'Enter',
            NumpadDecimal: 'Period',
            NumpadComma: 'Period',
            Period: 'Period',
            NumpadMultiply: 'Asterisk',
            NumpadDivide: 'Slash',
            Slash: 'Slash',
            NumpadEqual: 'Equal'
        };

        for (let i = 0; i <= 9; i++) {
            normalizationMap[`Numpad${i}`] = `${i}`;
            normalizationMap[`Digit${i}`] = `${i}`;
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
                    if (normalizationMap[code]) code = normalizationMap[code];

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
};
