import { applyCurrentlyPlayingMessagingMethods } from './currently-playing/messaging.js';
import { applyCurrentlyPlayingLifecycleMethods } from './currently-playing/lifecycle.js';
import { applyCurrentlyPlayingRenderingMethods } from './currently-playing/rendering.js';

export class CurrentlyPlayingUI {
    constructor(controller) {
        this.controller = controller;
        this.pollInterval = null;
        this.pollMs = 1000;
        this.isActive = false;
        this.dismissedKeys = new Set();
    }
}

applyCurrentlyPlayingMessagingMethods(CurrentlyPlayingUI);
applyCurrentlyPlayingLifecycleMethods(CurrentlyPlayingUI);
applyCurrentlyPlayingRenderingMethods(CurrentlyPlayingUI);
