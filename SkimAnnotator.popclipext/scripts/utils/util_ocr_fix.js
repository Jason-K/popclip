// util_ocr_fix.js
// PDF OCR artifact correction for workers' comp documents
// JavaScriptCore compatible — no Node deps, fully synchronous

function createOcrFixUtils() {

// ---------------------------------------------------------------------------
// Protected tokens — never mutated by character substitutions
// ---------------------------------------------------------------------------
const PROTECTED = new Set([
  // Workers' comp
  'AME','QME','PD','TD','TTD','PTD','PPD','PTP','AWW','WCAB','DIR','DWC',
  'DOI','DOE','DOB','MMI','P&S','ADL','FCE','DFEC','SJDB','VRMA',
  // Medical
  'MRI','CT','EMG','NCS','ROM','GAF','BMI','ECG','EKG','EEG','CBC',
  'ICD','CPT','DSM','DX','Rx','PRN','BID','TID','QID','IM','IV','SQ',
  'mmHg','bpm','SpO2',
  // Legal
  'IRAR','LIEN','MSC','CCR','CCW','WPI','FEC','LC',
]);

// ---------------------------------------------------------------------------
// Ligature normalization (must run before everything else)
// ---------------------------------------------------------------------------
const LIGATURES = [
  [/ﬁ/g, 'fi'], [/ﬂ/g, 'fl'], [/ﬀ/g, 'ff'],
  [/ﬃ/g, 'ffi'], [/ﬄ/g, 'ffl'], [/ﬅ/g, 'st'], [/ﬆ/g, 'st'],
];

// ---------------------------------------------------------------------------
// Unicode normalization
// ---------------------------------------------------------------------------
const UNICODE_SUBS = [
  [/[\u2018\u2019\u0060\u00B4]/g, "'"],       // smart/grave/acute → straight
  [/[\u201C\u201D\u00AB\u00BB]/g, '"'],        // smart double quotes
  [/\u2013/g, '-'],                             // en dash
  [/\u2014/g, '--'],                            // em dash
  [/\u2026/g, '...'],                           // ellipsis
  [/\u00A0/g, ' '],                             // non-breaking space
  [/\u00AD/g, ''],                              // soft hyphen (remove)
];

// ---------------------------------------------------------------------------
// Whitespace / line-break artifacts
// ---------------------------------------------------------------------------
const WHITESPACE_SUBS = [
  [/(\w)-\r?\n(\w)/g, '$1$2'],                 // de-\nhyphenation
  [/(\w)-\r?\n\s+(\w)/g, '$1$2'],              // de-\n + leading space
  [/[ \t]{2,}/g, ' '],                          // multiple spaces/tabs → single
  [/\r\n/g, '\n'],                              // normalize CRLF
  [/ +\n/g, '\n'],                              // trailing spaces
  [/\n{3,}/g, '\n\n'],                          // 3+ blank lines → 2
];

// ---------------------------------------------------------------------------
// Character-level OCR confusion (serif/small font artifacts)
// ---------------------------------------------------------------------------
const CHAR_SUBS = [
  // Pipe/bar misread as I or l
  [/\|(?=[A-Z])/g, 'I'],
  [/\|(?=[a-z])/g, 'l'],
  [/\|(?=\d)/g, '1'],

  // Digit 0 misread as letter O (context-sensitive)
  [/\b0(?=[a-z]{2,})/g, 'o'],                  // 0ther, 0ver
  [/(?<=[a-z]{2,})0\b/g, 'o'],                 // zer0, alg0

  // Digit 1 misread as l (only when flanked by letters)
  [/(?<=[a-zA-Z])1(?=[a-zA-Z])/g, 'l'],

  // rn → m (very common in serif body text)
  [/\brnay\b/g, 'may'],
  [/\brnore\b/gi, 'more'],
  [/\brnedical\b/gi, 'medical'],
  [/\brnatter\b/gi, 'matter'],
  [/\brnust\b/gi, 'must'],
  [/\brnanual\b/gi, 'manual'],
  [/\brnean\b/gi, 'mean'],

  // vv → w
  [/\bvvork/gi, 'work'],
  [/\bvvith/gi, 'with'],
  [/\bvvas\b/gi, 'was'],
  [/\bvvhich\b/gi, 'which'],
  [/\bvvhen\b/gi, 'when'],
  [/\bvvhere\b/gi, 'where'],

  // Double punctuation
  [/,,/g, ','],
  [/\.\.(?!\.)/g, '.'],                         // double period (protect ellipsis)
  [/([!?])\1+/g, '$1'],                         // !! / ?? → ! / ?
];

// ---------------------------------------------------------------------------
// Medical / legal number formatting
// ---------------------------------------------------------------------------
const NUMBER_SUBS = [
  // Spaces inserted into numbers
  [/(\d) (\d{3})\b(?!\d)/g, '$1$2'],           // 1 234 → 1234 (ID numbers)

  // Degree symbols
  [/(\d)\s*[°o]\s*F\b/g, '$1°F'],
  [/(\d)\s*[°o]\s*C\b/g, '$1°C'],

  // Common unit spacing normalization
  [/(\d)(?:mg)\b/gi,   '$1 mg'],
  [/(\d)(?:mL)\b/g,    '$1 mL'],
  [/(\d)(?:mcg)\b/gi,  '$1 mcg'],
  [/(\d)(?:kg)\b/gi,   '$1 kg'],
  [/(\d)(?:lbs?)\b/gi, '$1 lb'],
  [/(\d)(?:cm)\b/gi,   '$1 cm'],
  [/(\d)(?:mm)\b/gi,   '$1 mm'],

  // Percent
  [/(\d)\s*%/g, '$1%'],

  // Collapsed date separators (e.g. "01012023" is not fixable, but "01 01 2023" is)
  // Leave date parsing to the extraction layer
];

// ---------------------------------------------------------------------------
// Workers' comp / medical document structural artifacts
// ---------------------------------------------------------------------------
const DOCUMENT_SUBS = [
  // Page headers/footers bled into body text
  [/\bPage \d+ of \d+\b/gi, ''],
  [/\bCONFIDENTIAL\b/g, ''],                   // remove injected stamp text

  // Section header spacing collapse
  [/([a-z])([A-Z]{2,})/g, '$1 $2'],            // wordHEADING → word HEADING

  // Parenthetical date artifacts: "01/0l/2023" (l instead of 1)
  [/(\d{2})\/0l\//g, '$1/01/'],
  [/\/l\//g, '/1/'],

  // "S/P" "w/" "c/o" — protect slashed abbreviations (already correct)
  // These are intentional, no substitution needed
];

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
function ocrFix(raw) {
  if (!raw || typeof raw !== 'string') return '';

  // Stage 1: ligatures (must precede all pattern matching)
  let text = LIGATURES.reduce((t, [p, r]) => t.replace(p, r), raw);

  // Stage 2: unicode normalization
  text = UNICODE_SUBS.reduce((t, [p, r]) => t.replace(p, r), text);

  // Stage 3: whitespace / line-break artifacts
  text = WHITESPACE_SUBS.reduce((t, [p, r]) => t.replace(p, r), text);

  // Stage 4: character-level substitutions, protecting known tokens
  // Split on word boundaries, check PROTECTED set, reassemble
  text = text.replace(/\b[A-Z][A-Z0-9&/]{1,7}\b/g, (match) =>
    PROTECTED.has(match) ? `\x00${match}\x00` : match   // sentinel wrap
  );
  text = CHAR_SUBS.reduce((t, [p, r]) => t.replace(p, r), text);
  text = NUMBER_SUBS.reduce((t, [p, r]) => t.replace(p, r), text);
  text = DOCUMENT_SUBS.reduce((t, [p, r]) => t.replace(p, r), text);

  // Stage 5: remove sentinels
  text = text.replace(/\x00([^\x00]+)\x00/g, '$1');

  // Stage 6: final cleanup
  return text.trim();
}

return { ocrFix };
}
