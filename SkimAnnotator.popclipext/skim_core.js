// Compatibility entrypoint that delegates to the maintained scripts/core implementation.
ObjC.import("Foundation");

function loadCurrentSkimCore() {
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
    throw new Error(
      "Could not resolve current script path from process arguments.",
    );
  };

  const scriptDir = resolveScriptDir();
  const corePath = `${scriptDir}/scripts/core/skim_core.js`;
  const coreSource = app.doShellScript(`cat ${shellQuote(corePath)}`);
  eval(coreSource);

  if (typeof skimRun !== "function") {
    throw new Error("scripts/core/skim_core.js did not provide skimRun().");
  }

  return skimRun;
}

function skimRun(argv) {
  const currentSkimRun = loadCurrentSkimCore();
  return currentSkimRun(argv || []);
}
