import { PhoneNumberUtil, PhoneNumberFormat } from "google-libphonenumber";
import { Detector, Context } from "../registry";

const phoneUtil = PhoneNumberUtil.getInstance();

export class PhoneDetector implements Detector {
    id = "phone";
    priority = 120; // High priority to beat Arithmetic (100)

    match(text: string, context: Context): string | null {
        const trimmed = text.trim();
        if (!trimmed) return null;

        // Avoid short numbers or things that look like math
        // Phone numbers usually > 7 digits
        const digits = trimmed.replace(/\D/g, "");
        if (digits.length < 7 || digits.length > 15) {
            return null;
        }

        try {
            // Parse "US" as default region if none supplied?
            // Or try to parse strictly.
            // google-libphonenumber is pretty aggressive.

            const number = phoneUtil.parseAndKeepRawInput(trimmed, "US");

            if (phoneUtil.isValidNumber(number)) {
                // Format to National or International?
                // "Standard" display. US: (555) 555-5555
                return phoneUtil.format(number, PhoneNumberFormat.NATIONAL);
            }
        } catch (e) {
            // Ignore parsing errors
        }

        return null;
    }
}
