# Third-Party Notices

This app uses the open-source packages below at runtime or in desktop distribution.

## Runtime dependencies

| Package | Version | License | License file |
| --- | --- | --- | --- |
| react | 19.2.4 | MIT | `licenses/react-stack-MIT.txt` |
| react-dom | 19.2.4 | MIT | `licenses/react-stack-MIT.txt` |
| scheduler | 0.27.0 | MIT | `licenses/react-stack-MIT.txt` |
| zustand | 5.0.11 | MIT | `licenses/zustand-MIT.txt` |
| localforage | 1.10.0 | Apache-2.0 | `licenses/localforage-Apache-2.0.txt` |
| lie | 3.1.1 | MIT | `licenses/lie-MIT.txt` |
| immediate | 3.0.6 | MIT | `licenses/immediate-MIT.txt` |
| lucide-react | 0.544.0 | ISC | `licenses/lucide-react-ISC.txt` |

## Desktop runtime

| Package | Version | License | License file |
| --- | --- | --- | --- |
| electron | 36.9.5 | MIT | `licenses/electron-MIT.txt` |

## Distribution note

If you distribute a packaged desktop build such as an `.exe` or installer, keep Electron's bundled `LICENSE` and `LICENSES.chromium.html` files from the exact Electron runtime used to build the app. Those files are present in `node_modules/electron/dist/` during development and should remain accessible in packaged releases.
