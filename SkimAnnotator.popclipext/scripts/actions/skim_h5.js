ObjC.import("Foundation");

function run() {
    const app = Application.currentApplication();
    app.includeStandardAdditions = true;
    const shellQuote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;
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
    const runnerPath = `${scriptDir}/skim_action_runner.js`;
    const runnerSource = app.doShellScript(`cat ${shellQuote(runnerPath)}`);

    eval(runnerSource);
    if (typeof runMode !== "function") throw new Error("Missing runMode().");
    return runMode("h5");
}
