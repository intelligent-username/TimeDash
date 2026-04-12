const PARTIAL_MOUNTS = [
    { mountId: 'optionsSidebarMount', partialPath: 'partials/layout/sidebar.html' },
    { mountId: 'analyticsTabContent', partialPath: 'partials/tabs/analytics-tab.html' },
    { mountId: 'generalTabContent', partialPath: 'partials/tabs/general-tab.html' },
    { mountId: 'videoTabContent', partialPath: 'partials/tabs/video-tab.html' },
    { mountId: 'blockingTabContent', partialPath: 'partials/tabs/blocking-tab.html' },
    { mountId: 'privacyTabContent', partialPath: 'partials/tabs/privacy-tab.html' },
    { mountId: 'helpTabContent', partialPath: 'partials/tabs/help-tab.html' },
    { mountId: 'optionsOverlayMount', partialPath: 'partials/layout/overlays.html' }
];

const partialCache = new Map();

async function fetchPartial(partialPath) {
    if (partialCache.has(partialPath)) {
        return partialCache.get(partialPath);
    }

    const url = new URL(partialPath, window.location.href);
    const response = await fetch(url.toString(), { cache: 'no-cache' });

    if (!response.ok) {
        throw new Error(`Failed to load partial: ${partialPath} (${response.status})`);
    }

    const html = await response.text();
    partialCache.set(partialPath, html);
    return html;
}

export async function loadOptionsLayout() {
    const loadOperations = PARTIAL_MOUNTS.map(async ({ mountId, partialPath }) => {
        const mountElement = document.getElementById(mountId);

        if (!mountElement) {
            throw new Error(`Missing partial mount: ${mountId}`);
        }

        mountElement.innerHTML = await fetchPartial(partialPath);
    });

    await Promise.all(loadOperations);
}
