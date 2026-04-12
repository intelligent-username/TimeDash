'use strict';

class BlockPageController {
    constructor() {
        this.storageManager = null;
        this.blockedUrl = '';
        this.blockedDomain = '';
        this.blockReason = 'blocked';
        this.blockStats = {
            count: 0,
            timeSpent: 0,
        };

        this.motivationalQuotes = [
            { quote: 'The way to get started is to quit talking and begin doing.', author: 'Walt Disney' },
            { quote: 'Focus on being productive instead of busy.', author: 'Tim Ferriss' },
            { quote: 'You are never too old to set another goal or to dream a new dream.', author: 'C.S. Lewis' },
            { quote: 'The future depends on what you do today.', author: 'Mahatma Gandhi' },
            { quote: "Don't watch the clock; do what it does. Keep going.", author: 'Sam Levenson' },
            { quote: 'Success is the sum of small efforts repeated day in and day out.', author: 'Robert Collier' },
            { quote: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
            { quote: "Believe you can and you're halfway there.", author: 'Theodore Roosevelt' },
        ];

        this.productivityTips = [
            'Try the Pomodoro Technique: Work for 25 minutes, then take a 5-minute break.',
            'Create a distraction-free workspace to improve your focus.',
            'Use the 2-minute rule: If it takes less than 2 minutes, do it now.',
            'Block time in your calendar for important tasks.',
            'Take regular breaks to maintain high productivity levels.',
            'Set specific, measurable goals for each work session.',
            'Keep a notepad nearby to jot down random thoughts that pop up.',
        ];

        this.init();
    }

    async init() {
        try {
            this.storageManager = new StorageManager();
            this.parseUrlParameters();

            // Apply theme immediately
            await this.applyTheme();

            // Check if access is now allowed (time limit may have been changed)
            const stillBlocked = await this.checkIfStillBlocked();
            if (!stillBlocked && this.blockedUrl) {
                // Access is now allowed - redirect back to the original site
                this.redirectToOriginalUrl();
                return;
            }

            await this.loadBlockData();
            this.setupEventListeners();
            this.updateUI();
        } catch (error) {
            console.error('Failed to initialize block page:', error);
        }
    }

    async applyTheme() {
        const settings = await this.storageManager.getSettings();
        if (settings) {
            document.documentElement.setAttribute('data-theme', settings.theme || 'auto');
            document.documentElement.setAttribute('data-accent', settings.accentColor || 'blue');
        }
    }
}

applyBlockAccessMethods(BlockPageController);
applyBlockUiMethods(BlockPageController);

document.addEventListener('DOMContentLoaded', () => {
    new BlockPageController();
});
