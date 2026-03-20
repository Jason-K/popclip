ObjC.import("Foundation");

function run() {
    const app = Application.currentApplication();
    app.includeStandardAdditions = true;
    const shellQuote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;

    const args = $.NSProcessInfo.processInfo.arguments;
    const scriptPath = ObjC.unwrap(args.objectAtIndex(3));
    const scriptDir = ObjC.unwrap($(scriptPath).stringByDeletingLastPathComponent);
    const runnerPath = `${scriptDir}/skim_action_runner.js`;
    const runnerSource = app.doShellScript(`cat ${shellQuote(runnerPath)}`);

    eval(runnerSource);
    if (typeof runMode !== "function") throw new Error("Missing runMode().");
    return runMode("highlight");
}
