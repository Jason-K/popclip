// Skim Logic - Markdown-first workflow
// Run with: osascript -l JavaScript skim_logic.js <mode>

function run(argv) {
    const mode = argv[0] || "h2";

    const app = Application.currentApplication();
    app.includeStandardAdditions = true;

    const notify = (message) => {
        try {
            app.displayNotification(message, { withTitle: "Skim Bookmarker" });
        } catch (e) {
            console.log(message);
        }
    };

    const shellQuote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;

    const runShell = (cmd) => {
        try {
            return app.doShellScript(cmd);
        } catch (e) {
            throw new Error(e.message);
        }
    };

    const cleanInlineText = (text) => {
        if (!text) return "";

        let output = text.replace(/^[\uFEFF\u200B\u2060]+/, "");
        output = output.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, " ");
        output = output.replace(/\s+/g, " ").trim();
        output = output.replace(/^[,.-]+|[,.-]+$/g, "").trim();

        output = output.replace(/primary treating physician/gi, "PTP")
            .replace(/\bsigned by\b/gi, "")
            .replace(/\bsigned\b/gi, "")
            .replace(/\bmaximum medical improvement\b/gi, "MMI")
            .replace(/\bpermanent and stationary\b/gi, "P&S")
            .replace(/\bmagnetic resonance imaging\b/gi, "MRI")
            .replace(/\belectromyography\b/gi, "EMG")
            .replace(/\bnerve conduction velocity\b/gi, "NCV")
            .replace(/\boccupational therapy\b/gi, "OT")
            .replace(/\bphysical therapy\b/gi, "PT")
            .replace(/\bfunctional capacity evaluation\b/gi, "FCE")
            .replace(/\bactivities of daily living\b/gi, "ADLs")
            .replace(/\bDr\.?\s+([A-Z][a-z]+)\s+([A-Z][a-z]+),?\s*(MD|DO|NP|PA|DC|PhD)\.?\b/gi, "Dr. $2")
            .replace(/\b(PANEL\s+)?(QUALIFIED|AGREED)\s+MEDICAL\s+EVALUAT(?:OR|ION)(S)?((\'S|S\')?)\b/gi, (m) => {
                return m.toUpperCase().includes("QUALIFIED") ? "QME" : "AME";
            })
            .replace(/\s{2,}/g, " ")
            .trim();

        return output;
    };

    const fixOcrHeadingNoise = (text) => {
        if (!text) return "";

        let output = text;
        const looksLikeHeading = /^[A-Z0-9\s&'.,:/()-]+$/.test(output) || /^[A-Z]{2,}\b/.test(output);
        if (!looksLikeHeading) return output;

        // Conservative corrections for common dropped-leading-letter OCR artifacts.
        output = output
            .replace(/^YPE\b/, "TYPE")
            .replace(/^ASE\b/, "CASE")
            .replace(/^TIPULATIONS\b/, "STIPULATIONS")
            .replace(/^HE\s+FOLLOWING\b/, "THE FOLLOWING")
            .replace(/^RE-TRIAL\b/, "PRE-TRIAL");

        return output;
    };

    const cleanQuoteText = (text) => {
        if (!text) return "";

        const lines = text
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .map((line) => cleanInlineText(line));

        return lines.join("\n");
    };

    const escapeRtf = (text) => text
        .replace(/\\/g, "\\\\")
        .replace(/{/g, "\\{")
        .replace(/}/g, "\\}")
        .replace(/\n/g, "\\line ");

    const generateRTF = (plainText, pageNum, url) => {
        const escapedText = escapeRtf(plainText);
        const escapedUrl = escapeRtf(url || "");
        const content = url
            ? `${escapedText} ({\\field{\\*\\fldinst{HYPERLINK "${escapedUrl}"}}{\\fldrslt p.${pageNum}}})`
            : `${escapedText} (p.${pageNum})`;

        return `{\\rtf1\\ansi\\ansicpg1252\n{\\fonttbl\\f0\\fswiss\\fcharset0 Helvetica;}\n\\f0\\fs24 ${content}}`;
    };

    const metadataValue = (value) => {
        const normalized = String(value || "").replace(/\s+/g, " ").trim();
        if (!normalized) return '""';
        return `"${normalized.replace(/"/g, "'")}"`;
    };

    const buildMetadataComment = ({ source, page, subdoc, modeValue }) => {
        const pieces = [
            `source:${metadataValue(source)}`,
            `page:${Number.isFinite(page) ? page : 0}`,
            `subdoc:${metadataValue(subdoc || "")}`,
            `mode:${metadataValue(modeValue)}`
        ];
        return `<!-- ${pieces.join(" ")} -->`;
    };

    const promptSubdocument = (defaultValue) => {
        const result = app.displayDialog("Subdocument label", {
            defaultAnswer: defaultValue || "",
            buttons: ["Cancel", "Use"],
            defaultButton: "Use",
            cancelButton: "Cancel",
            withIcon: "note"
        });

        return (result.textReturned || "").trim();
    };

    const detectSubdocumentFromText = (text) => {
        const clean = cleanInlineText(text);
        if (!clean) return "";

        const sentence = clean.split(/[.;:!?]/)[0].trim();
        const words = sentence.split(/\s+/).slice(0, 8).join(" ");
        return words;
    };

    const loadState = (statePath) => {
        try {
            const raw = runShell(`cat ${shellQuote(statePath)}`);
            return JSON.parse(raw);
        } catch (e) {
            return {};
        }
    };

    const saveState = (statePath, state) => {
        const json = JSON.stringify(state);
        runShell(`printf '%s' ${shellQuote(json)} > ${shellQuote(statePath)}`);
    };

    const extractSkimData = () => {
        const getDataScript = `tell application "Skim"
            if not (exists front document) then return "||0||"
            set d to front document
            set pdfPath to POSIX path of (path of d as string)
            set pageNum to index of current page of d
            set selectedText to ""
            try
                set selectedText to (selection of d as string)
            end try
            return pdfPath & "||" & pageNum & "||" & selectedText
        end tell`;

        const output = runShell(`osascript -e ${shellQuote(getDataScript)}`);
        const parts = output.split("||");

        return {
            pdfPath: (parts[0] || "").trim(),
            pageNum: parseInt(parts[1], 10),
            rawText: parts.slice(2).join("||")
        };
    };

    const renderEntry = ({ modeValue, cleanedInline, cleanedQuote, pageNum, fileUrl, pdfName, subdoc }) => {
        const pageRef = `[p.${pageNum}]`;
        let visible = "";

        const headingText = fixOcrHeadingNoise(cleanedInline);

        if (modeValue === "doc_header") {
            const docHeading = subdoc || headingText || pdfName;
            visible = `# ${docHeading}\n[${pdfName}](${fileUrl})`;
            return { visible, includeMetadata: false };
        }

        if (modeValue === "h2" || modeValue === "h3" || modeValue === "h4" || modeValue === "h5" || modeValue === "h6") {
            const level = Number(modeValue.slice(1));
            const hashes = "#".repeat(level);
            visible = `${hashes} ${headingText} ${pageRef}`;
            return { visible, includeMetadata: true };
        }

        if (modeValue === "blockquote") {
            const quotedLines = (cleanedQuote || cleanedInline)
                .split("\n")
                .map((line) => `> ${line}`)
                .join("\n");
            visible = `${quotedLines}\n> ${pageRef}`;
            return { visible, includeMetadata: true };
        }

        if (modeValue === "inline_quote") {
            visible = `\"${headingText}\" ${pageRef}`;
            return { visible, includeMetadata: true };
        }

        // highlight fallback
        visible = `* ${headingText} ${pageRef}`;
        return { visible, includeMetadata: true };
    };

    const normalizeEntryBlock = (value) => String(value || "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trim();

    const getLastEntryBlock = (mdFile) => {
        try {
            const tail = runShell(`tail -n 80 ${shellQuote(mdFile)} 2>/dev/null || true`);
            const normalizedTail = tail.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
            if (!normalizedTail) return "";

            const blocks = normalizedTail.split(/\n\s*\n+/).map((item) => item.trim()).filter(Boolean);
            return blocks.length ? blocks[blocks.length - 1] : "";
        } catch (e) {
            return "";
        }
    };

    const isOpenInVSCode = (mdFile, mdBaseName) => {
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

        const directResult = runShell(`osascript -e ${shellQuote(directScript)}`).trim();
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

        const fallbackResult = runShell(`osascript -e ${shellQuote(fallbackScript)}`).trim();
        return fallbackResult === "1";
    };

    const createSkimAnnotation = (modeValue) => {
        const noteType = (modeValue === "highlight" || modeValue === "blockquote" || modeValue === "inline_quote")
            ? "highlight note"
            : "underline note";

        const asAction = `try
    tell application "Skim"
        activate
        if not (exists document 1) then error "No PDF document is open in Skim."

        set activeDoc to document 1
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
                make note with data selectionData with properties {type:${noteType}, color:next_color}
            end tell
        end if
    end tell
on error errMsg
    display notification "Highlight Error: " & errMsg with title "Skim Bookmarker"
end try`;

        const tmpFile = `/tmp/skim_script_${Date.now()}_${Math.floor(Math.random() * 100000)}.applescript`;
        runShell(`cat > ${shellQuote(tmpFile)} << 'EOF'\n${asAction}\nEOF`);
        runShell(`osascript ${shellQuote(tmpFile)}`);
        runShell(`rm -f ${shellQuote(tmpFile)}`);
    };

    try {
        const skim = Application("Skim");
        if (!skim.running()) {
            notify("Skim is not running.");
            return;
        }

        const skimData = extractSkimData();
        const pdfPath = skimData.pdfPath;
        const pageNum = skimData.pageNum;
        const rawText = skimData.rawText || "";

        if (!pdfPath || !Number.isFinite(pageNum)) {
            notify("Could not read PDF path or page from Skim.");
            return;
        }

        if (mode !== "doc_header" && !rawText.trim()) {
            notify("No selected text in Skim.");
            return;
        }

        const mdFile = pdfPath.replace(/\.pdf$/i, ".md");
        const mdBaseName = mdFile.split("/").pop() || "";
        const pdfName = pdfPath.split("/").pop() || "source.pdf";
        const fileUrl = `file://${encodeURI(pdfPath)}`;
        const statePath = "/tmp/skim_bookmarker_state.json";

        const cleanedInline = cleanInlineText(rawText);
        const cleanedQuote = cleanQuoteText(rawText);

        const state = loadState(statePath);
        const priorSubdoc = state[pdfPath] || "";

        let subdoc = priorSubdoc;
        if (mode === "doc_header" || mode === "h2") {
            const guessed = detectSubdocumentFromText(rawText);
            const defaultSubdoc = guessed || priorSubdoc || cleanedInline || pdfName;
            try {
                subdoc = promptSubdocument(defaultSubdoc);
            } catch (e) {
                // User canceled the prompt.
                return;
            }

            if (subdoc) {
                state[pdfPath] = subdoc;
                saveState(statePath, state);
            }
        }

        const rendered = renderEntry({
            modeValue: mode,
            cleanedInline,
            cleanedQuote,
            pageNum,
            fileUrl,
            pdfName,
            subdoc
        });

        const metadata = buildMetadataComment({
            source: pdfName,
            page: pageNum,
            subdoc,
            modeValue: mode
        });

        const entry = rendered.includeMetadata
            ? `\n${rendered.visible}\n${metadata}`
            : `\n${rendered.visible}`;

        const candidateBlock = normalizeEntryBlock(rendered.includeMetadata
            ? `${rendered.visible}\n${metadata}`
            : rendered.visible);

        const lastEntryBlock = getLastEntryBlock(mdFile);
        if (candidateBlock && candidateBlock === normalizeEntryBlock(lastEntryBlock)) {
            notify(`Skipped duplicate capture for page ${pageNum}.`);
            return;
        }

        runShell(`printf '%s\n' ${shellQuote(entry)} >> ${shellQuote(mdFile)}`);

        const clipboardText = rendered.visible.replace(/\n+/g, " ").trim();
        const rtf = generateRTF(clipboardText, pageNum, fileUrl);
        runShell(`printf '%s' ${shellQuote(rtf)} | pbcopy -Prefer rtf`);

        createSkimAnnotation(mode);

        const mdExists = runShell(`[ -f ${shellQuote(mdFile)} ] && echo 1 || echo 0`).trim() === "1";
        if (!mdExists || !isOpenInVSCode(mdFile, mdBaseName)) {
            runShell(`open -a "Visual Studio Code" ${shellQuote(mdFile)}`);
        }

        notify(`Captured page ${pageNum} to ${mdBaseName}.`);
    } catch (e) {
        notify(`Export failed: ${e.message}`);
        console.log(e.message);
    }
}
