import { Context, Detector } from "../registry";

export class WpiExtremityDetector implements Detector {
    id = "wpi_extremity";
    priority = 115;

    match(text: string, context: Context): string | null {
        const trimmed = text.trim();
        if (!trimmed) return null;

        // Matches: 1-99 followed by u/l (case-insensitive), optional trailing "ei"
        const m = trimmed.match(/^\b([1-9][0-9]?)([ul])(?:ei)?\b$/i);
        if (!m) return null;

        const valNum = parseInt(m[1], 10);
        const extremityType = m[2].toLowerCase();

        let multiplier: number;
        if (extremityType === "u") {
            multiplier = 0.6;
        } else if (extremityType === "l") {
            multiplier = 0.4;
        } else {
            return null; // safety fallback
        }

        const rawValue = valNum * multiplier;
        const wholePart = Math.floor(rawValue);
        const decimalPart = rawValue - wholePart;
        const finalValue = decimalPart < 0.5 ? wholePart : wholePart + 1;

        return `${finalValue}% WPI`;
    }
}
