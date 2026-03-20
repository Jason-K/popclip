function createDateUtils(deps) {
    const cleanInlineText = deps.cleanInlineText;
    const quickOcrCorrectHeader = deps.quickOcrCorrectHeader;

    const parseDatePrefix = (text) => {
        const source = String(text || "");
        if (!source.trim()) return "";

        const formatDate = (year, month, day) => {
            const y = Number(year);
            const m = Number(month);
            const d = Number(day);
            if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return "";
            if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return "";
            const dt = new Date(Date.UTC(y, m - 1, d));
            if (dt.getUTCFullYear() !== y || (dt.getUTCMonth() + 1) !== m || dt.getUTCDate() !== d) return "";
            const yy = y.toString().slice(-2);
            return `${y.toString().padStart(4, "0")}.${m.toString().padStart(2, "0")}.${yy}`;
        };

        const ymd = source.match(/\b(\d{4})[./-](\d{1,2})[./-](\d{1,2})\b/);
        if (ymd) {
            const formatted = formatDate(ymd[1], ymd[2], ymd[3]);
            if (formatted) return formatted;
        }

        const mdy = source.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})\b/);
        if (mdy) {
            const year = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
            const formatted = formatDate(year, mdy[1], mdy[2]);
            if (formatted) return formatted;
        }

        const monthMap = {
            january: 1, jan: 1,
            february: 2, feb: 2,
            march: 3, mar: 3,
            april: 4, apr: 4,
            may: 5,
            june: 6, jun: 6,
            july: 7, jul: 7,
            august: 8, aug: 8,
            september: 9, sep: 9, sept: 9,
            october: 10, oct: 10,
            november: 11, nov: 11,
            december: 12, dec: 12
        };
        const monthName = source.match(/\b([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*|\s+)(\d{4})\b/);
        if (monthName) {
            const month = monthMap[monthName[1].toLowerCase()] || 0;
            if (month) {
                const formatted = formatDate(monthName[3], month, monthName[2]);
                if (formatted) return formatted;
            }
        }

        return "";
    };

    const stripDetectedDate = (text) => {
        const source = String(text || "");
        let output = source
            .replace(/\b\d{4}[./-]\d{1,2}[./-]\d{1,2}\b/, "")
            .replace(/\b\d{1,2}[./-]\d{1,2}[./-](?:\d{2}|\d{4})\b/, "")
            .replace(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*|\s+)\d{4}\b/i, "");

        output = cleanInlineText(output).replace(/^[-:;,\s]+/, "").trim();
        return output;
    };

    const toPdfStem = (pdfName) => String(pdfName || "source")
        .replace(/\.pdf$/i, "")
        .trim();

    const buildLevel1PromptDefault = (rawText, pdfName) => {
        const extractedDate = parseDatePrefix(rawText);
        const remainingText = stripDetectedDate(rawText);
        const correctedRemaining = quickOcrCorrectHeader(remainingText);
        const baseStem = quickOcrCorrectHeader(toPdfStem(pdfName));
        const base = correctedRemaining || baseStem;
        if (extractedDate) {
            return `${extractedDate} - ${base}`;
        }
        return base;
    };

    return {
        parseDatePrefix,
        stripDetectedDate,
        buildLevel1PromptDefault
    };
}
