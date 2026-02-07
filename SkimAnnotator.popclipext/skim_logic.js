// Skim Logic - JXA Version
// Run with: osascript -l JavaScript skim_logic.js <mode>

function run(argv) {
    const mode = argv[0]; // 'record', 'heading', 'subheading', 'highlight'

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
            .replace(/\bmaximum medical improvement\b/gi, 'MMI')
            .replace(/\bpermanent and stationary\b/gi, 'P&S')
            .replace(/\bmagnetic resonance imaging\b/gi, 'MRI')
            .replace(/\belectromyography\b/gi, 'EMG')
            .replace(/\bnerve conduction velocity\b/gi, 'NCV')
            .replace(/\boccupational therapy\b/gi, 'OT')
            .replace(/\bphysical therapy\b/gi, 'PT')
            .replace(/\bfunctional capacity evaluation\b/gi, 'FCE')
            .replace(/\bactivities of daily living\b/gi, 'ADLs');

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
        const monthMap = {
            jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
            apr: '04', april: '04', may: '05', jun: '06', june: '06',
            jul: '07', july: '07', aug: '08', august: '08', sep: '09', sept: '09', september: '09',
            oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12'
        };

        // Try alphanumeric date first (e.g., "Jan 1 2024", "January 1, 2025")
        const alphaRegex = /(?:\s+(?:at|on|dated|from|of|for)\s+)?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{2,4})(?:\s*[-/:]\s*)?(?:\s*\d{1,2}:?\d{2})?/i;
        let match = text.match(alphaRegex);

        if (match) {
            let [fullMatch, month, d, y] = match;
            const m = monthMap[month.toLowerCase()];
            y = parseInt(y);
            if (y < 100) y += 2000;
            dateStr = `${y}.${m}.${d.padStart(2, '0')}`;
            text = text.replace(fullMatch, "").replace(/\s+/g, " ").trim();
        } else {
            // Try numeric date with various separators (/, -, .)
            const numericRegex = /(?:\s+(?:at|on|dated|from|of|for)\s+)?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:\s*[-/:]\s*)?(?:\s*\d{1,2}:?\d{2})?/;
            match = text.match(numericRegex);
            if (match) {
                let [fullMatch, m, d, y] = match;
                y = parseInt(y);
                if (y < 100) y += 2000;
                dateStr = `${y}.${m.padStart(2, '0')}.${d.padStart(2, '0')}`;
                text = text.replace(fullMatch, "").replace(/\s+/g, " ").trim();
            }
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
    if (mode === 'record') {
        const d = extractDate(text);
        let dateStr = d.dateStr || "";
        let baseText = d.dateStr ? d.text : text;

        if (!dateStr) {
            const dateInput = app.displayDialog('Add a date to this record?', {
                defaultAnswer: '',
                buttons: ['Cancel', 'OK'],
                defaultButton: 'OK',
                cancelButton: 'Cancel',
                withIcon: 'note'
            });

            if (dateInput.buttonReturned === 'OK' && dateInput.textReturned.trim()) {
                const dateMatch = dateInput.textReturned.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
                if (dateMatch) {
                    let [_, m, d, y] = dateMatch;
                    y = parseInt(y);
                    if (y < 100) y += 2000;
                    dateStr = `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
                }
            }
        }

        text = dateStr ? `${dateStr} - ${baseText}` : baseText;
        text = `# ${text}`;
    } else if (mode === 'heading') {
        text = `## ${text}`;
    } else if (mode === 'subheading') {
        text = `### ${text}`;
    } else if (mode === 'highlight') {
        text = `\t* ${text}`;
    }

    const fileUrl = `file://${encodeURI(pdfPath)}`;
    const rtf = generateRTF(text, pageNum, fileUrl);

    // --- ACTIONS ---

    // Backup MD
    const mdFile = pdfPath.replace(/\.pdf$/i, ".md");
    const mdExists = runShell(`[ -f "${mdFile}" ] && echo 1 || echo 0`).trim() === "1";
    const mdBaseName = mdFile.split("/").pop();
    // Determine formatting based on markdown line content
    const trimmed = text.replace(/^\s+/, '');
    const isHeading = /^#/.test(trimmed);
    const isBullet = /^\*/.test(trimmed);
    // Remove any leading tab before bullet for MD output only
    const mdLine = text.replace(/^\s*\t\*\s?/, '* ');
    // No blank line between bullets; one line break before headings/records
    const prefix = isBullet ? '' : '\n';
    const suffix = '';
    // Only add hyperlink for note mode; plain text page number for others
    const pageRef = (mode === 'record') ? `[p.${pageNum}](${fileUrl})` : `[p.${pageNum}]`;
    const entry = `${prefix}${mdLine} ${pageRef}${suffix}`;
    // Append
    runShell(`echo ${JSON.stringify(entry)} >> "${mdFile}"`);

    const isOpenInVSCode = () => {
        const directScript = `tell application "Visual Studio Code"
            try
                repeat with d in documents
                    try
                        if (path of d as text) is "${mdFile}" then return "1"
                    end try
                end repeat
                return "0"
            on error
                return "ERR"
            end try
        end tell`;

        const directResult = runShell(`osascript -e ${JSON.stringify(directScript)}`).trim();
        if (directResult === "1") return true;
        if (directResult === "0") return false;

        const fallbackScript = `tell application "System Events"
            if not (exists process "Code") then return "0"
            tell process "Code"
                repeat with w in windows
                    try
                        if (name of w) contains "${mdBaseName}" then return "1"
                    end try
                end repeat
            end tell
            return "0"
        end tell`;

        const fallbackResult = runShell(`osascript -e ${JSON.stringify(fallbackScript)}`).trim();
        return fallbackResult === "1";
    };

    if (!mdExists || !isOpenInVSCode()) {
        runShell(`open -a "Visual Studio Code" "${mdFile}"`);
    }

    // Clipboard - use printf with proper escaping for RTF
    const rtfEscaped = rtf.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
    runShell(`printf '%s' "${rtfEscaped}" | pbcopy -Prefer rtf && sleep 0.5`);

    // Skim Annotation Creation (no anchored note edits)
    let asAction = "";

    if (mode === 'highlight' || mode === 'record' || mode === 'heading' || mode === 'subheading') {
        const type = (mode === 'highlight') ? 'highlight note' : 'underline note';
        asAction = `try
    tell application "Skim"
        activate
        if not (exists document 1) then error "No PDF document is open in Skim."

        set activeDoc to document 1

        -- Capture the selection data and apply a highlight/underline without touching notes.
        set selectionData to missing value
        try
            set selectionData to (get selection of activeDoc)
        end try

        if selectionData is not missing value then
            tell activeDoc
                set highlight_colors to {{65535, 65531, 2688, 32768}, {65535, 20000, 20000, 32768}, {20000, 65535, 20000, 32768}, {20000, 40000, 65535, 32768}, {65535, 20000, 65535, 32768}, {65535, 40000, 20000, 32768}}
                set note_count to count of notes
                set color_index to ((note_count mod 6) + 1)
                set next_color to item color_index of highlight_colors
                make note with data selectionData with properties {type:${type}, color:next_color}
            end tell
        end if
    end tell
on error errMsg
    display notification "Highlight Error: " & errMsg with title "Skim Paster"
end try`;
    }

    // Use a temporary file to avoid shell escaping issues with complex AppleScript
    const tmpFile = "/tmp/skim_script_" + Date.now() + ".applescript";
    if (asAction) {
        runShell(`cat > "${tmpFile}" << 'EOF'\n${asAction}\nEOF`);
        runShell(`osascript "${tmpFile}"`);
        runShell(`rm -f "${tmpFile}"`);
    }
    // runShell(`sleep 0.5 && echo "asAction was ${asAction}" | pbcopy && sleep 0.5`); // For debugging
}
