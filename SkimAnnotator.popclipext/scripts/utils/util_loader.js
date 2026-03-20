function loadSkimUtilityBundle(deps) {
    const runShell = deps.runShell;
    const shellQuote = deps.shellQuote;
    const scriptDir = deps.scriptDir;

    const loadUtilityScript = (fileName) => {
        const utilPath = `${scriptDir}/${fileName}`;
        const source = runShell(`cat ${shellQuote(utilPath)}`);
        eval(source);
    };

    loadUtilityScript("util_ocr.js");
    loadUtilityScript("util_date.js");
    loadUtilityScript("util_skim.js");
    loadUtilityScript("util_fs.js");
    loadUtilityScript("util_render.js");

    const ocrUtils = createOcrUtils();
    const dateUtils = createDateUtils({
        cleanInlineText: ocrUtils.cleanInlineText,
        quickOcrCorrectHeader: ocrUtils.quickOcrCorrectHeader
    });
    const skimUtils = createSkimUtils({ runShell, shellQuote });
    const fsUtils = createFsUtils({ runShell, shellQuote });
    const renderUtils = createRenderUtils({
        cleanInlineText: ocrUtils.cleanInlineText,
        fixOcrHeadingNoise: ocrUtils.fixOcrHeadingNoise,
        quickOcrCorrectHeader: ocrUtils.quickOcrCorrectHeader,
        fileExists: fsUtils.fileExists,
        readTextFile: fsUtils.readTextFile,
        writeTextFile: fsUtils.writeTextFile
    });

    return {
        ocrUtils,
        dateUtils,
        skimUtils,
        fsUtils,
        renderUtils
    };
}
