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

        return text.toUpperCase();
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
        text = `# ${text}`;
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

    // Clipboard
    runShell(`echo '${rtf}' | pbcopy -Prefer rtf`);

    // Skim Note Creation (AS is best for this due to UI scripting reliability)
    let asAction = "";
    const cleanJSON = JSON.stringify(text); // Safe string for AS

    if (mode === 'note') {
        asAction = `tell application "Skim"
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
                key code 125 using {command down}
                keystroke return
                key code 9 using {command down}
            end tell
        end try`;
    } else {
        const type = (mode === 'heading') ? 'underline note' : 'highlight note';
        asAction = `tell application "Skim"
            tell document 1
                make note with data (get selection) with properties {type:${type}}
                -- Find most recent anchored note
                set allNotes to (get notes whose type is anchored note)
                if allNotes is not {} then
                    set recent to item 1 of allNotes
                    repeat with n in allNotes
                        if (modification date of n) > (modification date of recent) then set recent to n
                    end repeat
                    edit recent
                    delay 0.2
                end if
            end tell
        end tell
        try
            tell application "System Events" to tell process "Skim"
                 set focused of (first window whose name starts with "Anchored Note") to true
                 delay 0.1
                 key code 125 using {command down}
                 keystroke return
                 ${(mode === 'highlight') ? 'keystroke tab' : ''}
                 key code 9 using {command down}
            end tell
        end try`;
    }

    runShell(`osascript -e '${asAction}'`);
}
