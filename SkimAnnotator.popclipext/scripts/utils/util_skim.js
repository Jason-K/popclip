function createSkimUtils(deps) {
    const runShell = deps.runShell;
    const shellQuote = deps.shellQuote;

    const extractSkimData = () => {
        const getDataScript = `tell application "Skim"
            if not (exists front document) then return "||0||"
            set d to front document
            set pdfPath to POSIX path of (path of d as string)
            set pageNum to index of current page of d
            set selectedText to ""
            try
                set selectedText to (selection of d as string)
            end try
            return pdfPath & "||" & pageNum & "||" & selectedText
        end tell`;

        const output = runShell(`osascript -e ${shellQuote(getDataScript)}`);
        const parts = output.split("||");

        return {
            pdfPath: (parts[0] || "").trim(),
            pageNum: parseInt(parts[1], 10),
            rawText: parts.slice(2).join("||")
        };
    };

    const createSkimAnnotation = (modeValue) => {
        const noteType = (modeValue === "highlight" || modeValue === "blockquote" || modeValue === "inline_quote")
            ? "highlight note"
            : "underline note";

        const asAction = `try
    tell application "Skim"
        activate
        if not (exists document 1) then error "No PDF document is open in Skim."

        set activeDoc to document 1
        set selectionData to missing value

        try
            set selectionData to (get selection of activeDoc)
        end try

        if selectionData is not missing value then
            tell activeDoc
                set highlight_colors to {{65535, 65531, 2688, 32768}, {65535, 20000, 20000, 32768}, {20000, 65535, 20000, 32768}, {20000, 40000, 65535, 32768}, {65535, 20000, 65535, 32768}, {65535, 40000, 20000, 32768}}
                set note_count to count of notes
                set color_index to ((note_count mod 6) + 1)
                set next_color to item color_index of highlight_colors
                make note with data selectionData with properties {type:${noteType}, color:next_color}
            end tell
        end if
    end tell
on error errMsg
    display notification "Highlight Error: " & errMsg with title "Skim Bookmarker"
end try`;

        const tmpFile = `/tmp/skim_script_${Date.now()}_${Math.floor(Math.random() * 100000)}.applescript`;
        runShell(`cat > ${shellQuote(tmpFile)} << 'EOF'\n${asAction}\nEOF`);
        runShell(`osascript ${shellQuote(tmpFile)}`);
        runShell(`rm -f ${shellQuote(tmpFile)}`);
    };

    return {
        extractSkimData,
        createSkimAnnotation
    };
}
