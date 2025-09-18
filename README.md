# TimeDash Browser

<!-- Insert Icon from icons/icon377.png-->

![TimeDash Logo](/icons/icon377.png)

A productivity browser extension.

Goals: to help you track your time, control video playback speeds, block distracting websites, and maintain focus while browsing the web.

## 🚧In Progress🚧

## 🚀 Features

### Time Tracking

- **Automatic tracking** of time spent on each website
- **Real-time statistics** in popup and badge
- **Daily, weekly, and monthly** usage analytics
- **Category-based tracking** (productivity, entertainment, social, etc.)
- **Session management** with detailed breakdowns

### Video Speed Control

- **Automatic detection** of video elements on any website
- **Customizable speed presets** (0.25x to 3.0x)
- **Keyboard shortcuts** for quick speed adjustments
- **Per-site speed memory** - remembers your preferred speed for each site
- **Overlay controls** for easy access

### Website Blocking

- **Smart blocking** of distracting websites
- **Temporary access** with time limits
- **Schedule-based blocking** (work hours, weekends)
- **Block statistics** and motivation
- **Strict mode** for serious focus sessions

### Analytics & Insights

- **Detailed usage reports** with charts and trends
- **Productivity scoring** based on site categories
- **Goal setting** and progress tracking
- **Data export/import** for backup and portability
- **Privacy-focused** - all data stays local

### Customization

- **Light/dark themes**
- **Misc. Settings for features**
- **Keyboard shortcuts**
- **Notifications**

## Installation

### From Chrome Web Store (Recommended)

### Manual Installation (Development)

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension icon will appear in your toolbar

## 🎯 Quick Start

### First Time Setup

1. **Welcome Tour**: Follow the guided onboarding to set up your preferences
2. **Add Blocked Sites**: Start with common distractions like social media
3. **Configure Video Speeds**: Set your preferred speeds for different video sites
4. **Customize Settings**: Adjust themes, notifications, and tracking preferences

### Daily Usage

1. **Track Your Time**: The extension automatically tracks your browsing time
2. **View Statistics**: Click the extension icon to see today's usage
3. **Control Video Speed**: Visit any video site and use the overlay or keyboard shortcuts
4. **Stay Focused**: Blocked sites will redirect to a motivation page

### Advanced Features

1. **Temporary Access**: Request limited access to blocked sites when needed
2. **Schedule Blocking**: Set work hours for automatic blocking
3. **Export Data**: Backup your data or migrate to another device
4. **Analytics**: View detailed reports in the options page

## 🎮 Keyboard Shortcuts

| Action               | Default Shortcut | Customizable |
| -------------------- | ---------------- | ------------ |
| Increase video speed | `+`              | ✅           |
| Decrease video speed | `-`              | ✅           |
| Toggle time tracking | `Alt + T`        | ✅           |
| Toggle site blocking | `Alt + B`        | ✅           |

_All shortcuts can be customized in Chrome's extension settings_ [chrome://extensions/shortcuts]

## 📱 Supported Browsers

| Browser     | Version | Support Level              |
| ----------- | ------- | -------------------------- |
| **Chrome**  | 88+     | ✅ Full Support            |
| **Edge**    | 88+     | ✅ Full Support            |
| **Brave**   | 88+     | ✅ Full Support            |
| **Opera**   | 74+     | ⚠️ Limited Testing         |
| **Firefox** | -       | ❌ Not Currently Supported |

_Firefox support is planned for a future release using_ **Manifest V2**

## 🔒 Privacy & Data

### Data Collection

- **Zero server storage** - All data stays on your device
- **No tracking** - We don't track your browsing habits
- **Optional analytics** - Anonymous usage statistics (can be disabled)
- **Local storage only** - Uses Chrome's secure storage APIs

### Permissions Explained

- **Active Tab**: To track time and detect videos on current tab
- **Storage**: To save your settings and usage data
- **Alarms**: For scheduled tasks and reminders
- **Notifications**: To show productivity alerts (optional)

### Data Export

- Export all your data anytime in JSON format
- Import data to migrate between devices
- No vendor lock-in - your data is yours

## 🛠️ Development

### Tech Stack

- **Manifest V3** - Latest Chrome extension standard
- **Vanilla JavaScript** - No frameworks, lightweight and fast
- **Chrome APIs** - Storage, alarms, tabs, notifications
- **CSS3** - Modern styling with dark mode support
- **HTML5** - Semantic markup and accessibility

### Project Structure

```md
timedash/
├── manifest.json # Extension configuration
├── background/ # Service worker scripts
├── content/ # Content scripts for web pages
├── popup/ # Extension popup UI
├── options/ # Settings page
├── block/ # Blocked site page
├── utils/ # Shared utilities
├── icons/ # Extension icons
└── \_dev/ # Development tools
```

### Building from Source

1. Clone the repository:

    ```bash
    git clone https://github.com/timedash/extension.git
    cd extension
    ```

2. Install development dependencies:

    ```bash
    npm install
    ```

3. Run tests:

    ```bash
    npm test
    ```

4. Load in Chrome:
    - Open `chrome://extensions/`
    - Enable Developer mode
    - Click "Load unpacked" and select the project folder

### Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📋 Changelog

### Not at Version 1.0.0 yet❗❗

### Version 1.0.0 (Initial Release)

- ✅ Complete time tracking system
- ✅ Video speed control with overlay
- ✅ Website blocking with temporary access
- ✅ Comprehensive analytics dashboard
- ✅ Dark/light theme support
- ✅ Onboarding flow
- ✅ Data export/import
- ✅ Keyboard shortcuts
- ✅ Badge notifications

### Planned Features (v1.1.0)

- 🔄 Cloud sync across devices
- 🌍 Multi-language support
- 📅 Advanced scheduling options
- 🎯 Goal setting and achievements
- 📱 Mobile companion app
- 🔗 Integration with productivity tools

## 🆘 Support

### Documentation

- [User Guide](docs/user-guide.md) - Detailed usage instructions
- [FAQ](docs/faq.md) - Common questions and answers
- [Troubleshooting](docs/troubleshooting.md) - Solutions to common issues

### Getting Help

- 📧 **Email**: []
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/timedash/extension/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/timedash/extension/discussions)
- 💬 **Community**: [Discord Server](https://discord.gg/timedash)

### Known Issues

- Video detection may not work on some streaming sites (working on improvements)
- Block page may briefly flash on very fast redirects
- Badge may not update immediately on some systems

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Icons**: [Heroicons](https://heroicons.com/) and [Feather Icons](https://feathericons.com/)
- **Inspiration**: Pomodoro Technique and digital wellness research
- **Testing**: Amazing beta testers and early adopters
- **Community**: Contributors and users who provide feedback

## 🌟 Show Your Support

If TimeDash helps you stay productive, please:

- ⭐ Star this repository
- 📝 Leave a review on the Chrome Web Store
- 🐦 Share it with friends and colleagues
- 🛠️ Contribute to the project

---
