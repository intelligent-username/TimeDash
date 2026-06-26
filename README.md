# TimeDash

![TimeDash Logo](icons/Logo.svg)

[![Available in the Chrome Web Store](https://storage.googleapis.com/chrome-gcs-uploader.appspot.com/image/WlD8wC6g8khYWPJUsQceQkhXSlv1/UV4C4ybeBTsZt43U4k0B.png)](https://chromewebstore.google.com/detail/timedash/fjlmkflcggcdndmchnmggldjdmmmpdgb?utm_source=item-share-cb)

TimeDash is a completely local, privacy-first Chrome extension designed to boost your productivity with strict time tracking, site blocking, and advanced video playback controls.

## Features

- **Strict Time Tracking:** Accurately logs your time only on active, focused tabs. Idle, minimized, or background tabs won't skew your productivity data.
- **Activity Heatmap & Analytics:** Visualize your browsing habits with a GitHub-style heatmap, rolling 7-day usage charts, top sites lists, and daily averages.
- **Site Blocking & Restrictions:** Block distracting sites entirely, or set daily time limits (e.g., 30 minutes of YouTube per day) that automatically lock you out once exceeded.
- **Video Speed Controller:** Easily control HTML5 video playback speed across the web using customizable keyboard shortcuts or the extension popup.
- **Data Privacy:** Everything is stored locally in your browser. No external servers, no cloud sync, completely private.

## Running Locally

If you'd like to run the extension from source, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/intelligent-username/TimeDash.git
   cd TimeDash
   ```

2. **Install dependencies:**
   *(Used solely for linting and formatting tooling)*
   ```bash
   npm install
   ```

3. **Load the extension into Chrome:**
   - Open your Chromium-based browser and navigate to `chrome://extensions/`.
   - Enable **"Developer mode"** in the top right corner.
   - Click **"Load unpacked"** in the top left corner.
   - Select the `TimeDash` project folder.

The extension will now be installed and active in your browser. Any changes you make to the code can be applied by clicking the "Refresh" icon on the extension card in `chrome://extensions/`.

## License

This project is licensed under the [MIT LICENSE](LICENSE) file for details.
