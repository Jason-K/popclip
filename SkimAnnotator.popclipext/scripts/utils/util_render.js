function createRenderUtils(deps) {
    const cleanInlineText = deps.cleanInlineText;
    const fixOcrHeadingNoise = deps.fixOcrHeadingNoise;
    const quickOcrCorrectHeader = deps.quickOcrCorrectHeader;
    const fileExists = deps.fileExists;
    const readTextFile = deps.readTextFile;
    const writeTextFile = deps.writeTextFile;

    const escapeMarkdownLinkText = (text) => String(text || "")
        .replace(/\\/g, "\\\\")
        .replace(/\[/g, "\\[")
        .replace(/\]/g, "\\]");

    const ensurePrimaryHeading = (mdFile, primaryHeadingLine, fileUrl) => {
        const primaryTrimmed = primaryHeadingLine.trim();
        if (!fileExists(mdFile)) {
            writeTextFile(mdFile, `${primaryHeadingLine}\n\n`);
            return { created: true, changed: true };
        }

        const existingContent = readTextFile(mdFile).replace(/^\uFEFF/, "");
        if (!existingContent.trim()) {
            writeTextFile(mdFile, `${primaryHeadingLine}\n\n`);
            return { created: false, changed: true };
        }

        const normalized = existingContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        const firstLine = (normalized.split("\n")[0] || "").trim();
        const firstLineHasPdfLink = /^#\s+.+\(.+\)$/.test(firstLine) && firstLine.includes(`(${fileUrl})`);
        if (firstLine === primaryTrimmed || firstLineHasPdfLink) {
            return { created: false, changed: false };
        }

        const body = normalized.replace(/^\n+/, "");
        const nextContent = `${primaryHeadingLine}\n\n${body}`;
        writeTextFile(mdFile, nextContent.endsWith("\n") ? nextContent : `${nextContent}\n`);
        return { created: false, changed: true };
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

    const detectSubdocumentFromText = (text) => {
        const clean = cleanInlineText(text);
        if (!clean) return "";

        const sentence = clean.split(/[.;:!?]/)[0].trim();
        const words = sentence.split(/\s+/).slice(0, 8).join(" ");
        return words;
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
            const chosenHeading = modeValue === "h2" && String(subdoc || "").trim()
                ? quickOcrCorrectHeader(cleanInlineText(subdoc))
                : quickOcrCorrectHeader(headingText);
            visible = `${hashes} ${chosenHeading} ${pageRef}`;
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

        visible = `* ${headingText} ${pageRef}`;
        return { visible, includeMetadata: true };
    };

    const normalizeEntryBlock = (value) => String(value || "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trim();

    return {
        escapeMarkdownLinkText,
        ensurePrimaryHeading,
        generateRTF,
        buildMetadataComment,
        detectSubdocumentFromText,
        renderEntry,
        normalizeEntryBlock
    };
}
