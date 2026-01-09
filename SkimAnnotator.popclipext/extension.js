// Skim Annotator Extension - Optimized & No Hookmark

const runShell = (cmd) => popclip.shell(cmd).trim();

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

// --- RTF GENERATION ---
const generateRTF = (text, pageNum, url) => {
    const escapedText = text.replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}');
    // If URL is empty, don't create a hyperlink field, just show page num
    const content = url ?
        `${escapedText} ({\\field{\\*\\fldinst{HYPERLINK "${url}"}}{\\fldrslt p.${pageNum}}})` :
        `${escapedText} (p.${pageNum})`;

    return `{\\rtf1\\ansi\\ansicpg1252\\cocoartf2709
{\\fonttbl\\f0\\fswiss\\fcharset0 Helvetica;}
{\\colortbl;\\red255\\green255\\blue255;}
\\pard\\tx560\\pardirnatural\\partightenfactor0
\\f0\\fs24 \\cf0 ${content}}`;
};

// --- APPLESCRIPT ---
const getSkimInfo = () => {
    const script = `tell application "Skim"
        if not (exists front document) then return "ERR"
        set d to front document
        return (POSIX path of (path of d as string)) & "||" & (index of current page of d) & "||" & (selection of d as string)
    end tell`;
    const res = runShell(`osascript -e '${script}'`);
    if (res === "ERR") throw new Error("No Skim document");
    const p = res.split("||");
    return { path: p[0], page: p[1], text: p[2] || "" };
};

const performSkimAction = (type, text, pg, path) => {
    // REPLACEMENT: Use file:// link instead of Hookmark
    const fileUrl = `file://${encodeURI(path)}`;

    // Generate RTF with file link (or pass empty string to disable link entirely)
    // We'll keep the link to the PDF file as it's useful.
    const rtf = generateRTF(text, pg, fileUrl);

    // Backup (Append to MD)
    const mdFile = path.replace(/\.pdf$/i, ".md");
    // Markdown link
    const entry = `\n\n${text} [p.${pg}](${fileUrl})`;
    runShell(`echo ${JSON.stringify(entry)} >> "${mdFile}"`);

    // PBCOPY
    runShell(`echo '${rtf}' | pbcopy -Prefer rtf`);

    // ACTION
    let script = "";
    if (type === 'note') {
        script = `tell application "Skim"
            tell document 1 to tell page ${pg}
                set n to make note with properties {type:anchored note, text:${JSON.stringify(text)}, bounds:{0,0,0,0}}
            end tell
            edit n
            delay 0.5
        end tell
        tell application "System Events" to tell process "Skim"
            set focused of (first window whose name starts with "Anchored Note") to true
            delay 0.1
            key code 48
            delay 0.05
            key code 48
            delay 0.05
            key code 48
            delay 0.1
            key code 125 using {command down}
            keystroke return
            key code 9 using {command down}
        end tell`;
    } else {
        const nType = (type === 'heading') ? 'underline note' : 'highlight note';
        script = `tell application "Skim"
            tell document 1
                make note with data (get selection) with properties {type:${nType}}
                -- Find recent anchored note
                set allNotes to (get notes whose type is anchored note)
                if allNotes is {} then error "No anchored note found"
                set recent to item 1 of allNotes
                repeat with n in allNotes
                    if (modification date of n) > (modification date of recent) then set recent to n
                end repeat
                edit recent
                delay 0.2
            end tell
        end tell
        tell application "System Events" to tell process "Skim"
             set focused of (first window whose name starts with "Anchored Note") to true
             delay 0.1
             key code 125 using {command down}
             keystroke return
             ${(type === 'highlight') ? 'keystroke tab' : ''}
             key code 9 using {command down}
        end tell`;
    }
    runShell(`osascript -e '${script}'`);
};

exports.addNote = () => {
    const i = getSkimInfo();
    let t = cleanText(i.text);
    const d = extractDate(t);
    t = d.dateStr ? `${d.dateStr} - ${d.text}` : d.text;
    performSkimAction('note', t, i.page, i.path);
};

exports.addHeading = () => {
    const i = getSkimInfo();
    performSkimAction('heading', `# ${cleanText(i.text)}`, i.page, i.path);
};

exports.addHighlight = () => {
    const i = getSkimInfo();
    performSkimAction('highlight', `* ${cleanText(i.text)}`, i.page, i.path);
};
