#!/usr/bin/env zsh
# CopyWithLink — Copies selected text as "text" [filename](file:///path)
# Supports VS Code, Sublime Text, Skim, and Adobe Acrobat.
set -euo pipefail

BUNDLE="${POPCLIP_BUNDLE_IDENTIFIER:-}"
TEXT="${POPCLIP_TEXT:-}"

# ── Validate bundle ID and check per-app option toggles ───────────────────────
# Bundle IDs are constrained to known safe values here; only then do we use
# $BUNDLE in osascript heredocs (no injection risk from untrusted input).
case "$BUNDLE" in
  com.microsoft.VSCode)
    [[ "${POPCLIP_OPTION_VSCODE:-1}" == "0" ]] && exit 1 ;;
  com.sublimetext.4|com.sublimetext.3)
    [[ "${POPCLIP_OPTION_SUBLIME:-1}" == "0" ]] && exit 1 ;;
  net.sourceforge.skim-app.skim)
    [[ "${POPCLIP_OPTION_SKIM:-1}" == "0" ]] && exit 1 ;;
  com.adobe.acrobat.pro|com.adobe.acrobat.pro.dc|com.adobe.acrobat)
    [[ "${POPCLIP_OPTION_ACROBAT:-1}" == "0" ]] && exit 1 ;;
  *) exit 1 ;;
esac

# ── Helper: Skim — native AppleScript (returns POSIX path) ────────────────────
get_skim_path() {
  osascript << 'APPLESCRIPT' 2>/dev/null || true
tell application "Skim"
  try
    if (count of documents) > 0 then
      path of front document
    else
      ""
    end if
  on error
    ""
  end try
end tell
APPLESCRIPT
}

# ── Helper: Accessibility API — returns file:// URL of the frontmost window ───
# $BUNDLE is validated to safe, known values before this function is called.
get_ax_document() {
  osascript << APPLESCRIPT 2>/dev/null || true
tell application "System Events"
  try
    set p to first process whose bundle identifier is "$BUNDLE"
    value of attribute "AXDocument" of window 1 of p
  on error
    ""
  end try
end tell
APPLESCRIPT
}

# ── Helper: convert POSIX path → file:// URL ──────────────────────────────────
posix_to_fileurl() {
  /usr/bin/python3 -c "
import sys, urllib.parse
print('file://' + urllib.parse.quote(sys.argv[1], safe='/'))
" "$1"
}

# ── Helper: extract basename from file:// URL (handles percent-encoding) ──────
basename_from_fileurl() {
  /usr/bin/python3 -c "
import sys, urllib.parse, os
url = sys.argv[1]
# Strip file:// prefix (7 chars); handles file:///path and file://localhost/path
path = url[7:] if url.startswith('file://') else url
path = path.lstrip('/')
# Restore leading slash for absolute POSIX path
path = '/' + path.split('/', 1)[-1] if '/' in path else path
path = urllib.parse.unquote(path)
print(os.path.basename(path))
" "$1"
}

# ── Main: get file URL for the frontmost document ─────────────────────────────
FILE_URL=""

case "$BUNDLE" in
  net.sourceforge.skim-app.skim)
    POSIX_PATH="$(get_skim_path)"
    if [[ -n "$POSIX_PATH" ]]; then
      FILE_URL="$(posix_to_fileurl "$POSIX_PATH")"
    fi
    ;;
  *)
    # VS Code, Sublime Text, Acrobat: Accessibility API returns a file:// URL.
    AX_DOC="$(get_ax_document)"
    if [[ -n "$AX_DOC" ]]; then
      # Normalize file://localhost/ → file:/// (some apps use the former)
      FILE_URL="${AX_DOC/file:\/\/localhost\//file:\/\/\/}"
    fi
    ;;
esac

# ── Format and emit result (captured by PopClip via after: copy-result) ───────
if [[ -z "$FILE_URL" ]]; then
  # Graceful fallback: no document path available (untitled buffer, etc.)
  printf '%s' "\"${TEXT}\""
else
  FILENAME="$(basename_from_fileurl "$FILE_URL")"
  printf '%s' "\"${TEXT}\" [${FILENAME}](${FILE_URL})"
fi
