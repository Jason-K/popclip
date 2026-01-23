import { differenceInCalendarDays, isValid } from "date-fns";
import { Context, Detector } from "../registry";

export class DateRangeDetector implements Detector {
    id = "date_range";
    priority = 70;

    match(text: string, context: Context): string | null {
        const trimmed = text.trim();
        if (!trimmed) return null;

        let parts: string[] = [];

        // First try to split by explicit separators
        const separators = [" to ", " - ", " until ", " through "];
        for (const sep of separators) {
            if (text.toLowerCase().includes(sep)) {
                parts = text.split(new RegExp(sep, "i"));
                break;
            }
        }

        // If no explicit separator found, try to detect adjacent dates
        if (parts.length !== 2) {
            parts = this.splitAdjacentDates(trimmed);
        }

        if (parts.length !== 2) return null;

        const str1 = parts[0].trim();
        const str2 = parts[1].trim();

        // Parse dates
        const date1 = this.parseFlexibleDate(str1);
        const date2 = this.parseFlexibleDate(str2);

        if (!date1 || !date2 || !isValid(date1) || !isValid(date2)) {
            return null;
        }

        // Calculate difference
        const diff = differenceInCalendarDays(date2, date1);

        // Format: "X days"
        const absDiff = Math.abs(diff);
        // const debug = ` [debug: raw1=${str1}, raw2=${str2}, parsed1=${this.debugDate(date1)}, parsed2=${this.debugDate(date2)}, diff=${diff}]`;
        return `${absDiff} day${absDiff === 1 ? "" : "s"}`;
    }

    private splitAdjacentDates(text: string): string[] {
        // Try to detect adjacent dates like "1/1/11 1/2/12" or "1.1.11 1-2-12"
        // Pattern: two dates separated by space, each with consistent separators
        const dateMatch = text.match(/(\d+[\/\-_\.]\d+[\/\-_\.]\d+)\s+(\d+[\/\-_\.]\d+[\/\-_\.]\d+)/);
        if (dateMatch) {
            const date1 = dateMatch[1];
            const date2 = dateMatch[2];
            // Validate that each date has consistent separators
            if (this.isConsistentDateFormat(date1) && this.isConsistentDateFormat(date2)) {
                return [date1, date2];
            }
        }
        return [];
    }

    private isConsistentDateFormat(dateStr: string): boolean {
        // Ensure all separators in the date are the same
        const separators = dateStr.match(/[\/\-_\.]/g) || [];
        if (separators.length < 2) return false;
        const firstSep = separators[0];
        return separators.every(sep => sep === firstSep);
    }

    private parseFlexibleDate(dateStr: string): Date | null {
        // If it has letters (e.g., Jan 1, 2023), use standard parsing.
        if (/[a-zA-Z]/.test(dateStr)) {
            const stdDate = new Date(dateStr);
            return isValid(stdDate) ? stdDate : null;
        }

        // Numeric with separators: d/m/y, m-d-y, etc.
        const numeric = dateStr.match(/^(\d{1,4})[\/_\.-](\d{1,2})[\/_\.-](\d{1,4})$/);
        if (!numeric) return null;

        const [, aStr, bStr, cStr] = numeric;
        const a = parseInt(aStr, 10);
        const b = parseInt(bStr, 10);
        const c = parseInt(cStr, 10);
        if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c)) return null;

        const normalizeYear = (y: number) => (y < 100 ? 2000 + y : y);

        const buildDate = (y: number, m: number, d: number): Date | null => {
            if (m < 1 || m > 12 || d < 1 || d > 31) return null;
            const dt = new Date(y, m - 1, d);
            return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null;
        };

        // Priority: ISO-like year-month-day if first part is 4+ digits and plausible
        if (a >= 1000) {
            const iso = buildDate(a, b, c);
            if (iso) return iso;
        }

        // Next: month-day-year if last part looks like a year (>= 1000)
        if (c >= 1000) {
            const mdy = buildDate(c, a, b);
            if (mdy) return mdy;
        }

        // Next: US month/day/year for short years
        const tryUs = buildDate(normalizeYear(c), a, b);
        if (tryUs) return tryUs;

        // Finally: day/month/year
        const tryDmY = buildDate(normalizeYear(c), b, a);
        if (tryDmY) return tryDmY;

        return null;
    }

    private debugDate(d: Date): string {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
}
