import { OptionsController } from './js/core/options-controller.js';
import { loadOptionsLayout } from './js/core/options-layout-loader.js';

/**
 * Main entry point for TimeDash options page.
 * Logic in options/js/core and options/js/ui.
 */
async function initializeOptionsPage() {
    const container = document.querySelector('.dashboard-container');
    await loadOptionsLayout();
    window.optionsController = new OptionsController();
    await window.optionsController.ready;
    if (container) container.classList.add('ready');
}

document.addEventListener('DOMContentLoaded', () => {
    initializeOptionsPage().catch((error) => {
        console.error('Failed to initialize options page layout.', error);
    });
});
