import { Detector, Context } from "../registry";

export class CombinationsDetector implements Detector {
    id = "combinations";
    priority = 110; // High priority to capture "12c12" before math (though math is strict now, safer to be higher)

    match(text: string, context: Context): string | null {
        const trimmed = text.trim();
        if (!trimmed) return null;

        // Pattern: Numbers separated by "c" (case insensitive), allow optional spaces
        // e.g. "12c12", "12 c 3 c 2"
        // Must have at least one "c" and numbers on both sides

        // We strictly look for "c" as separator.
        if (!/^\d+(?:\s*c\s*\d+)+$/i.test(trimmed)) {
            return null;
        }

        const parts = trimmed.split(/c/i).map(s => s.trim());

        // Parse input values as integers (representing percentages)
        const inputs = parts.map(p => parseInt(p, 10));

        // If any NaN, abort
        if (inputs.some(n => isNaN(n))) return null;

        // 1. Sort descending
        // Note: User said "Convert integers... into decimal format... assign highest to A".
        // So sorting the *integers* descending achieves the same regarding priority.
        inputs.sort((a, b) => b - a);

        // 2. Convert to decimals
        const decimals = inputs.map(n => n / 100);

        // 3. Evaluate iteratively
        // C = A + B(1 - A)
        // If more than 3 values: "assign product of last evaluation C to A, with next highest to B..."
        // Implicitly this is a reduction: Result = Previous + Next * (1 - Previous)
        // Start with first value.

        let currentResult = decimals[0];

        for (let i = 1; i < decimals.length; i++) {
            const next = decimals[i];
            // Formula: NewResult = Current + Next * (1 - Current)
            // Wait, user said: "C = A + B(1 - A)" where A is highest.
            // Let's verify user example: "12c2c3" -> [12, 3, 2] -> [0.12, 0.03, 0.02]
            // Step 1: A=0.12, B=0.03. C = 0.12 + 0.03(1 - 0.12) = 0.12 + 0.03(0.88) = 0.12 + 0.0264 = 0.1464.
            // Step 2: A=0.1464, B=0.02. C = 0.1464 + 0.02(1 - 0.1464) = 0.1464 + 0.02(0.8536) = 0.1464 + 0.017072 = 0.163472.
            // User result example: "0.14", "0.17" -> 17%. Correct.

            const rawResult = currentResult + next * (1 - currentResult);

            // Custom Rounding Step: "Round C before reassigning it as A"
            // We round to 2 decimal places (percentage integer)
            currentResult = Math.round(rawResult * 100) / 100;
        }

        // 4. Format output
        // "12 c 3 c 2 = 17%"
        // Inputs are ALREADY sorted descending in `inputs` array.

        const formattedInputs = inputs.join(" c ");
        const finalPercent = Math.round(currentResult * 100);

        return `${formattedInputs} = ${finalPercent}%`;
    }
}
