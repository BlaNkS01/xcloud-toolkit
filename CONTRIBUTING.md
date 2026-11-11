# Contributing to Xbox Cloud Toolkit

Thanks for helping improve Xbox Cloud Toolkit!

## Before you start

- Check existing issues and pull requests to avoid duplicates.
- For bugs, include reproducible steps, browser/version, toolkit version, installation method, and relevant non-sensitive logs.
- For feature proposals, explain the use case and expected behavior.
- Do not share passwords, tokens, account details, or private gameplay information.

## Changes and pull requests

1. Fork the repository and create a focused branch.
2. Make the smallest change that solves the issue.
3. Check JavaScript syntax locally with `node --check xcloud-toolkit_v2_1_1.js` (or the file you changed).
4. Test relevant behavior manually on supported Xbox Cloud Gaming pages when possible.
5. Open a pull request describing the changes, testing performed, and any limitations.

Avoid unrelated formatting changes. Keep the userscript metadata and supported URL patterns accurate. Changes affecting mouse input, pointer lock, virtual gamepad behavior, or browser permissions should include manual testing notes.

Automated syntax checks cannot prove that Xbox Cloud Gaming interactions work correctly.

## License

By contributing, you agree that your contributions will be distributed under the repository's MIT License.
