/* global BlockedRule, RestrictedRule, GroupRule, TimeUtils, DomainUtils */
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

    TimeDashBackground.prototype.handleMessage = async function handleMessage(
        message,
        sender,
        sendResponse
    ) {
        try {
            switch (message.type) {
                case 'GET_TAB_INFO':
                    sendResponse(await this.getTabInfo(sender.tab ? sender.tab.id : undefined));
                    break;
                case 'GET_SETTINGS':
                    sendResponse(await this.storage.getSettings());
                    break;
                case 'UPDATE_SETTINGS':
                    sendResponse({ success: await this.storage.setSettings(message.settings) });
                    break;
                case 'FLUSH_PENDING_UPDATES':
                    if (typeof this.processPendingUpdates === 'function')
                        await this.processPendingUpdates();
                    sendResponse({ success: true });
                    break;
                case 'GET_USAGE_DATA':
                    if (typeof this.processPendingUpdates === 'function')
                        await this.processPendingUpdates();
                    sendResponse(await this.getUsageData());
                    break;
                case 'UPDATE_VIDEO_SPEED':
                    await this.storage.setCurrentSpeed(message.speed);
                    sendResponse({ success: true });
                    break;
                case 'GET_CURRENTLY_PLAYING_VIDEOS':
                    sendResponse(await this.videoService.getCurrentlyPlayingVideos());
                    break;
                case 'CONTROL_VIDEO_PLAYBACK':
                    sendResponse(await this.videoService.controlVideoPlayback(message));
                    break;
                case 'REFRESH_VIDEO_DETECTION':
                    sendResponse(await this.videoService.refreshVideoDetection());
                    break;
                case 'FOCUS_VIDEO_TAB':
                    sendResponse(await this.videoService.focusVideoTab(message));
                    break;
                case 'TOGGLE_BLOCK':
                    await this.toggleSiteBlock(message.domain);
                    sendResponse({ success: true });
                    break;
                case 'EXPORT_DATA_JSON':
                    sendResponse({ data: await this.storage.getExportPayload(this.ruleManager) });
                    break;
                case 'GET_SITE_RULES':
                    sendResponse({
                        blocked: this.ruleManager.getBlockedDomains(),
                        restricted: this.ruleManager.getRestrictedDomains(),
                    });
                    break;
                case 'ADD_SITE_RULE': {
                    const { domain, ruleType, timeLimitMinutes } = message;
                    if (ruleType === 'BLOCKED') this.ruleManager.addRule(new BlockedRule(domain));
                    if (ruleType === 'RESTRICTED')
                        this.ruleManager.addRule(
                            new RestrictedRule(domain, timeLimitMinutes ?? 30)
                        );
                    await this.ruleManager.saveToStorage();
                    sendResponse({ success: true });
                    break;
                }
                case 'REMOVE_SITE_RULE':
                    this.ruleManager.removeRule(message.domain);
                    await this.ruleManager.saveToStorage();
                    sendResponse({ success: true });
                    break;
                case 'GET_GROUPS':
                    sendResponse(
                        this.ruleManager.groups.filter((g) => !g.deletedAt).map((g) => g.toJSON())
                    );
                    break;

                case 'CREATE_GROUP': {
                    const { name, domains = [], timeLimitMinutes } = message;
                    if (!name) {
                        sendResponse({ success: false, error: 'Group name is required' });
                        break;
                    }
                    const existing = this.ruleManager.getGroupByName(name);
                    if (existing) {
                        sendResponse({ success: false, error: 'Group name already exists' });
                        break;
                    }
                    let conflict = null;
                    for (const d of domains) {
                        const clean = d
                            .toLowerCase()
                            .replace(/^www\./, '')
                            .trim();
                        if (clean) {
                            const g = this.ruleManager.getGroupContainingDomain(clean);
                            if (g) {
                                conflict = g.name;
                                break;
                            }
                        }
                    }
                    if (conflict) {
                        sendResponse({
                            success: false,
                            error: `Domain already belongs to group "${conflict}"`,
                        });
                        break;
                    }
                    const group = new GroupRule({ name, domains, timeLimitMinutes });
                    this.ruleManager.groups.push(group);
                    await this.ruleManager.saveGroupsToStorage();
                    sendResponse({ success: true, group: group.toJSON() });
                    break;
                }

                case 'UPDATE_GROUP': {
                    const target = this.ruleManager.groups.find(
                        (g) => g.id === message.id && !g.deletedAt
                    );
                    if (!target) {
                        sendResponse({ success: false, error: 'Group not found' });
                        break;
                    }
                    if (message.name !== undefined) {
                        const nameConflict = this.ruleManager.groups.find(
                            (g) => g.id !== message.id && !g.deletedAt && g.name === message.name
                        );
                        if (nameConflict) {
                            sendResponse({ success: false, error: 'Group name already exists' });
                            break;
                        }
                        target.name = message.name;
                    }
                    if (message.timeLimitMinutes !== undefined)
                        target.timeLimitMinutes = message.timeLimitMinutes;
                    if (message.isEnabled !== undefined) target.isEnabled = message.isEnabled;
                    if (message.icon !== undefined) target.icon = message.icon;
                    if (message.domains !== undefined)
                        target.domains = message.domains.map((d) =>
                            d.toLowerCase().replace(/^www\./, '')
                        );
                    target.updatedAt = Date.now();
                    await this.ruleManager.saveGroupsToStorage();
                    sendResponse({ success: true });
                    break;
                }

                case 'DELETE_GROUP': {
                    const delGroup = this.ruleManager.groups.find(
                        (g) => g.id === message.id && !g.deletedAt
                    );
                    if (!delGroup) {
                        sendResponse({ success: false, error: 'Group not found' });
                        break;
                    }
                    delGroup.deletedAt = Date.now();
                    delGroup.updatedAt = Date.now();
                    await this.ruleManager.saveGroupsToStorage();
                    sendResponse({ success: true });
                    break;
                }

                case 'ADD_DOMAIN_TO_GROUP': {
                    const addGroup = this.ruleManager.groups.find(
                        (g) => g.id === message.groupId && !g.deletedAt
                    );
                    if (!addGroup) {
                        sendResponse({ success: false, error: 'Group not found' });
                        break;
                    }
                    const cleanDomain = message.domain
                        .toLowerCase()
                        .replace(/^www\./, '')
                        .trim();
                    if (!cleanDomain) {
                        sendResponse({ success: false, error: 'Invalid domain' });
                        break;
                    }
                    const conflict = this.ruleManager.getGroupContainingDomain(cleanDomain);
                    let previousGroupId = null;
                    if (conflict) {
                        if (conflict.id === addGroup.id) {
                            sendResponse({ success: false, error: 'Domain already in this group' });
                            break;
                        }
                        previousGroupId = conflict.id;
                        // Remove from the old group (move operation)
                        const idx = conflict.domains.indexOf(cleanDomain);
                        if (idx !== -1) {
                            conflict.domains.splice(idx, 1);
                            conflict.updatedAt = Date.now();
                        }
                    }
                    if (addGroup.domains.includes(cleanDomain)) {
                        sendResponse({ success: false, error: 'Domain already in this group' });
                        break;
                    }
                    addGroup.domains.push(cleanDomain);
                    addGroup.updatedAt = Date.now();
                    await this.ruleManager.saveGroupsToStorage();
                    sendResponse({ success: true, previousGroupId });
                    break;
                }

                case 'REMOVE_DOMAIN_FROM_GROUP': {
                    const remGroup = this.ruleManager.groups.find(
                        (g) => g.id === message.groupId && !g.deletedAt
                    );
                    if (!remGroup) {
                        sendResponse({ success: false, error: 'Group not found' });
                        break;
                    }
                    const clean = message.domain
                        .toLowerCase()
                        .replace(/^www\./, '')
                        .trim();
                    const idx = remGroup.domains.indexOf(clean);
                    if (idx === -1) {
                        sendResponse({ success: false, error: 'Domain not found in group' });
                        break;
                    }
                    remGroup.domains.splice(idx, 1);
                    remGroup.updatedAt = Date.now();
                    await this.ruleManager.saveGroupsToStorage();
                    sendResponse({ success: true });
                    break;
                }

                case 'CHECK_ACCESS': {
                    const settings = await this.storage.getSettings();
                    const dailyLimitMinutes = Number(settings.dailyTimeLimitMinutes || 0);

                    let allUsage = null;
                    if (dailyLimitMinutes > 0) {
                        allUsage = await this.storage.getAllUsage();
                        let totalTodaySeconds = 0;
                        for (const domainUsage of Object.values(allUsage)) {
                            totalTodaySeconds += TimeUtils.calculateTodayTime(domainUsage || {});
                        }

                        if (totalTodaySeconds >= dailyLimitMinutes * 60) {
                            sendResponse({
                                shouldBlock: true,
                                reason: 'restricted',
                                domain:
                                    message.domain || DomainUtils.extractDomain(message.url || ''),
                            });
                            break;
                        }
                    }

                    // Pre-calculate group usage if groups exist
                    let groupUsageSecondsMap = {};
                    const activeGroups = this.ruleManager.groups.filter(
                        (g) => g.isEnabled && !g.deletedAt
                    );
                    if (activeGroups.length > 0) {
                        if (!allUsage) allUsage = await this.storage.getAllUsage();
                        for (const g of activeGroups) {
                            let total = 0;
                            for (const d of g.domains) {
                                total += TimeUtils.calculateTodayTime(allUsage[d] || {});
                            }
                            groupUsageSecondsMap[g.id] = total;
                        }
                    }

                    const usage = await this.storage.getDomainUsage(message.domain);
                    const todayTime = TimeUtils.calculateTodayTime(usage);
                    sendResponse(
                        this.ruleManager.evaluateAccess(
                            message.url,
                            {
                                todayTimeSeconds: todayTime,
                            },
                            groupUsageSecondsMap
                        )
                    );
                    break;
                }
                default:
                    sendResponse({ error: 'Unknown message type' });
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
