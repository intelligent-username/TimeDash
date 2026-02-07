import { OptionsController } from './js/core/options-controller.js';

/**
 * Main entry point for TimeDash options page.
 * Logic in options/js/core and options/js/ui.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the main controller which handles all UI sections
    window.optionsController = new OptionsController();
});
