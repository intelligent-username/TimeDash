import { PRESET_GROUPS } from './group-presets.js';

const UNDO_WINDOW_MS = 10 * 60 * 1000;

/**
 * Mixin for the "Populate with Common Presets" button on the Blocking tab.
 * Methods take `context` (the BlockingUI instance) following the repo's
 * mixin convention.
 */
export const presetActions = {
    /**
     * Create all preset groups (or append domains into same-named groups).
     * @param {object} context - BlockingUI instance.
     * @returns {Promise<void>}
     */
    async populatePresets(context) {
        try {
            const presets = PRESET_GROUPS.map((p) => ({
                name: I18n.t(p.nameKey),
                domains: p.domains,
                timeLimitMinutes: p.timeLimitMinutes,
                domainLimitMinutes: p.domainLimitMinutes,
                icon: p.icon,
            }));
            const response = await chrome.runtime.sendMessage({
                type: 'POPULATE_PRESET_GROUPS',
                presets,
            });
            if (!response?.success) {
                context.controller.showWarning(response?.error || I18n.t('failedCreateGroup'));
                return;
            }
            await context.loadSiteRules();
            presetActions.setPopulateButtonState(context, 'added');
            context.controller.showSuccess(I18n.t('presetsPopulatedToast'));
        } catch (error) {
            console.error('Error populating preset groups:', error);
        }
    },

    /**
     * Undo a recent populate: delete created groups, strip appended domains.
     * @param {object} context - BlockingUI instance.
     * @returns {Promise<void>}
     */
    async undoPresets(context) {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'UNDO_PRESET_GROUPS' });
            if (!response?.success) {
                context.controller.showWarning(response?.error || I18n.t('failedCreateGroup'));
                return;
            }
            await context.loadSiteRules();
            presetActions.setPopulateButtonState(context, 'idle');
            context.controller.showSuccess(I18n.t('presetsUndoneToast'));
        } catch (error) {
            console.error('Error undoing preset groups:', error);
        }
    },

    /**
     * Restore the button state from a recent populate journal on page load.
     * Stale journals (older than UNDO_WINDOW_MS) are cleaned up lazily.
     * @param {object} context - BlockingUI instance.
     * @returns {Promise<void>}
     */
    async restorePopulateState(context) {
        try {
            const { presetUndo } = await chrome.storage.local.get('presetUndo');
            if (presetUndo && Date.now() - presetUndo.createdAt < UNDO_WINDOW_MS) {
                presetActions.setPopulateButtonState(context, 'added');
            } else if (presetUndo) {
                await chrome.storage.local.remove('presetUndo');
            }
        } catch (error) {
            console.error('Error restoring preset button state:', error);
        }
    },

    /**
     * Switch the populate button between idle and "added" states.
     * @param {object} context - BlockingUI instance.
     * @param {'idle'|'added'} state - Target button state.
     * @returns {void}
     */
    setPopulateButtonState(context, state) {
        const btn = document.getElementById('populatePresetsBtn');
        const label = document.getElementById('populatePresetsLabel');
        const undo = document.getElementById('populatePresetsUndo');
        if (!btn || !label || !undo) return;
        if (state === 'added') {
            label.textContent = I18n.t('presetsAdded');
            undo.hidden = false;
            btn.classList.add('presets-added');
        } else {
            label.textContent = I18n.t('populatePresets');
            undo.hidden = true;
            btn.classList.remove('presets-added');
        }
    },
};
