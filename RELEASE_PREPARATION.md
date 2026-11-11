# Xbox Cloud Toolkit — release preparation

This distribution includes two separately versioned, user-tested installation options.

## Tampermonkey — v2.1.1

- Source: [xcloud-toolkit_v2_1_1.js](./xcloud-toolkit_v2_1_1.js)
- Install a userscript manager, open the source file, choose **Raw**, and confirm installation.
- Supported pages include `https://play.xbox.com/` and `https://www.xbox.com/play`.

## Chrome / Edge — v2.1.2

- Source: [extension changes in pull request #3](https://github.com/BlaNkS01/xcloud-toolkit/pull/3).
- The extension has been tested by the project maintainer.
- Until PR #3 is merged, the extension is **not** available from the default branch.
- To install from the PR branch, open PR #3, choose its **Files changed** or branch view, and download the branch ZIP from GitHub. Extract it.
- Open `chrome://extensions` or `edge://extensions`, enable **Developer mode**, select **Load unpacked**, and choose the extracted `extension` directory containing `manifest.json`.
- Disable the Tampermonkey script when using the extension to avoid injecting the toolkit twice.

## Important

The Tampermonkey and extension versions are different by design. Do not rename the extension to v2.1.1 or imply it is merged before the PR is merged.

No new downloadable extension ZIP or GitHub Release has been published by this document alone. Once PR #3 is merged, package the `extension` folder as a ZIP and attach it along with the userscript to a GitHub Release.

This project is independent and is not affiliated with Microsoft or Xbox.

License: [MIT](./LICENSE), copyright 2026 BlaNkS01.
