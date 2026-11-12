import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('settings writes merge concurrent updates in order', async () => {
    const source = await readFile(new URL('../utils/storage/settings.js', import.meta.url), 'utf8');
    let stored = { currentPlaybackSpeed: 1, theme: 'light' };
    const context = vm.createContext({
        console,
        chrome: { storage: { local: { set: async ({ settings }) => { stored = settings; } } } },
    });
    vm.runInContext(`${source}\nthis.apply = applyStorageSettingsMethods;`, context);
    class StorageManager {
        constructor() {
            this.settingsCache = { ...stored };
            this.DEFAULT_SETTINGS = {};
        }
    }
    context.apply(StorageManager);
    const storage = new StorageManager();
    const results = await Promise.all([
        storage.setSettings({ currentPlaybackSpeed: 2 }),
        storage.setSettings({ theme: 'dark' }),
    ]);
    assert.deepEqual(results, [true, true]);
    assert.equal(stored.currentPlaybackSpeed, 2);
    assert.equal(stored.theme, 'dark');
});

test('speed updates avoid redundant writes and display the actual rate', async () => {
    const source = await readFile(new URL('../content/modules/video-controller.js', import.meta.url), 'utf8');
    let writes = 0;
    class Media {
        get playbackRate() { return this.rate; }
        set playbackRate(value) { writes++; this.rate = value; }
    }
    const context = vm.createContext({ HTMLMediaElement: Media, console, Date, AbortController, document: { fullscreenElement: null } });
    vm.runInContext(`${source}\nthis.Controller = VideoController;`, context);
    const video = new Media();
    video.rate = 1;
    video.isConnected = true;
    video.paused = false;
    video.ended = false;
    let shown;
    const instance = {
        currentSpeed: 1,
        videos: new Set([video]),
        videoInteractionTs: new WeakMap(),
        settings: { showSpeedOverlay: true },
        ui: { showIndicator: (target, rate) => { shown = [target, rate]; } },
    };
    const controller = new context.Controller(instance);
    controller.updateAllVideoSpeeds();
    assert.equal(writes, 0);
    instance.currentSpeed = 2;
    controller.updateAllVideoSpeeds();
    assert.equal(writes, 1);
    controller.showSpeedOverlayIndicator();
    assert.equal(shown[0], video);
    assert.equal(shown[1], 2);
});
