/**
 * @file Curated starter budget groups for one-click population.
 * Domain sets are disjoint across presets so a populate run never has one
 * preset claim a domain another preset's group wants.
 */

/**
 * Preset group definitions. `nameKey` is an i18n key resolved to a literal
 * localized group name at populate time. Each member domain also gets an
 * individual restricted rule of `domainLimitMinutes` (5) on top of the
 * shared group budget of `timeLimitMinutes` (30), so users start with
 * reasonable per-site AND per-category restrictions.
 * @type {Array<{nameKey: string, icon: string, timeLimitMinutes: number, domainLimitMinutes: number, domains: string[]}>}
 */
export const PRESET_GROUPS = [
    {
        nameKey: 'presetNameSocial',
        icon: 'heart',
        timeLimitMinutes: 30,
        domainLimitMinutes: 5,
        domains: [
            'facebook.com',
            'instagram.com',
            'x.com',
            'twitter.com',
            'threads.net',
            'snapchat.com',
            'pinterest.com',
            'linkedin.com',
            'tiktok.com',
            '9gag.com',
            'imgur.com',
            'knowyourmeme.com',
        ],
    },
    {
        nameKey: 'presetNameVideo',
        icon: 'play',
        timeLimitMinutes: 30,
        domainLimitMinutes: 5,
        domains: [
            'youtube.com',
            'netflix.com',
            'hulu.com',
            'twitch.tv',
            'disneyplus.com',
            'primevideo.com',
            'dailymotion.com',
            'vimeo.com',
        ],
    },
    {
        nameKey: 'presetNameNews',
        icon: 'globe',
        timeLimitMinutes: 30,
        domainLimitMinutes: 5,
        domains: [
            'cnn.com',
            'bbc.com',
            'nytimes.com',
            'theguardian.com',
            'reuters.com',
            'apnews.com',
            'foxnews.com',
            'dailymail.co.uk',
        ],
    },
    {
        nameKey: 'presetNameShopping',
        icon: 'shopping',
        timeLimitMinutes: 30,
        domainLimitMinutes: 5,
        domains: [
            'amazon.com',
            'ebay.com',
            'aliexpress.com',
            'temu.com',
            'etsy.com',
            'shein.com',
            'wish.com',
        ],
    },
    {
        nameKey: 'presetNameGaming',
        icon: 'gamepad',
        timeLimitMinutes: 30,
        domainLimitMinutes: 5,
        domains: [
            'roblox.com',
            'steamcommunity.com',
            'epicgames.com',
            'chess.com',
            'poki.com',
            'crazygames.com',
            'miniclip.com',
        ],
    },
    {
        nameKey: 'presetNameSports',
        icon: 'trophy',
        timeLimitMinutes: 30,
        domainLimitMinutes: 5,
        domains: [
            'espn.com',
            'bleacherreport.com',
            'cbssports.com',
            'flashscore.com',
            'skysports.com',
        ],
    },
    {
        nameKey: 'presetNameForums',
        icon: 'message',
        timeLimitMinutes: 30,
        domainLimitMinutes: 5,
        domains: ['reddit.com', 'quora.com', 'tumblr.com', '4chan.org'],
    },
];
