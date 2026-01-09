import convert from 'convert-units';
import { Detector, Context } from "../registry";

export class UnitsDetector implements Detector {
    id = "units";
    priority = 80;

    match(text: string, context: Context): string | null {
        const trimmed = text.trim();
        if (!trimmed) return null;

        // Pattern: "100km to mi" or "100 km in miles"
        // convert-units uses specific abbreviations.

        // Regex matches: value, fromUnit, toUnit
        const match = trimmed.match(/^([\d\.]+)\s*([a-z]+)\s+(?:to|in)\s+([a-z]+)$/i);
        if (!match) return null;

        const [, valueStr, fromUnit, toUnit] = match;
        const value = parseFloat(valueStr);

        if (isNaN(value)) return null;

        try {
            // The default export 'convert' is a function that takes the value.
            // It should have all measures loaded by default in the main bundle.
            // @ts-ignore - types might be slightly off depending on version, but this is standard usage.
            const result = convert(value).from(fromUnit).to(toUnit);

            // Format result: 2 decimals
            return `${result.toFixed(2)} ${toUnit}`;
        } catch (e) {
            // Ignore invalid units or conversion errors
        }

        return null;
    }
}
