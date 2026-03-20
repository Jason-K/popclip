// Skim Logic - Markdown-first workflow
// Run with: osascript -l JavaScript skim_logic.js <mode>

function skimRun(argv) {
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
    const resolveScriptDir = () => {
        const args = $.NSProcessInfo.processInfo.arguments;
        const argCount = ObjC.unwrap(args.count);
        for (let i = argCount - 1; i >= 0; i -= 1) {
            const candidate = ObjC.unwrap(args.objectAtIndex(i));
            if (typeof candidate === "string" && /\.js$/i.test(candidate)) {
                return ObjC.unwrap($(candidate).stringByDeletingLastPathComponent);
            }
        }
        throw new Error("Could not resolve current script path from process arguments.");
    };

    const scriptDir = resolveScriptDir();

    const loaderPath = `${scriptDir}/util_loader.js`;
    const loaderSource = runShell(`cat ${shellQuote(loaderPath)}`);
    eval(loaderSource);

    const {
        ocrUtils,
        dateUtils,
        skimUtils,
        fsUtils,
        renderUtils
    } = loadSkimUtilityBundle({ runShell, shellQuote, scriptDir });

    const cleanInlineText = ocrUtils.cleanInlineText;
    const fixOcrHeadingNoise = ocrUtils.fixOcrHeadingNoise;
    const quickOcrCorrectHeader = ocrUtils.quickOcrCorrectHeader;
    const cleanQuoteText = ocrUtils.cleanQuoteText;
    const buildLevel1PromptDefault = dateUtils.buildLevel1PromptDefault;
    const extractSkimData = skimUtils.extractSkimData;
    const createSkimAnnotation = skimUtils.createSkimAnnotation;

    const fileExists = fsUtils.fileExists;
    const readTextFile = fsUtils.readTextFile;
    const writeTextFile = fsUtils.writeTextFile;
    const appendTextFile = fsUtils.appendTextFile;
    const loadState = fsUtils.loadState;
    const saveState = fsUtils.saveState;
    const getLastEntryBlock = fsUtils.getLastEntryBlock;
    const isOpenInVSCode = fsUtils.isOpenInVSCode;

    const escapeMarkdownLinkText = renderUtils.escapeMarkdownLinkText;
    const ensurePrimaryHeading = renderUtils.ensurePrimaryHeading;
    const generateRTF = renderUtils.generateRTF;
    const buildMetadataComment = renderUtils.buildMetadataComment;
    const detectSubdocumentFromText = renderUtils.detectSubdocumentFromText;
    const renderEntry = renderUtils.renderEntry;
    const normalizeEntryBlock = renderUtils.normalizeEntryBlock;


    const promptLevel1Heading = (defaultValue) => {
        const result = app.displayDialog("Level 1 heading", {
            defaultAnswer: defaultValue || "",
            buttons: ["Cancel", "Add"],
            defaultButton: "Add",
            cancelButton: "Cancel",
            withIcon: "note"
        });

        return (result.textReturned || "").trim();
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
        const escapedPdfName = escapeMarkdownLinkText(pdfName);
        const statePath = "/tmp/skim_bookmarker_state.json";

        const cleanedInline = cleanInlineText(rawText);
        const cleanedQuote = cleanQuoteText(rawText);

        const state = loadState(statePath);
        const priorSubdoc = state[pdfPath] || "";

        if (mode === "doc_header") {
            const primaryHeadingLine = `# [${escapedPdfName}](${fileUrl})`;
            ensurePrimaryHeading(mdFile, primaryHeadingLine, fileUrl);
            const defaultHeading = buildLevel1PromptDefault(rawText, pdfName);
            let headingText = "";

            try {
                headingText = promptLevel1Heading(defaultHeading);
            } catch (e) {
                runShell(`open -a "Visual Studio Code" ${shellQuote(mdFile)}`);
                notify(`Prepared ${mdBaseName}.`);
                return;
            }

            if (!headingText) {
                runShell(`open -a "Visual Studio Code" ${shellQuote(mdFile)}`);
                notify("No heading entered.");
                return;
            }

            const escapedHeadingText = escapeMarkdownLinkText(headingText);
            const level1Line = `# [${escapedHeadingText}](${fileUrl})`;
            const mdContent = readTextFile(mdFile);
            if (!mdContent.includes(level1Line)) {
                appendTextFile(mdFile, `\n${level1Line}\n`);
            }

            runShell(`open -a "Visual Studio Code" ${shellQuote(mdFile)}`);

            if (rawText.trim()) {
                createSkimAnnotation(mode);
            }

            notify(`Added level 1 heading to ${mdBaseName}.`);
            return;
        }

        let subdoc = priorSubdoc;
        if (mode === "h2") {
            const guessed = detectSubdocumentFromText(rawText);
            const defaultSubdoc = guessed || priorSubdoc || cleanedInline || pdfName;
            try {
                subdoc = promptSubdocument(quickOcrCorrectHeader(defaultSubdoc));
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
