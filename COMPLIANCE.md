# License Compliance & Legal Risk Assessment

This document outlines the license implications for **Undo Download Manager** regarding its core dependencies.

## ⚖️ Dependency License Warning

The on-device extraction and download engine used in this project relies on the following components:

*   **[youtubedl-android](https://github.com/yausername/youtubedl-android)**: Licensed under **GPL-3.0**.
*   **[yt-dlp](https://github.com/yt-dlp/yt-dlp)**: Licensed under **The Unlicense** (Public Domain), but often bundled with GPL-3.0 wrappers.
*   **[FFmpeg](https://ffmpeg.org/)**: Licensed under **LGPL** or **GPL** (depending on the build configuration used by the library).

### 🔍 GPL-3.0 Implications

The **GNU General Public License v3.0 (GPL-3.0)** is a "copyleft" license. This means:

1.  **Derivative Works**: If you distribute an application that is considered a "derivative work" of a GPL-3.0 library, you may be required to release your own application's source code under the same GPL-3.0 license.
2.  **Commercial Distribution**: While GPL-3.0 does not prohibit commercial use or distribution on stores (like Google Play, Cafe Bazaar, or Myket), it mandates that the users of your app have the right to access the source code of the software they are using.

### ⚠️ Risk for Closed-Source Projects

If you intend to distribute **Undo Download Manager** as a **closed-source** commercial application:

*   There is a legal risk that the use of `youtubedl-android` (GPL-3.0) could obligate you to open-source the entire application.
*   The "bridge" between the Capacitor UI and the GPL-3.0 Java library (via the Native Plugin) is a specific area that usually requires legal interpretation to determine if it constitutes a "combined work."

## 🛠️ Action Required for Developers

Before distributing this app in a production environment:

1.  **Legal Review**: Consult with a legal professional specializing in software licensing to evaluate your specific distribution model and architecture.
2.  **Attribution**: Ensure you include the appropriate license notices for all third-party libraries in your app's "About" or "Legal Notices" section.
3.  **Source Code Policy**: Determine if you are prepared to release your source code upon request or if you need to investigate alternative (non-GPL) extraction engines.

---

*Disclaimer: This document is for informational purposes only and does not constitute legal advice. The developers of Undo Download Manager are responsible for their own license compliance.*
