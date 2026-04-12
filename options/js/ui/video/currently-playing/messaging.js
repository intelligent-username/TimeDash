export function applyCurrentlyPlayingMessagingMethods(CurrentlyPlayingUI) {
    CurrentlyPlayingUI.prototype.sendMessageWithTimeout = async function sendMessageWithTimeout(message, timeoutMs = 10000) {
        return await Promise.race([
            chrome.runtime.sendMessage(message),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
        ]);
    };

    CurrentlyPlayingUI.prototype.parseFrameId = function parseFrameId(rawFrameId) {
        if (rawFrameId === undefined || rawFrameId === null || rawFrameId === '') {
            return undefined;
        }

        const parsed = Number(rawFrameId);
        return Number.isInteger(parsed) ? parsed : undefined;
    };
}
