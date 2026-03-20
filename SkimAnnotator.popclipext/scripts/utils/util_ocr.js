function createOcrUtils() {
    const cleanInlineText = (text) => {
        if (!text) return "";

        let output = text.replace(/^[\uFEFF\u200B\u2060]+/, "");
        output = output.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, " ");
        output = output.replace(/\s+/g, " ").trim();
        output = output.replace(/^[,.-]+|[,.-]+$/g, "").trim();

        output = output.replace(/primary treating physician/gi, "PTP")
            .replace(/\bsigned by\b/gi, "")
            .replace(/\bsigned\b/gi, "")
            .replace(/\bmaximum medical improvement\b/gi, "MMI")
            .replace(/\bpermanent and stationary\b/gi, "P&S")
            .replace(/\bmagnetic resonance imaging\b/gi, "MRI")
            .replace(/\belectromyography\b/gi, "EMG")
            .replace(/\bnerve conduction velocity\b/gi, "NCV")
            .replace(/\boccupational therapy\b/gi, "OT")
            .replace(/\bphysical therapy\b/gi, "PT")
            .replace(/\bfunctional capacity evaluation\b/gi, "FCE")
            .replace(/\bactivities of daily living\b/gi, "ADLs")
            .replace(/\bDr\.?\s+([A-Z][a-z]+)\s+([A-Z][a-z]+),?\s*(MD|DO|NP|PA|DC|PhD)\.?\b/gi, "Dr. $2")
            .replace(/\b(PANEL\s+)?(QUALIFIED|AGREED)\s+MEDICAL\s+EVALUAT(?:OR|ION)(S)?((\'S|S\')?)\b/gi, (m) => {
                return m.toUpperCase().includes("QUALIFIED") ? "QME" : "AME";
            })
            .replace(/\s{2,}/g, " ")
            .trim();

        return output;
    };

    const fixOcrHeadingNoise = (text) => {
        if (!text) return "";

        let output = text;
        const looksLikeHeading = /^[A-Z0-9\s&'.,:/()-]+$/.test(output) || /^[A-Z]{2,}\b/.test(output);
        if (!looksLikeHeading) return output;

        output = output
            .replace(/^YPE\b/, "TYPE")
            .replace(/^ASE\b/, "CASE")
            .replace(/^TIPULATIONS\b/, "STIPULATIONS")
            .replace(/^HE\s+FOLLOWING\b/, "THE FOLLOWING")
            .replace(/^RE-TRIAL\b/, "PRE-TRIAL");

        return output;
    };

    const quickOcrCorrectHeader = (text) => {
        if (!text) return "";

        let output = fixOcrHeadingNoise(text);
        const looksLikeHeading = /^[A-Z0-9\s&'.,:/()-]+$/.test(output) || /^[A-Z]{2,}\b/.test(output);
        if (!looksLikeHeading) return output;

        output = output
            .replace(/\b0F\b/g, "OF")
            .replace(/\bT0\b/g, "TO")
            .replace(/\bTH1S\b/g, "THIS")
            .replace(/\bSECTI0N\b/g, "SECTION")
            .replace(/\bMEDlCAL\b/g, "MEDICAL")
            .replace(/\bCLA1M\b/g, "CLAIM");

        return output;
    };

    const cleanQuoteText = (text) => {
        if (!text) return "";

        const lines = text
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .map((line) => cleanInlineText(line));

        return lines.join("\n");
    };

    return {
        cleanInlineText,
        fixOcrHeadingNoise,
        quickOcrCorrectHeader,
        cleanQuoteText
    };
}
