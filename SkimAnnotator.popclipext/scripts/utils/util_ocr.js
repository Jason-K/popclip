function createOcrUtils() {
  const cleanInlineText = (text) => {
    if (!text) return "";
    let output = text.replace(/^[\uFEFF\u200B\u2060]+/, "");
    output = output
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n/g, " ");
    output = output.replace(/\s+/g, " ").trim();
    output = output.replace(/^[,.-]+|[,.-]+$/g, "").trim();
    output = output
      .replace(/primary treating physician/gi, "PTP")
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
      .replace(
        /\bDr\.?\s+([A-Z][a-z]+)\s+([A-Z][a-z]+),?\s*(MD|DO|NP|PA|DC|PhD)\.?\b/gi,
        "Dr. $2",
      )
      .replace(
        /\b(PANEL\s+)?(QUALIFIED|AGREED)\s+MEDICAL\s+EVALUAT(?:OR|ION)(S)?((\'S|S\')?)\b/gi,
        (m) => {
          return m.toUpperCase().includes("QUALIFIED") ? "QME" : "AME";
        },
      )
      .replace(/\s{2,}/g, " ")
      .trim();
    return output;
  };
  const fixOcrHeadingNoise = (text) => {
    if (!text) return "";
    let output = text;
    const looksLikeHeading =
      /^[A-Z0-9\s&'.,:/()-]+$/.test(output) || /^[A-Z]{2,}\b/.test(output);
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
    const looksLikeHeading =
      /^[A-Z0-9\s&'.,:/()-]+$/.test(output) || /^[A-Z]{2,}\b/.test(output);
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

  // Strip inline pleading line numbers (e.g. "... send 4 Dr. ... not 5 discussed ...").
  // Only removes standalone integers in [min,max] that form an ascending +step run
  // of length >= minRun, so incidental numbers ("3 children") are preserved.
  // Also handles classic line-start numbering as a fallback.
  const stripInlineLineNumbers = (text, opts = {}) => {
    if (!text) return "";
    const min = Number.isInteger(opts.min) ? opts.min : 1;
    const max = Number.isInteger(opts.max) ? opts.max : 50;
    const minRun = Number.isInteger(opts.minRun) ? opts.minRun : 2;
    const maxStep = Number.isInteger(opts.maxStep) ? opts.maxStep : 1;

    const tokenRe = /(?<![^\s])\d{1,2}(?![^\s])/g;
    const candidates = [];
    for (const m of text.matchAll(tokenRe)) {
      const value = parseInt(m[0], 10);
      if (value >= min && value <= max) {
        candidates.push({ value, index: m.index, length: m[0].length });
      }
    }

    const remove = [];
    let runStart = 0;
    for (let i = 1; i <= candidates.length; i++) {
      const step =
        i < candidates.length
          ? candidates[i].value - candidates[i - 1].value
          : NaN;
      const breaks = i === candidates.length || step < 1 || step > maxStep;
      if (breaks) {
        if (i - runStart >= minRun) {
          for (let j = runStart; j < i; j++) remove.push(candidates[j]);
        }
        runStart = i;
      }
    }

    let out = text;
    for (let k = remove.length - 1; k >= 0; k--) {
      const { index, length } = remove[k];
      out = out.slice(0, index) + out.slice(index + length);
    }
    return out;
  };

  const removeLineNumbers = (text, opts = {}) => {
    if (!text) return "";
    // Classic line-start numbering (multiline, pre-collapse).
    let output = text.replace(/^\s*\d+\s*/gm, "");
    // Inline numbering left after newlines were collapsed to spaces.
    output = stripInlineLineNumbers(output, opts);
    // Whitespace/punctuation repair.
    output = output
      .replace(/[ \t]{2,}/g, " ")
      .replace(/[ \t]+([.,;:!?])/g, "$1")
      .replace(/^[ \t]+|[ \t]+$/gm, "")
      .trim();
    return output;
  };

  return {
    cleanInlineText,
    fixOcrHeadingNoise,
    quickOcrCorrectHeader,
    cleanQuoteText,
    removeLineNumbers,
  };
}
