import { UnitsDetector } from "../src/detectors/units";

describe("UnitsDetector", () => {
    const detector = new UnitsDetector();
    const context = {};

    test("Length Conversion", () => {
        // 100km to mi. 100 * 0.621371 = 62.14
        expect(detector.match("100km to mi", context)).toBe("62.14 mi");
    });

    test("Mass Conversion", () => {
        // 1kg to lb. 2.20462
        expect(detector.match("1kg to lb", context)).toBe("2.20 lb");
    });

    test("Invalid Unit", () => {
        expect(detector.match("100foo to bar", context)).toBeNull();
    });
});
