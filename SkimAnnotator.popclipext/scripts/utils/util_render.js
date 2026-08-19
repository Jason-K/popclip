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

    const capitalizeHeading = (value) => {
            return String(value || "")
              .replace(/\s+/g, " ")
              .trim()
              .toUpperCase();
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
            const docHeading = capitalizeHeading(
              subdoc || headingText || pdfName,
            );
            visible = `# ${docHeading}\n[${pdfName}](${fileUrl})`;
            return { visible };
        }

        if (modeValue === "h2" || modeValue === "h3" || modeValue === "h4" || modeValue === "h5" || modeValue === "h6") {
            const level = Number(modeValue.slice(1));
            const hashes = "#".repeat(level);
            const chosenHeading = modeValue === "h2" && String(subdoc || "").trim()
                ? quickOcrCorrectHeader(cleanInlineText(subdoc))
                : quickOcrCorrectHeader(headingText);
            visible = `${hashes} ${capitalizeHeading(chosenHeading)} ${pageRef}`;
            return { visible };
        }

        if (modeValue === "blockquote") {
            const quotedLines = (cleanedQuote || cleanedInline)
                .split("\n")
                .map((line) => `> ${line}`)
                .join("\n");
            visible = `${quotedLines}\n> ${pageRef}`;
            return { visible };
        }

        if (modeValue === "inline_quote") {
            visible = `\"${headingText}\" ${pageRef}`;
            return { visible };
        }

        visible = `- ${headingText} ${pageRef}`;
        return { visible };
    };

    const normalizeEntryBlock = (value) => String(value || "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trim();

    const extractCitation = (line) => {
        const text = String(line || "").trim();
        const bracketMatch = text.match(/\s*\[(?:pp?\.?\s*)(\d+)(?:\s*[\u2013\u2014-]\s*(\d+))?\]\s*$/i);
        if (bracketMatch) {
            const startPage = parseInt(bracketMatch[1], 10);
            const endPage = bracketMatch[2] ? parseInt(bracketMatch[2], 10) : startPage;
            const textWithoutCitation = text.slice(0, bracketMatch.index).trim();
            return { textWithoutCitation, startPage, endPage, rawCitation: bracketMatch[0].trim(), isParen: false };
        }

        const parenMatch = text.match(/\s*\((?:pp?\.?\s*)(\d+)(?:\s*[\u2013\u2014-]\s*(\d+))?\)\s*$/i);
        if (parenMatch) {
            const startPage = parseInt(parenMatch[1], 10);
            const endPage = parenMatch[2] ? parseInt(parenMatch[2], 10) : startPage;
            const textWithoutCitation = text.slice(0, parenMatch.index).trim();
            return { textWithoutCitation, startPage, endPage, rawCitation: parenMatch[0].trim(), isParen: true };
        }

        return { textWithoutCitation: text, startPage: null, endPage: null, rawCitation: "", isParen: false };
    };

    const mergePageCitations = (startPage, endPage, newPageNum) => {
        const p = parseInt(newPageNum, 10);
        if (startPage !== null && !isNaN(startPage)) {
            const s = parseInt(startPage, 10);
            const e = (endPage !== null && !isNaN(endPage)) ? parseInt(endPage, 10) : s;
            const minPage = Math.min(s, e, p);
            const maxPage = Math.max(s, e, p);
            const pageLabel = minPage === maxPage ? String(minPage) : `${minPage}-${maxPage}`;
            const citation = `[p.${pageLabel}]`;
            const pageChanged = !(s === p && e === p);
            return { minPage, maxPage, pageLabel, citation, pageChanged };
        }

        const pageLabel = String(p);
        return { minPage: p, maxPage: p, pageLabel, citation: `[p.${pageLabel}]`, pageChanged: false };
    };

    const mergeBulletText = (baseText, additionText, pageChanged) => {
        let base = String(baseText || "").trim();
        let addition = String(additionText || "").trim();

        if (!base) return addition;
        if (!addition) return base;

        // Check if base is wrapped in quotes: e.g. - "some text" or "some text"
        const quotedBulletMatch = base.match(/^(\s*[-*+]\s+)"([\s\S]*)"$/);
        const quotedNoPrefixMatch = !quotedBulletMatch ? base.match(/^"([\s\S]*)"$/) : null;

        if (quotedBulletMatch || quotedNoPrefixMatch) {
            const prefix = quotedBulletMatch ? quotedBulletMatch[1] : "";
            let innerBase = quotedBulletMatch ? quotedBulletMatch[2] : quotedNoPrefixMatch[1];
            let innerAddition = addition;
            if (innerAddition.startsWith('"')) innerAddition = innerAddition.slice(1).trim();
            if (innerAddition.endsWith('"')) innerAddition = innerAddition.slice(0, -1).trim();

            let joined = "";
            if (!pageChanged) {
                innerBase = innerBase.replace(/\.+$/, "").trim();
                joined = `${innerBase} ... ${innerAddition}`;
            } else {
                if (innerBase.endsWith("-") && /[a-zA-Z]-$/.test(innerBase) && /^[a-zA-Z]/.test(innerAddition)) {
                    joined = innerBase.slice(0, -1) + innerAddition;
                } else if (/^[.,;:!?]/.test(innerAddition)) {
                    joined = innerBase + innerAddition;
                } else {
                    joined = `${innerBase} ${innerAddition}`;
                }
            }

            return `${prefix}"${joined}"`;
        }

        // Unclosed opening quote: e.g. - "Some text
        const unclosedBulletMatch = base.match(/^(\s*[-*+]\s+)"([\s\S]*)$/);
        if (unclosedBulletMatch) {
            const prefix = unclosedBulletMatch[1];
            let innerBase = unclosedBulletMatch[2];
            let innerAddition = addition;
            if (innerAddition.startsWith('"')) innerAddition = innerAddition.slice(1).trim();
            if (innerAddition.endsWith('"')) innerAddition = innerAddition.slice(0, -1).trim();

            let joined = "";
            if (!pageChanged) {
                innerBase = innerBase.replace(/\.+$/, "").trim();
                joined = `${innerBase} ... ${innerAddition}`;
            } else {
                if (innerBase.endsWith("-") && /[a-zA-Z]-$/.test(innerBase) && /^[a-zA-Z]/.test(innerAddition)) {
                    joined = innerBase.slice(0, -1) + innerAddition;
                } else if (/^[.,;:!?]/.test(innerAddition)) {
                    joined = innerBase + innerAddition;
                } else {
                    joined = `${innerBase} ${innerAddition}`;
                }
            }

            return `${prefix}"${joined}"`;
        }

        // Standard bullet or unquoted text
        if (!pageChanged) {
            const cleanedBase = base.replace(/\.+$/, "").trim();
            return `${cleanedBase} ... ${addition}`;
        }

        if (base.endsWith("-") && /[a-zA-Z]-$/.test(base) && /^[a-zA-Z]/.test(addition)) {
            return base.slice(0, -1) + addition;
        } else if (/^[.,;:!?]/.test(addition)) {
            return base + addition;
        }

        return `${base} ${addition}`;
    };

    const updateBulletWithAppend = (existingBulletLine, newText, newPageNum) => {
        const parsed = extractCitation(existingBulletLine);
        const pageInfo = mergePageCitations(parsed.startPage, parsed.endPage, newPageNum);
        const mergedText = mergeBulletText(parsed.textWithoutCitation, newText, pageInfo.pageChanged);
        const updatedLine = `${mergedText} ${pageInfo.citation}`;
        return {
            updatedLine,
            mergedPageLabel: pageInfo.pageLabel,
            mergedCitation: pageInfo.citation,
            fullMergedText: mergedText,
            pageChanged: pageInfo.pageChanged
        };
    };

    return {
      escapeMarkdownLinkText,
      capitalizeHeading,
      ensurePrimaryHeading,
      generateRTF,
      detectSubdocumentFromText,
      renderEntry,
      normalizeEntryBlock,
      extractCitation,
      mergePageCitations,
      mergeBulletText,
      updateBulletWithAppend,
    };
}
