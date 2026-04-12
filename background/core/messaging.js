'use strict';

function applyBackgroundMessagingMethods(TimeDashBackground) {
    TimeDashBackground.prototype.setupMessageHandling = function setupMessageHandling() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true;
        });

        chrome.commands.onCommand.addListener((command) => {
            this.handleCommand(command);
        });
    };

    TimeDashBackground.prototype.handleMessage = async function handleMessage(message, sender, sendResponse) {
        try {
            switch (message.type) {
                case 'GET_TAB_INFO': sendResponse(await this.getTabInfo(sender.tab ? sender.tab.id : undefined)); break;
                case 'GET_SETTINGS': sendResponse(await this.storage.getSettings()); break;
                case 'UPDATE_SETTINGS': sendResponse({ success: await this.storage.setSettings(message.settings) }); break;
                case 'GET_USAGE_DATA': sendResponse(await this.getUsageData()); break;
                case 'UPDATE_VIDEO_SPEED': await this.storage.setCurrentSpeed(message.speed); sendResponse({ success: true }); break;
                case 'GET_CURRENTLY_PLAYING_VIDEOS': sendResponse(await this.videoService.getCurrentlyPlayingVideos()); break;
                case 'CONTROL_VIDEO_PLAYBACK': sendResponse(await this.videoService.controlVideoPlayback(message)); break;
                case 'REFRESH_VIDEO_DETECTION': sendResponse(await this.videoService.refreshVideoDetection()); break;
                case 'FOCUS_VIDEO_TAB': sendResponse(await this.videoService.focusVideoTab(message)); break;
                case 'TOGGLE_BLOCK': await this.toggleSiteBlock(message.domain); sendResponse({ success: true }); break;
                case 'EXPORT_DATA': sendResponse({ data: await this.storage.exportDataAsCSV() }); break;
                case 'GET_SITE_RULES': sendResponse({ blocked: this.ruleManager.getBlockedDomains(), restricted: this.ruleManager.getRestrictedDomains() }); break;
                case 'ADD_SITE_RULE': {
                    const { domain, ruleType, timeLimitMinutes } = message;
                    if (ruleType === 'BLOCKED') this.ruleManager.addRule(new BlockedRule(domain));
                    if (ruleType === 'RESTRICTED') this.ruleManager.addRule(new RestrictedRule(domain, timeLimitMinutes || 30));
                    await this.ruleManager.saveToStorage();
                    sendResponse({ success: true });
                    break;
                }
                case 'REMOVE_SITE_RULE':
                    this.ruleManager.removeRule(message.domain);
                    await this.ruleManager.saveToStorage();
                    sendResponse({ success: true });
                    break;
                case 'CHECK_ACCESS': {
                    const usage = await this.storage.getDomainUsage(message.domain);
                    const todayTime = TimeUtils.calculateTodayTime(usage);
                    sendResponse(this.ruleManager.evaluateAccess(message.url, { todayTimeSeconds: todayTime }));
                    break;
                }
                default: sendResponse({ error: 'Unknown message type' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ error: error.message });
        }
    };

    TimeDashBackground.prototype.handleCommand = async function handleCommand(command) {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length === 0) return;
            const domain = DomainUtils.extractDomain(tabs[0].url);
            if (command === 'toggle-tracking') await this.toggleTracking();
            if (command === 'toggle-block') await this.toggleSiteBlock(domain);
        } catch (error) {
            console.error('Error handling command:', error);
        }
    };
}
