## ICAC P.U.L.S.E. v2.3.1

### Distribution
- In-app updater and website download now use **GitHub Releases** as the canonical distribution channel (replaces the Intellect Dashboard hosting that hit upload limits on Railway).
- Stable download link: https://github.com/exhonorated999/icac-pulse/releases/latest/download/ICAC.P.U.L.S.E-2.3.1-Setup.exe

### Under the hood
- `checkForUpdate()` now queries `api.github.com/repos/exhonorated999/icac-pulse/releases/latest` and selects the `-Setup.exe` asset via regex.
- Semver comparison tolerates leading `v` in tag names.
- In-app downloader unchanged — already supported HTTPS redirects, so GitHub asset S3 URLs work without modification.

### Notes
- Existing installs will be offered v2.3.1 via the in-app updater on next launch.
- All v2.3.0 features (UC Chat Operations, warrant parsers, dashboard UI polish, offline mode) are included.
