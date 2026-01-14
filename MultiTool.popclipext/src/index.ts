import { ArithmeticDetector } from "./detectors/arithmetic";
import { CombinationsDetector } from "./detectors/combinations";
import { DateRangeDetector } from "./detectors/date-range";
import { NavigationDetector } from "./detectors/navigation";
import { PhoneDetector } from "./detectors/phone";
import { TimeCalcDetector } from "./detectors/time-calc";
import { UnitsDetector } from "./detectors/units";
import { DetectorRegistry } from "./registry";

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════
// Change this to "QSpace Pro" or "Bloom" then rebuild (npm run build)
const FINDER_APP = "Bloom";
// ══════════════════════════════════════════════════════════════════════════════

// Extend PopClip types
declare const popclip: {
    openUrl(url: string): void;
    pasteText(text: string): void;
};

const registry = new DetectorRegistry();

registry.register(new ArithmeticDetector());
registry.register(new TimeCalcDetector());
registry.register(new UnitsDetector());
registry.register(new CombinationsDetector());
registry.register(new PhoneDetector());
// Do not reference global popclip at module load time (not available yet)
registry.register(new NavigationDetector());
registry.register(new DateRangeDetector());

export const actions = (selection: any) => {
    const text = selection.text.trim();

    if (text.length === 0 || text.length > 1000) {
        return;
    }

    const context: any = { earlyExit: true };
    const result = registry.process(text, context);

    if (!result) {
        return;
    }

    const matchId = context.lastMatchId;

    // For navigation/actions, result might equal text, which is fine.
    // For arithmetic/transforms, we usually want a change, but if the user typed "10+10", result is "20", so it changed.
    // If user typed "10", result is "10" (filtered by arithmetic detector typically), so we return.
    if (result === text && matchId !== "navigation" && matchId !== "date_range" && matchId !== "phone") {
        return;
    }

    // Dynamic UI actions based on detector type
    if (matchId === "navigation") {
        // Check if it looks like a file path
        if (result.startsWith("/") || result.startsWith("~") || result.startsWith(".")) {
            return {
                title: "Open in Finder",
                icon: null,
                after: "nothing",
                // Use file:// URL which will open in user's default file manager
                // Note: This opens with system default, not Bloom/QSpace specifically
                // PopClip's JS sandbox cannot execute shell commands directly
                code: () => {
                    popclip.openUrl("file://" + encodeURI(result.replace(/^~/, "/Users/jason")));
                },
            };
        } else {
            // URL
            return {
                title: "Open in Browser",
                icon: null,
                after: "nothing",
                code: () => popclip.openUrl(encodeURI(result)),
            };
        }
    }

    if (matchId === "date_range") {
        return {
            title: result, // "X days"
            icon: null,
            code: () => result, // Copy to clipboard
        };
    }

    if (matchId === "phone") {
        return {
            title: `Call ${result}`,
            icon: null, // "symbol:phone" is standard but user wants text? "Call (415)..." is title.
            // If icon is null, PopClip shows title.
            code: () => popclip.openUrl("tel:" + result.replace(/[^\d+]/g, "")),
        };
    }

    // Default (Arithmetic, Units, Combinations, Time)
    return {
        title: result,
        icon: null,
        code: () => result,
    };
};
