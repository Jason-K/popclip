import { add, sub, format, parse, isValid } from "date-fns";
import { Detector, Context } from "../registry";

export class TimeCalcDetector implements Detector {
    id = "time_calc";
    priority = 90;

    private unitMap: { [key: string]: string } = {
        h: "hours",
        m: "minutes",
        s: "seconds",
    };

    match(text: string, context: Context): string | null {
        const trimmed = text.trim().toLowerCase();

        // Quick filtering
        if (!/\d/.test(trimmed)) return null;

        // 1. "now + duration" (e.g., "now + 2h")
        if (/^now\s*[+-]\s*\d+[hms]$/.test(trimmed)) {
            return this.handleNowDuration(trimmed);
        }

        // 2. "9am + 2h" or "14:30 - 30m"
        // Regex for time: 
        // - 12h: \d{1,2}(?::\d{2})?\s*[ap]m?
        // - 24h: \d{1,2}:\d{2}
        // Combined loosely: \d{1,2}(?::\d{2})?\s*(?:[ap]m)?
        // Plus duration: \s*[+-]\s*\d+[hms]
        const timeDurationMatch = trimmed.match(/^(\d{1,2}(?::\d{2})?\s*(?:[ap]m)?)\s*([+-])\s*(\d+)([hms])$/i);
        if (timeDurationMatch) {
            return this.handleTimeDuration(timeDurationMatch);
        }

        return null;
    }

    private handleNowDuration(text: string): string | null {
        const match = text.match(/^now\s*([+-])\s*(\d+)([hms])$/);
        if (!match) return null;

        const [, op, amountStr, unit] = match;
        const amount = parseInt(amountStr, 10);
        const duration = { [this.unitMap[unit]]: amount };
        const now = new Date();

        const result = op === "+" ? add(now, duration) : sub(now, duration);
        return format(result, "h:mm a");
    }

    private handleTimeDuration(match: RegExpMatchArray): string | null {
        const [, timeStr, op, amountStr, unit] = match;
        const amount = parseInt(amountStr, 10);
        const duration = { [this.unitMap[unit]]: amount };

        // Parse timeStr
        // date-fns parse requires a reference date and format string. 
        // This is tricky because "9am" vs "14:30" vs "9:30".

        // Let's normalize timeStr
        let normalizedTime = timeStr.replace(/\s+/g, "").toLowerCase();
        let date: Date | null = null;
        const now = new Date();

        // Strategies to parse:
        const formats = [
            "h:mma", // 9:30am
            "ha",    // 9am
            "H:mm",  // 14:30
        ];

        for (const fmt of formats) {
            const d = parse(normalizedTime, fmt, now);
            if (isValid(d)) {
                date = d;
                break;
            }
        }

        // Fallback manual parsing if date-fns strict parsing fails for loose inputs like "9" (assume 9am?)
        // PopClip users might type "9 + 2h".
        if (!isValid(date)) {
            if (/^\d{1,2}$/.test(normalizedTime)) {
                date = parse(normalizedTime, "H", now); // Treat as 24h hour? Or am?
                // "9" usually means 9:00.
            }
        }

        if (!date || !isValid(date)) return null;

        const result = op === "+" ? add(date, duration) : sub(date, duration);

        // Format output
        // If input had AM/PM, output AM/PM. If 24h, output 24h?
        // For simplicity, default to 12h "h:mm a" as it's most common for this use case,
        // or infer from input?
        const is12h = /am|pm/.test(timeStr.toLowerCase());
        return format(result, is12h ? "h:mm a" : "HH:mm");
    }
}
