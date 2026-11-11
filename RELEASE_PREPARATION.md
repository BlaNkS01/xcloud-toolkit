# Xbox Cloud Toolkit — release preparation

This distribution includes two separately versioned, user-tested installation options.

## Tampermonkey — v2.1.1

- Source: [xcloud-toolkit_v2_1_1.js](./xcloud-toolkit_v2_1_1.js)
- Install a userscript manager, open the source file, choose **Raw**, and confirm installation.
- Supported pages include `https://play.xbox.com/` and `https://www.xbox.com/play`.

## Chrome / Edge — v2.1.2

- Source: [extension folder](./extension/) (merged from [pull request #3](https://github.com/BlaNkS01/xcloud-toolkit/pull/3)).
- The extension has been tested by the project maintainer.
- Download the [repository ZIP](https://github.com/BlaNkS01/xcloud-toolkit/archive/refs/heads/main.zip) and extract it.
- Open `chrome://extensions` or `edge://extensions`, enable **Developer mode**, select **Load unpacked**, and choose the extracted `extension` directory containing `manifest.json`.
- Disable the Tampermonkey script when using the extension to avoid injecting the toolkit twice.

## Important

The Tampermonkey and extension versions are different by design. Do not rename the extension to v2.1.1 or imply it is merged before the PR is merged.

The extension is now merged into `main`. A standalone extension ZIP and a GitHub Release have not yet been published. Until then, use the repository ZIP and load its `extension` folder.

This project is independent and is not affiliated with Microsoft or Xbox.

License: [MIT](./LICENSE), copyright 2026 BlaNkS01.
