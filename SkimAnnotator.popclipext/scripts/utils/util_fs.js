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

    const appendOrUpdateLastBulletInMarkdown = (mdFile, newText, newPageNum, renderUtils) => {
        if (!fileExists(mdFile)) {
            const initialLine = `- ${newText} [p.${newPageNum}]`;
            writeTextFile(mdFile, `${initialLine}\n`);
            return {
                updated: true,
                created: true,
                mergedPageLabel: String(newPageNum),
                fullMergedText: `- ${newText}`,
                plainMergedText: newText,
                updatedLine: initialLine
            };
        }

        const content = readTextFile(mdFile).replace(/^\uFEFF/, "");
        const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

        // Find the index of the last bullet line (starting with -, *, or +)
        let lastBulletIdx = -1;
        for (let i = lines.length - 1; i >= 0; i -= 1) {
            if (/^\s*[-*+]\s+/.test(lines[i])) {
                lastBulletIdx = i;
                break;
            }
        }

        if (lastBulletIdx === -1) {
            // No bullet found in existing content; append new bullet
            const newBulletLine = `- ${newText} [p.${newPageNum}]`;
            const normalizedContent = content.trim();
            const nextContent = normalizedContent ? `${normalizedContent}\n${newBulletLine}\n` : `${newBulletLine}\n`;
            writeTextFile(mdFile, nextContent);
            return {
                updated: true,
                created: false,
                mergedPageLabel: String(newPageNum),
                fullMergedText: `- ${newText}`,
                plainMergedText: newText,
                updatedLine: newBulletLine
            };
        }

        // If the bullet has indented continuation lines, find the last continuation line of this bullet
        let targetLineIdx = lastBulletIdx;
        for (let j = lastBulletIdx + 1; j < lines.length; j += 1) {
            if (/^\s*[-*+]\s+/.test(lines[j]) || /^#/.test(lines[j]) || !lines[j].trim()) {
                break;
            }
            if (/^\s{2,}\S/.test(lines[j]) || /^\t+\S/.test(lines[j])) {
                targetLineIdx = j;
            } else {
                break;
            }
        }

        const existingLine = lines[targetLineIdx];
        const updateResult = renderUtils.updateBulletWithAppend(existingLine, newText, newPageNum);
        lines[targetLineIdx] = updateResult.updatedLine;

        const nextContent = lines.join("\n");
        writeTextFile(mdFile, nextContent.endsWith("\n") ? nextContent : `${nextContent}\n`);

        const plainMergedText = updateResult.fullMergedText.replace(/^\s*[-*+]\s+/, "");
        return {
            updated: true,
            created: false,
            mergedPageLabel: updateResult.mergedPageLabel,
            fullMergedText: updateResult.fullMergedText,
            plainMergedText,
            updatedLine: updateResult.updatedLine
        };
    };

    const APP_PROCESS_NAMES = {
      "Visual Studio Code": "Code",
      "Visual Studio Code - Insiders": "Code - Insiders",
    };

    const isFileOpenInEditor = (mdFile, mdBaseName, editorApp) => {
      const appName = editorApp || "Visual Studio Code";
      const processName = APP_PROCESS_NAMES[appName] || appName;

      // For VS Code family, try the document API first (most reliable)
      if (
        appName === "Visual Studio Code" ||
        appName === "Visual Studio Code - Insiders"
      ) {
        const directScript = `tell application "${appName}"
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

        const directResult = runShell(
          `osascript -e ${shellQuote(directScript)}`,
        ).trim();
        if (directResult === "1") return true;
        if (directResult === "0") return false;
      }

      // Fallback: check window title via System Events
      const fallbackScript = `tell application "System Events"
            if not (exists process "${processName}") then return "0"
            tell process "${processName}"
                repeat with w in windows
                    try
                        if (name of w) contains "${mdBaseName}" then return "1"
                    end try
                end repeat
            end tell
            return "0"
        end tell`;

      const fallbackResult = runShell(
        `osascript -e ${shellQuote(fallbackScript)}`,
      ).trim();
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
      appendOrUpdateLastBulletInMarkdown,
      isFileOpenInEditor,
    };
}
