# TimeDash

<img src="icons/Logo.svg" width="128" height="128" alt="TimeDash Logo">

## Features

- Custom blocked and restricted rules let the background rule manager decide when a tab should show a warning, a hard block, or a restricted view.
- The overlay injects motivational copy and timing cues into each site while the content script monitors usage seconds.
- The popup surfaces live stats, a curated site list, and quick toggles so you can pause, resume, or adjust thresholds without leaving the page.
- The options page centralizes site controls, analytics, and site-management helpers for tailoring rules per domain.
- The alarm manager keeps timers accurate even when the browser is idle so reminders and reports stay in sync.

## Getting started

1. Run `npm install` from the project root to populate the tooling used for linting and docs.
2. Open a Chromium-based browser, go to `chrome://extensions`, enable developer mode, and click "Load unpacked" to point to this repository.
3. (Optional) Use `npm run lint` to validate the JS style before packaging or releasing.

## License

This project is licensed under the [MIT LICENSE](LICENSE) file for details.
