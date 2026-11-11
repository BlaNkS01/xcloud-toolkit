# Xbox Cloud Toolkit — Chrome / Edge Extension

Manifest V3 browser extension, built from the existing userscript with the current input and WebRTC fixes.

## Install locally

1. Download the repository ZIP from GitHub and extract it.
2. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the **extension** folder (the folder containing `manifest.json`).
5. Visit [Xbox Cloud Gaming](https://www.xbox.com/play) and use **Alt+V** to show the toolkit panel.

## Notes

- Disable the Tampermonkey userscript while using the extension to avoid duplicate injections.
- This extension uses `world: "MAIN"` because the virtual controller and WebRTC instrumentation must interact with the page's JavaScript environment. It requests no extra permissions.
- It supports Chrome and Edge versions implementing Manifest V3 main-world content scripts.
- The source is copied from the userscript and is not yet automatically synchronized; keep both versions updated when changing functionality.
- Browser and Xbox Cloud Gaming runtime compatibility have **not** been verified yet; test keyboard, mouse, controller and HUD before distributing.
- This is an unpacked developer extension, not a Chrome Web Store or Edge Add-ons listing.

## 2.1.2 mouse fix

Camera input uses lower gain, time-based smoothing and radial deadzone compensation that fades near rest. Saved sensitivity and game profiles still apply. Releasing pointer lock clears camera movement immediately.

After updating, reload the extension and refresh the Xbox Cloud Gaming tab. Start at Mouse Sensitivity 100%, ADS 70%, Deadzone Compensation 10%; adjust for the game's own deadzone.

Run the input regression checks with: node extension/mouse.test.cjs (from the repository root). These checks do not replace live Chrome/Edge gameplay testing.
