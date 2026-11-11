<div align="center">

# 🎮 Xbox Cloud Toolkit

**A userscript companion for Xbox Cloud Gaming**

Keyboard & Mouse · Virtual Xbox Controller · Game Profiles · Performance HUD · WebRTC Diagnostics · Image Controls

![Version](https://img.shields.io/badge/version-2.1.1-107C10?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Xbox%20Cloud%20Gaming-107C10?style=flat-square)
![Userscript](https://img.shields.io/badge/userscript-Tampermonkey-blue?style=flat-square)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](./LICENSE)
[![JavaScript checks](https://github.com/BlaNkS01/xcloud-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/BlaNkS01/xcloud-toolkit/actions/workflows/ci.yml)

[![Install with Tampermonkey](https://img.shields.io/badge/Install%20Script-Tampermonkey-107C10?style=for-the-badge&logo=tampermonkey&logoColor=white)](https://github.com/BlaNkS01/xcloud-toolkit/raw/refs/heads/main/xcloud-toolkit_v2_1_1.js)

[**Install**](#-installation) · [**Changelog**](./CHANGELOG.md) · [**Contributing**](./CONTRIBUTING.md) · [**Security**](./SECURITY.md) · [**Features**](#-features) · [**Screenshots**](#-screenshots) · [**Shortcuts**](#-keyboard-shortcuts) · [**Troubleshooting**](#-troubleshooting)

</div>

---

## 📖 Overview

**Xbox Cloud Toolkit** enhances your browser-based Xbox Cloud Gaming experience with customizable keyboard and mouse controls, a virtual Xbox controller, per-game profiles, stream performance monitoring, and visual adjustments.

It runs as a browser userscript on supported Xbox Cloud Gaming pages. **It does not change your Xbox region, bypass service restrictions, or improve the underlying internet connection.**

## 🚀 Installation

1. Install a browser userscript manager such as [Tampermonkey](https://www.tampermonkey.net/) and enable userscripts as required by your browser.
2. Click the **Install Script** button above to open the current userscript source, or open the [Xbox Cloud Toolkit userscript](./xcloud-toolkit_v2_1_1.js).
3. Click **Raw** on GitHub, then follow your userscript manager's installation prompt. If no prompt appears, create a new userscript in Tampermonkey, paste the script contents, and save it.
4. Open [Xbox Cloud Gaming](https://www.xbox.com/play) or [play.xbox.com](https://play.xbox.com/).
5. Start a cloud gaming session and press **Alt + V** to show the toolkit panel.

> **Note:** A supported browser, access to Xbox Cloud Gaming, and an eligible account/subscription may be required. Available features depend on your browser and the game. GitHub's Raw link may display the source instead of automatically launching installation.

## ✨ Features

| Feature | Description |
| --- | --- |
| 🎯 Keyboard & Mouse | Map keyboard and mouse inputs to a virtual Xbox gamepad for cloud games. |
| 🎮 Automatic game detection | Identify supported game pages and associate titles with individual profiles. |
| 🧩 Profile Manager | Create, edit, switch, reset, import and export game profiles as JSON. |
| ⚙️ Control presets | Shooter, standard and racing presets, with configurable sensitivity, deadzone and controls. |
| 📊 Performance HUD | Monitor available stream and network diagnostics while playing. |
| 📈 Live graphs | View recent RTT, jitter and bitrate trends. |
| 🟢 Connection Score | See an estimated 0–100 connection-quality score derived from network metrics. |
| 🖼️ Image controls | Adjust brightness, contrast, saturation and sharpening. |
| 📸 Screenshots | Attempt to save a PNG image of the current video frame. |
| ⏱️ Playtime | Track streaming-session playtime locally. |

### 🎯 Automatic profiles

The toolkit attempts to detect the current title and automatically select or create an appropriate profile. Built-in category rules cover examples such as **ARC Raiders** (Shooter), **Forza** titles (Racing), and **No Man's Sky** (Sandbox).

Detection is based on page information and may not recognize every title. You can open **Profile Manager** with **Alt + J** to customize profiles, control bindings, and JSON import/export.

### 📊 Performance HUD

The real-time HUD can display available measurements including:

- FPS, resolution and bitrate
- RTT / latency and jitter
- Packet loss
- Decode time and buffer delay
- An estimated Connection Score
- Recent RTT, jitter and bitrate graphs

> **Metrics are diagnostic estimates**, dependent on browser WebRTC data and stream availability. Missing measurements are not necessarily connection failures. The score is an indicator, not an official Xbox network rating.

### ⌨️ Keyboard & Mouse

Enable virtual-gamepad keyboard and mouse controls using **Alt + K**. Choose a suitable preset and tune mouse sensitivity, aiming sensitivity, deadzone and steering speed in the toolkit panel. **Alt + M** toggles mouse pointer lock when available.

Some controls and games may behave differently, and browser pointer-lock permissions can affect mouse input. Disable keyboard/mouse mapping if you prefer a physical controller.

## 📸 Screenshots

Explore real gameplay captures showing the toolkit's automatic game profiles, customizable controls and live stream diagnostics. Select an image to open the full-resolution screenshot.

### 🌌 No Man's Sky — Sandbox profile

Automatic sandbox profile, keyboard and mouse settings, image enhancement and performance monitoring.

![No Man's Sky — space scene with Xbox Cloud Toolkit controls and live HUD](https://github.com/user-attachments/assets/565a26ef-972b-422d-9cd6-e8feebd791a9)

<details>
<summary>View 3 more No Man's Sky screenshots</summary>

![No Man's Sky — character with control settings and performance HUD](https://github.com/user-attachments/assets/8702df73-5355-49fb-b005-0e1582232021)

![No Man's Sky — expanded playtime and profile manager controls](https://github.com/user-attachments/assets/de601e06-665c-45fc-b0b6-ef91eecb781e)

![No Man's Sky — gameplay with compact stream statistics](https://github.com/user-attachments/assets/202c80ac-9fbf-4bcd-9713-84e79f962400)

</details>

### 🏎️ Forza Horizon 6 — Racing profile

Racing preset detection, keyboard steering controls and live RTT, jitter and bitrate graphs.

![Forza Horizon 6 — racing game with live performance HUD](https://github.com/user-attachments/assets/20540350-91f5-475e-98d5-76fd157544ac)

<details>
<summary>View 2 more Forza Horizon 6 screenshots</summary>

![Forza Horizon 6 — racing preset and keyboard controls](https://github.com/user-attachments/assets/ba5458cb-905f-416f-8322-77b0b2abf0e2)

![Forza Horizon 6 — game screen with compact network statistics](https://github.com/user-attachments/assets/412ebb55-f631-4b6c-be49-d4060fcd01e3)

</details>

### 🎯 ARC Raiders — Shooter profile

Automatic **Shooter** profile detection, keyboard and mouse controls, aiming sensitivity and the live performance HUD.

![ARC Raiders — shooter profile with keyboard and mouse controls](https://github.com/user-attachments/assets/1c82d7d5-a287-4b7f-9311-d1630753a3aa)

![ARC Raiders — gameplay with connection score, latency and bitrate graphs](https://github.com/user-attachments/assets/efe6fa78-bee0-4f39-9c84-9ef277f2aded)

> Screenshots illustrate toolkit features during gameplay. Stream quality and available metrics depend on the current session.

## ⌨️ Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Alt + G` | Toggle performance HUD |
| `Alt + V` | Toggle toolkit panel |
| `Alt + K` | Enable / disable keyboard & mouse mapping |
| `Alt + S` | Toggle statistics panel |
| `Alt + P` | Save screenshot (when supported) |
| `Alt + F` | Toggle fullscreen |
| `Alt + J` | Open / close Profile Manager |
| `Alt + M` | Toggle mouse pointer lock |

> Shortcuts may conflict with browser, operating-system, or accessibility shortcuts.

## 💾 Profiles and local data

Profiles and settings are stored in your browser's `localStorage` for the Xbox Cloud Gaming website. The toolkit stores settings, profile definitions and playtime information locally; clearing site data can erase them.

To back up profiles:

1. Press **Alt + J** to open **Profile Manager**.
2. Use **Export** to generate profile JSON, and copy the result to a safe location.
3. To restore, paste valid profile JSON into the import field and select **Import**.

Only import JSON from sources you trust. Importing profiles changes your local control settings.

## 🌐 Supported sites

- [https://play.xbox.com/](https://play.xbox.com/)
- [https://www.xbox.com/play](https://www.xbox.com/play)

The script matches the configured Xbox Cloud Gaming URL patterns; it is not a standalone desktop application.

## 🛠️ Troubleshooting

| Problem | What to try |
| --- | --- |
| Toolkit does not appear | Confirm Tampermonkey is enabled, the script is active, and you opened a supported Xbox Cloud Gaming URL. Reload the page and try `Alt + V`. |
| Keyboard/mouse does not respond | Start a game stream, enable mapping with `Alt + K`, and try pointer lock with `Alt + M`. Check that another userscript is not intercepting input. |
| HUD shows missing values | Start an active stream and allow time for WebRTC data to become available. Browser support and metric availability vary. |
| A game has the wrong profile | Open `Alt + J` and manually adjust the selected profile or preset. |
| Screenshot fails | A live video frame must be available; browser restrictions may prevent canvas capture or downloading. |
| Shortcuts do not work | Check for browser/OS shortcut conflicts and verify focus is on the game page. |
| Profiles disappeared | Check whether site data was cleared or a different browser profile is being used. Restore from an exported JSON backup if available. |

If a problem persists, open a [GitHub issue](https://github.com/BlaNkS01/xcloud-toolkit/issues) and include your browser, userscript manager version, steps to reproduce, and relevant console errors. Avoid sharing account credentials or sensitive data.

## 📦 Version

**Current version: v2.1.1**

The v2.1.1 release focuses on English localization:

- English interface, tooltips and notifications
- English console messages
- Improved Profile Manager localization

These localization updates do not intentionally change functionality.

## ⚠️ Disclaimer

Xbox Cloud Toolkit is an independent community userscript and is **not affiliated with, endorsed by, or supported by Microsoft or Xbox**. Xbox, Xbox Cloud Gaming and game names are trademarks of their respective owners. Use at your own discretion; game and platform behavior can change.

---

<div align="center">

Made for Xbox Cloud Gaming enthusiasts ❤️

[Back to top](#-xbox-cloud-toolkit)

</div>
