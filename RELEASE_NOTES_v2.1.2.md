# Xbox Cloud Toolkit — Release v2.1.2 (extension) + v2.1.1 (userscript)

This release bundles the two tested installation methods of Xbox Cloud Toolkit.

## Included

- **Chrome / Edge extension v2.1.2** — Manifest V3, keyboard and mouse virtual gamepad, stream stats, screenshot controls, game profiles, and improved mouse handling.
- **Tampermonkey userscript v2.1.1** — the existing standalone userscript.
- MIT license and installation documentation.

## Installation — Chrome / Edge

1. Download the repository ZIP: https://github.com/BlaNkS01/xcloud-toolkit/archive/refs/heads/main.zip
2. Extract the ZIP.
3. Open `chrome://extensions` or `edge://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked** and select the extracted `extension` directory containing `manifest.json`.
6. Open https://www.xbox.com/play and press **Alt+V** to show the panel.

## Installation — Tampermonkey

1. Install Tampermonkey.
2. Open https://github.com/BlaNkS01/xcloud-toolkit/blob/main/xcloud-toolkit_v2_1_1.js
3. Select **Raw** and install the userscript.

**Important:** Do not run both the extension and userscript on the same page.

## Validation

Both variants have been tested in-game by the maintainer. This does not guarantee compatibility with every browser, game, or future Xbox Cloud Gaming update.

## Links

- Source: https://github.com/BlaNkS01/xcloud-toolkit
- Extension source: https://github.com/BlaNkS01/xcloud-toolkit/tree/main/extension
- License: https://github.com/BlaNkS01/xcloud-toolkit/blob/main/LICENSE

This file is prepared release notes; publishing a GitHub Release and attaching a standalone extension ZIP are separate steps.
