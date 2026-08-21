/**
 * @param {typeof OptionsController} OptionsController - Target class to extend with appearance methods.
 */
export function applyOptionsAppearanceMethods(OptionsController) {
    OptionsController.prototype.applyImmediateChanges = function applyImmediateChanges(key, value) {
        if (key === 'theme') {
            const current = document.documentElement.getAttribute('data-theme');
            if (current !== value) {
                document.documentElement.setAttribute('data-theme', value);
            }
            this.applyThemeMode(value);
        }

        if (key === 'accentColor') {
            const currentAccent = document.documentElement.getAttribute('data-accent');
            if (currentAccent !== value || /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
                this.applyAccentColor(value);
            }
        }

        if (key === 'animationsEnabled') {
            if (value === false) {
                document.documentElement.setAttribute('data-reduced-motion', 'true');
            } else {
                document.documentElement.removeAttribute('data-reduced-motion');
            }
        }

        if (key === 'language') {
            (async () => {
                if (typeof I18n !== 'undefined') {
                    await I18n.setLocale(value || 'auto');
                    I18n.init(document);
                    const navActive = document.querySelector('.nav-item.active');
                    if (navActive && navActive.dataset.tab) {
                        const titleEl = document.getElementById('pageTitle');
                        const labelEl = navActive.querySelector('.nav-label');
                        if (titleEl && labelEl) titleEl.textContent = labelEl.textContent;
                    }
                }
            })();
        }
    };

    OptionsController.prototype.applyThemeMode = function applyThemeMode(value) {
        const effective =
            value === 'auto'
                ? window.matchMedia('(prefers-color-scheme: dark)').matches
                    ? 'dark'
                    : 'light'
                : value;
        document.documentElement.setAttribute('data-theme-mode', effective);
    };

    OptionsController.prototype.applyAccentColor = function applyAccentColor(value) {
        const root = document.documentElement;
        const isCustomHex =
            typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);

        if (!isCustomHex) {
            root.setAttribute('data-accent', value || 'blue');
            root.style.removeProperty('--primary-color');
            root.style.removeProperty('--primary-dark');
            root.style.removeProperty('--primary-light');
            root.style.removeProperty('--primary-fade');
            root.style.removeProperty('--accent-color');
            root.style.removeProperty('--accent-fade');
            return;
        }

        const normalized = this.normalizeHex(value);
        const rgb = this.hexToRgb(normalized);
        if (!rgb) {
            root.setAttribute('data-accent', 'blue');
            return;
        }

        root.removeAttribute('data-accent');
        root.style.setProperty('--primary-color', normalized);
        root.style.setProperty('--primary-dark', this.mixHex(normalized, '#000000', 0.18));
        root.style.setProperty('--primary-light', this.mixHex(normalized, '#ffffff', 0.22));
        root.style.setProperty('--primary-fade', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)`);
        root.style.setProperty('--accent-color', normalized);
        root.style.setProperty('--accent-fade', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)`);
    };

    OptionsController.prototype.normalizeHex = function normalizeHex(hex) {
        const value = hex.toLowerCase();
        if (value.length === 4) {
            return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
        }
        return value;
    };

    OptionsController.prototype.hexToRgb = function hexToRgb(hex) {
        const normalized = this.normalizeHex(hex).replace('#', '');
        if (normalized.length !== 6) return null;

        const int = parseInt(normalized, 16);
        if (Number.isNaN(int)) return null;

        return {
            r: (int >> 16) & 255,
            g: (int >> 8) & 255,
            b: int & 255,
        };
    };

    OptionsController.prototype.rgbToHex = function rgbToHex(r, g, b) {
        const toHex = (n) => n.toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    };

    OptionsController.prototype.mixHex = function mixHex(hexA, hexB, ratio) {
        const a = this.hexToRgb(hexA);
        const b = this.hexToRgb(hexB);
        if (!a || !b) return hexA;

        const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
        const r = clamp(a.r + (b.r - a.r) * ratio);
        const g = clamp(a.g + (b.g - a.g) * ratio);
        const bl = clamp(a.b + (b.b - a.b) * ratio);

        return this.rgbToHex(r, g, bl);
    };
}
