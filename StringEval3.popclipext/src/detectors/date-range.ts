import { differenceInCalendarDays, parse, isValid } from "date-fns";
import { Detector, Context } from "../registry";

export class DateRangeDetector implements Detector {
    id = "date_range";
    priority = 70;

    match(text: string, context: Context): string | null {
        const trimmed = text.trim();
        if (!trimmed) return null;

        // Pattern: "Date1 to Date2", "Date1 - Date2", "Date1 until Date2"
        // "Jan 1 to Jan 5"
        // "1/1/2023 - 1/5/2023"

        // Split by separator
        const separators = [" to ", " - ", " until ", " through "];
        let parts: string[] = [];

        for (const sep of separators) {
            if (text.toLowerCase().includes(sep)) {
                parts = text.split(new RegExp(sep, "i"));
                break;
            }
        }

        if (parts.length !== 2) return null;

        const str1 = parts[0].trim();
        const str2 = parts[1].trim();

        // Parse dates
        // date-fns parse implies strict format usually, but we can try common formats
        // or use `new Date()` for broader support, but `new Date()` on macOS JSC/Node is decent.
        // Let's try `new Date()` first as it handles "Jan 1, 2023" well.

        const date1 = new Date(str1);
        const date2 = new Date(str2);

        if (!isValid(date1) || !isValid(date2)) {
            return null;
        }

        // Calculate difference
        const diff = differenceInCalendarDays(date2, date1);

        // Format: "X days"
        // Handle singular?
        const absDiff = Math.abs(diff);
        return `${absDiff} day${absDiff === 1 ? "" : "s"}`;
    }
}
