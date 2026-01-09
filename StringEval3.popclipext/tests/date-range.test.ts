import { DateRangeDetector } from "../src/detectors/date-range";

describe("DateRangeDetector", () => {
    const detector = new DateRangeDetector();
    const context = {};

    test("Jan 1 to Jan 5", () => {
        // 4 days
        expect(detector.match("Jan 1, 2023 to Jan 5, 2023", context)).toBe("4 days");
    });

    test("Forward Range", () => {
        expect(detector.match("2023-01-01 - 2023-02-01", context)).toBe("31 days");
    });

    test("Date without year (current year assumed by Date)", () => {
        // This might be flaky if run cross-year, but good enough logic test
        const r = detector.match("Jan 1 to Jan 2", context);
        expect(r).toBe("1 day");
    });
});
