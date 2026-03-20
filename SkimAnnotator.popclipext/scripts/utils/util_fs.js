function createFsUtils(deps) {
    const runShell = deps.runShell;
    const shellQuote = deps.shellQuote;

    const fileExists = (path) => runShell(`[ -f ${shellQuote(path)} ] && echo 1 || echo 0`).trim() === "1";

    const readTextFile = (path) => {
        if (!fileExists(path)) return "";
        return runShell(`cat ${shellQuote(path)}`);
    };

    const writeTextFile = (path, content) => {
        runShell(`printf '%s' ${shellQuote(content)} > ${shellQuote(path)}`);
    };

    const appendTextFile = (path, content) => {
        runShell(`printf '%s' ${shellQuote(content)} >> ${shellQuote(path)}`);
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

    return {
        fileExists,
        readTextFile,
        writeTextFile,
        appendTextFile,
        loadState,
        saveState,
        getLastEntryBlock,
        isOpenInVSCode
    };
}
