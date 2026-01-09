import { DetectorRegistry } from "./registry";
import { ArithmeticDetector } from "./detectors/arithmetic";
import { TimeCalcDetector } from "./detectors/time-calc";
import { UnitsDetector } from "./detectors/units";
import { CombinationsDetector } from "./detectors/combinations";
import { PhoneDetector } from "./detectors/phone";
import { NavigationDetector } from "./detectors/navigation";
import { DateRangeDetector } from "./detectors/date-range";

// Extend PopClip types
declare const popclip: {
    openUrl(url: string): void;
};

const registry = new DetectorRegistry();

registry.register(new ArithmeticDetector());
registry.register(new TimeCalcDetector());
registry.register(new UnitsDetector());
registry.register(new CombinationsDetector());
registry.register(new PhoneDetector());
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
            // Encode path parts to handle spaces
            const encPath = encodeURI(result);
            return {
                title: "Open in Finder",
                icon: null,
                code: () => popclip.openUrl("file://" + encPath),
            };
        } else {
            // URL
            return {
                title: "Open in Browser",
                icon: null,
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
