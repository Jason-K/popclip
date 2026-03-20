function loadSkimUtilityBundle(deps) {
    const runShell = deps.runShell;
    const shellQuote = deps.shellQuote;
    const scriptDir = deps.scriptDir;

    const loadUtilityFactory = (fileName, factoryName) => {
        const utilPath = `${scriptDir}/${fileName}`;
        const source = runShell(`cat ${shellQuote(utilPath)}`);
        const factory = eval(`${source}\n${factoryName};`);
        if (typeof factory !== "function") {
            throw new Error(`Utility factory ${factoryName} was not defined by ${fileName}.`);
        }
        return factory;
    };

    const createOcrUtils = loadUtilityFactory("util_ocr.js", "createOcrUtils");
    const createOcrFixUtils = loadUtilityFactory("util_ocr_fix.js", "createOcrFixUtils");
    const createDateUtils = loadUtilityFactory("util_date.js", "createDateUtils");
    const createSkimUtils = loadUtilityFactory("util_skim.js", "createSkimUtils");
    const createFsUtils = loadUtilityFactory("util_fs.js", "createFsUtils");
    const createRenderUtils = loadUtilityFactory("util_render.js", "createRenderUtils");

    const ocrUtils = createOcrUtils();
    const ocrFixUtils = createOcrFixUtils();
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
        ocrFixUtils,
        dateUtils,
        skimUtils,
        fsUtils,
        renderUtils
    };
}
