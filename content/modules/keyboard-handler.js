/**
 * Keyboard Handler - content/modules/keyboard-handler.js
 * Manages keyboard shortcut detection and processing
 * ~140 lines
 */

class KeyboardHandler {
    constructor(instance) {
        this.instance = instance;
    }

    setup() {
        document.addEventListener('keydown', (event) => {
            if (this.instance.isOrphaned) return;
            if (this.isInputFocused()) return;

            if (!this.instance.settings.keyboardShortcutsEnabled) return;

            const increaseKey = this.instance.settings.increaseSpeedKey || 'Plus';
            const decreaseKey = this.instance.settings.decreaseSpeedKey || 'Minus';
            const resetKey = this.instance.settings.resetSpeedKey || 'Period';

            const increaseKeys = this.getAliases(increaseKey);
            const decreaseKeys = this.getAliases(decreaseKey);
            const resetKeys = this.getAliases(resetKey);

            if (!event.ctrlKey && !event.altKey && !event.metaKey) {
                if (increaseKeys.includes(event.code)) {
                    event.preventDefault();
                    this.instance.controller.increaseSpeed();
                } else if (decreaseKeys.includes(event.code)) {
                    event.preventDefault();
                    this.instance.controller.decreaseSpeed();
                } else if (resetKeys.includes(event.code)) {
                    event.preventDefault();
                    this.instance.controller.resetSpeed();
                }
            }
        });
    }

    getAliases(code) {
        const map = {
            'Plus': ['Equal', 'NumpadAdd'],
            'Minus': ['Minus', 'NumpadSubtract'],
            'Enter': ['Enter', 'NumpadEnter'],
            'Period': ['Period', 'NumpadDecimal', 'NumpadComma'],
            'Asterisk': ['NumpadMultiply'],
            'Slash': ['Slash', 'NumpadDivide'],
            'Equal': ['Plus', 'NumpadAdd']
        };
        for (let i = 0; i <= 9; i++) {
            map['' + i] = [`Digit${i}`, `Numpad${i}`];
        }
        return [code, ...(map[code] || [])];
    }

    isInputFocused() {
        const activeElement = document.activeElement;
        const inputTypes = ['input', 'textarea', 'select'];
        return (
            activeElement && (
                inputTypes.includes(activeElement.tagName.toLowerCase()) ||
                activeElement.isContentEditable
            )
        );
    }
}
