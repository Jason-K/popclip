import { TimeCalcDetector } from "../src/detectors/time-calc";

describe("TimeCalcDetector", () => {
    const detector = new TimeCalcDetector();
    const context = {};

    test("Now + Duration", () => {
        // Mock Date? For now, we can check format or use a loose match if we can't mock.
        // Or regex match the result.
        // "now + 2h" -> regex /^\d{1,2}:\d{2} [AP]M$/
        const result = detector.match("now + 2h", context);
        expect(result).toMatch(/^\d{1,2}:\d{2} [AP]M$/);
    });

    test("Time + Duration (9am + 2h)", () => {
        expect(detector.match("9am + 2h", context)).toBe("11:00 AM");
    });

    test("Time - Duration (14:30 - 30m)", () => {
        expect(detector.match("14:30 - 30m", context)).toBe("14:00");
    });

    test("Mixed Case (9AM + 2hours)", () => {
        expect(detector.match("9AM + 2h", context)).toBe("11:00 AM");
    });
});
