// Skim action runner - executes shared core for a fixed mode.
ObjC.import("Foundation");

function runMode(mode) {
    const app = Application.currentApplication();
    app.includeStandardAdditions = true;

    const shellQuote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;

    const args = $.NSProcessInfo.processInfo.arguments;
    const scriptPath = ObjC.unwrap(args.objectAtIndex(3));
    const scriptDir = ObjC.unwrap($(scriptPath).stringByDeletingLastPathComponent);
    const corePath = `${scriptDir}/../core/skim_core.js`;
    const coreSource = app.doShellScript(`cat ${shellQuote(corePath)}`);

    eval(coreSource);

    if (typeof skimRun !== "function") {
        throw new Error("skim_core.js did not provide skimRun().");
    }

    return skimRun([mode]);
}
