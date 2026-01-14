// Skim Logic - JXA Version
// Run with: osascript -l JavaScript skim_logic.js <mode>

function run(argv) {
    const mode = argv[0]; // 'note', 'heading', 'highlight'

    const app = Application.currentApplication();
    app.includeStandardAdditions = true;

    // --- UTILS ---
    const runShell = (cmd) => {
        try {
            return app.doShellScript(cmd);
        } catch (e) {
            console.log("Shell Error: " + e.message);
            return "";
        }
    };

    // --- TEXT CLEANING ---
    const cleanText = (text) => {
        if (!text) return "";
        text = text.replace(/^[\uFEFF\u200B\u2060]+/, "");
        text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, " ");
        text = text.replace(/\s+/g, " ");
        text = text.replace(/^[\s,.-]+|[\s,.-]+$/g, "");

        // Substitutions
        text = text.replace(/primary treating physician/gi, 'PTP')
            .replace(/\bsigned\b/gi, '')
            .replace(/\bsigned by\b/gi, '')
            .replace(/\bClaffev\b/gi, 'Claffey');

        // Provider names
        text = text.replace(/\bDr\.?\s+([A-Z][a-z]+)\s+([A-Z][a-z]+),?\s*(MD|DO|NP|PA|DC|PhD)\.?\b/gi, "Dr. $2");

        // Medical
        text = text.replace(/\b(PANEL\s+)?(QUALIFIED|AGREED)\s+MEDICAL\s+EVALUAT(?:OR|ION)(S)?((\'S|S\')?)\b/gi, (m) => {
            return m.toUpperCase().includes('QUALIFIED') ? 'QME' : 'AME';
        });

        return text;
    };

    const extractDate = (text) => {
        let dateStr = "";
        const dateRegex = /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/;
        const match = text.match(dateRegex);
        if (match) {
            let [_, m, d, y] = match;
            y = parseInt(y);
            if (y < 100) y += 2000;
            dateStr = `${y}.${m.padStart(2, '0')}.${d.padStart(2, '0')}`;
            text = text.replace(match[0], "").replace(/\s+/g, " ").trim();
        }
        return { dateStr, text };
    };

    const generateRTF = (text, pageNum, url) => {
        const escapedText = text.replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}');
        const content = url ?
            `${escapedText} ({\\field{\\*\\fldinst{HYPERLINK "${url}"}}{\\fldrslt p.${pageNum}}})` :
            `${escapedText} (p.${pageNum})`;

        return `{\\rtf1\\ansi\\ansicpg1252\\cocoartf2709
{\\fonttbl\\f0\\fswiss\\fcharset0 Helvetica;}
{\\colortbl;\\red255\\green255\\blue255;}
\\pard\\tx560\\pardirnatural\\partightenfactor0
\\f0\\fs24 \\cf0 ${content}}`;
    };

    // --- SKIM INTERACTION ---
    const skim = Application("Skim");
    if (!skim.documents.length) return;

    const doc = skim.documents[0];
    const rawPath = doc.path(); // Returns POSIX path string directly in JXA? usually
    // JXA file handling can be tricky. doc.path() often fails if not saved.
    // doc.file() returns generic object.
    // Safe bet:
    let pdfPath = "";
    try {
        pdfPath = doc.file().toString(); // Returns path string
    } catch (e) {
        // Fallback or error
    }

    // Page Index
    const pageIndex = doc.currentPage().index(); // 1-based? Skim AS is 1-based usually. JXA?
    // Let's assume Skim provides proper index access.
    // AS `index of current page` -> `doc.currentPage().index()`
    // Actually, `currentPage` returns a Page object.
    // In JXA, properties are accessed via methods e.g. `doc.currentPage()`?
    // Wait, standard OSA properties: `doc.currentPage`.

    // CRITICAL: JXA syntax for Skim properties.
    // Skim sdef: `property current page : page`
    // `page` has `property index : integer`
    // So: `doc.currentPage().index()` is likely correct for JXA getter.
    // But sometimes it is `doc.currentPage.index`.

    // Selection
    // `selection` property of document.
    let selText = "";
    const sel = doc.selection(); // This gives a list of selections (usually rects/page) or text?
    // In AS `selection of document 1` returns list of specific selection objects.
    // Coercing to string: `selection as string` works in AS.
    // In JXA: `doc.selection()` returns array.
    // getting text content might require `doc.selection().get()[0].text()`? No.
    // Using `doc.selection().join(' ')`?

    // To be safe and avoid JXA specific object complexities for "Selection as String",
    // I will use a tiny internal AS block for just extracting the data string,
    // OR we trust `app.doShellScript` calling `osascript -e` for the extraction part if JXA is flaky.
    // Mixing JXA and AS is messy.
    // Let's stick to JXA where possible:
    // `skim.documents[0].selection().map(s => s.get()).join('')` ??

    // Fallback: Using `doShellScript` for reliable Data Extraction from Skim (AS is more robust for coercion).
    // It's cleaner given we are already running via osascript.

    const getDataScript = `tell application "Skim"
        set d to front document
        return (POSIX path of (path of d as string)) & "||" & (index of current page of d) & "||" & (selection of d as string)
    end tell`;
    const dataParts = runShell(`osascript -e '${getDataScript}'`).split("||");

    pdfPath = dataParts[0];
    const pageNum = parseInt(dataParts[1]); // AS returns 1-based index
    const rawText = dataParts[2];

    // --- LOGIC ---
    let text = cleanText(rawText);
    if (mode === 'note') {
        const d = extractDate(text);
        text = d.dateStr ? `${d.dateStr} - ${d.text}` : d.text;
    } else if (mode === 'heading') {
        text = `# ${text.toUpperCase()}`;
    } else if (mode === 'highlight') {
        text = `* ${text}`;
    }

    const fileUrl = `file://${encodeURI(pdfPath)}`;
    const rtf = generateRTF(text, pageNum, fileUrl);

    // --- ACTIONS ---

    // Backup MD
    const mdFile = pdfPath.replace(/\.pdf$/i, ".md");
    const entry = `\n\n${text} [p.${pageNum}](${fileUrl})`;
    // Append
    runShell(`echo ${JSON.stringify(entry)} >> "${mdFile}"`);

    // Clipboard - use printf with proper escaping for RTF
    const rtfEscaped = rtf.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
    runShell(`printf '%s' "${rtfEscaped}" | pbcopy -Prefer rtf && sleep 0.5`);

    // Skim Note Creation (AS is best for this due to UI scripting reliability)
    let asAction = "";
    const cleanJSON = JSON.stringify(text); // Safe string for AS

    if (mode === 'note') {
        asAction = `tell application "Skim"
            activate
            tell document 1 to tell page ${pageNum}
                set n to make note with properties {type:anchored note, text:${cleanJSON}, bounds:{0,0,0,0}}
            end tell
            edit n
            delay 0.5
        end tell
        try
            tell application "System Events" to tell process "Skim"
                set focused of (first window whose name starts with "Anchored Note") to true
                delay 0.1
                -- 3 tabs to text
                key code 48
                delay 0.05
                key code 48
                delay 0.05
                key code 48
                delay 0.1
                -- Paste
                key code 125 using command down
                keystroke return
                key code 9 using command down
            end tell
        end try`;
    } else {
        const type = (mode === 'heading') ? 'underline note' : 'highlight note';
        asAction = `try
    tell application "Skim"
        activate
        if not (exists document 1) then error "No PDF document is open in Skim."

        set activeDoc to document 1

        -- Capture the actual selection data FIRST while PDF window is still focused
        set selectionData to missing value
        try
            set selectionData to (get selection of activeDoc)
        end try

        set targetWindow to missing value
        set openedNote to false

        -- Strategy 1: Find an already-open note window for the active document.
        set openNoteWindows to {}
        repeat with aWindow in (every window)
            try
                if (name of aWindow starts with "Anchored Note") and (document of aWindow is activeDoc) then
                    set end of openNoteWindows to aWindow
                end if
            end try
        end repeat

        if (count of openNoteWindows) is 1 then
            set targetWindow to item 1 of openNoteWindows
        else if (count of openNoteWindows) > 1 then
            set newestWindow to item 1 of openNoteWindows
            repeat with i from 2 to (count of openNoteWindows)
                if id of item i of openNoteWindows > id of newestWindow then
                    set newestWindow to item i of openNoteWindows
                end if
            end repeat
            set targetWindow to newestWindow
        end if

        -- Strategy 2: If no window was found, find the most recently modified anchored note.
        if targetWindow is missing value then
            set openedNote to true
            set allNotes to notes of activeDoc
            if (count of allNotes) > 0 then
                set anchoredNotes to {}
                repeat with aNote in allNotes
                    try
                        if (type of aNote as string) contains "anchor" then
                            set end of anchoredNotes to aNote
                        end if
                    end try
                end repeat

                if (count of anchoredNotes) > 0 then
                    set mostRecentNote to item 1 of anchoredNotes
                    repeat with j from 2 to (count of anchoredNotes)
                        if (modification date of item j of anchoredNotes) > (modification date of mostRecentNote) then
                            set mostRecentNote to item j of anchoredNotes
                        end if
                    end repeat
                    edit mostRecentNote
                    delay 0.5
                else
                    tell application "System Events" to keystroke "e" using {command down, control down}
                    delay 0.5
                end if
            else
                tell application "System Events" to keystroke "e" using {command down, control down}
                delay 0.5
            end if
        end if

        -- Wait for note window to appear (safety loop with simpler timing)
        set windowFound to false
        repeat 40 times -- ~2 seconds at 0.05s intervals
            try
                repeat with aWindow in (every window)
                    try
                        if (name of aWindow starts with "Anchored Note") and (document of aWindow is activeDoc) then
                            set targetWindow to aWindow
                            set windowFound to true
                            exit repeat
                        end if
                    end try
                end repeat
                if windowFound then exit repeat
            end try
            delay 0.05
        end repeat

        if not windowFound then error "Anchored Note window did not appear."

        -- Create highlight/underline annotation with rotating color using captured selection
        if selectionData is not missing value then
            tell activeDoc
                set highlight_colors to {{65535, 65531, 2688, 32768}, {65535, 20000, 20000, 32768}, {20000, 65535, 20000, 32768}, {20000, 40000, 65535, 32768}, {65535, 20000, 65535, 32768}, {65535, 40000, 20000, 32768}}
                set note_count to count of notes
                set color_index to ((note_count mod 6) + 1)
                set next_color to item color_index of highlight_colors
                make note with data selectionData with properties {type:${type}, color:next_color}
            end tell
        end if

        -- Bring note window to focus
        set index of targetWindow to 1
        delay 0.2

        tell application "System Events"
            tell process "Skim"
                set noteWin to first window whose name starts with "Anchored Note"
                set focused of noteWin to true
                delay 0.1

                -- If note was newly opened, tab to text area
                if openedNote then
                    key code 48
                    delay 0.05
                    key code 48
                    delay 0.05
                    key code 48
                    delay 0.1
                end if

                -- Go to end, add spacing, and paste
                key code 125 using {command down}
                delay 0.05
                keystroke return
                key code 9 using {command down}
            end tell
        end tell

        -- Return focus to PDF
        delay 0.2
        repeat with aWindow in (every window)
            try
                if (document of aWindow is activeDoc) and (name of aWindow does not start with "Anchored Note") then
                    set index of aWindow to 1
                    exit repeat
                end if
            end try
        end repeat

    end tell
on error errMsg
    display notification "Paste Error: " & errMsg with title "Skim Paster"
end try`;
    }

    // Use a temporary file to avoid shell escaping issues with complex AppleScript
    const tmpFile = "/tmp/skim_script_" + Date.now() + ".applescript";
    runShell(`cat > "${tmpFile}" << 'EOF'\n${asAction}\nEOF`);
    runShell(`osascript "${tmpFile}"`);
    runShell(`rm -f "${tmpFile}"`);
    // runShell(`sleep 0.5 && echo "asAction was ${asAction}" | pbcopy && sleep 0.5`); // For debugging
}
