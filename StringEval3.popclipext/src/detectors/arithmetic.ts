import { evaluate } from "mathjs";
import { Detector, Context } from "../registry";

export class ArithmeticDetector implements Detector {
    id = "arithmetic";
    priority = 100;

    match(text: string, context: Context): string | null {
        const trimmed = text.trim();
        if (!trimmed) return null;

        // Must contain at least one digit
        if (!/[\d]/.test(trimmed)) return null;

        // STRICTER FILTER:
        // Reject if it contains letters, unless:
        // 1. "of" (percentage)
        // 2. "deg" or "phi" or "pi" or "e" (math constants)? 
        //    For now, let's allow common constants but blocking "c" for combinations (nCr).
        //    Actually, "c" is not a standard math constant in default mathjs scope (except maybe speed of light unit?).
        //    We want to avoid eating "12c12".

        // Check for unwanted letters.
        // Allowed: 
        // - "of" (case insensitive)
        // - "e" (for scientific notation 1e5, OR math constant)
        // - "pi"
        // - "mod"
        // Everything else should probably be rejected to avoid conflict with units/combinations.

        // Regex for "contains letters that aren't allowed keywords":
        const allowedKeywords = ["of", "pi", "mod", "e"]; // e is tricky because of scientific notation

        // Let's strip allowed keywords and digits/symbols. If anything left is a letter => reject.
        let checkStr = trimmed.toLowerCase();

        // Remove "of", "pi", "mod"
        checkStr = checkStr.replace(/\bof\b|\bpi\b|\bmod\b/g, "");

        // Remove scientific notation 'e' (digit + e + digit/sign)
        checkStr = checkStr.replace(/\d+e[+-]?\d+/g, "");

        // Valid math characters: digits . + - * / % ^ ( ) $ , space
        checkStr = checkStr.replace(/[\d\.\+\-\*\/\%\^\(\)\$\,\s]/g, "");

        // If any letters remain, reject (e.g. "c" in "12c12", "km" in "10km")
        if (/[a-z]/.test(checkStr)) {
            return null;
        }

        const hasCurrency = /\$/.test(trimmed);
        const cleaned = trimmed.replace(/\$/g, "").replace(/,/g, "");

        // Handle percentage operations
        let expression = cleaned;

        const percentOfMatch = expression.match(/^(\d+(?:\.\d+)?)%\s*of\s*(\d+(?:\.\d+)?)$/i);
        if (percentOfMatch) {
            expression = `${percentOfMatch[1]} / 100 * ${percentOfMatch[2]}`;
        } else {
            expression = expression.replace(/(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)%/g, "$1 * (1 + $2 / 100)");
            expression = expression.replace(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)%/g, "$1 * (1 - $2 / 100)");
        }

        try {
            const result = evaluate(expression);

            if (typeof result === "number" && !isNaN(result)) {
                // If the input was already a plain number, return null
                if (/^[\d\.]+$/.test(cleaned) && !percentOfMatch) {
                    return null;
                }

                let formatted = String(parseFloat(result.toFixed(4)));
                if (hasCurrency) {
                    formatted = `$${parseFloat(result.toFixed(2))}`;
                }
                return formatted;
            }
        } catch (e) {
        }

        return null;
    }
}
