import { ArithmeticDetector } from "../src/detectors/arithmetic";

describe("ArithmeticDetector", () => {
    const detector = new ArithmeticDetector();
    const context = {};

    test("Basic Addition", () => {
        expect(detector.match("10 + 5", context)).toBe("15");
    });

    test("Currency Math", () => {
        expect(detector.match("$100 - $25", context)).toBe("$75");
    });

    test("Percentage Of", () => {
        expect(detector.match("15% of 24000", context)).toBe("3600");
    });

    test("Percentage Add", () => {
        // 100 + 10% = 110
        expect(detector.match("100 + 10%", context)).toBe("110");
    });

    test("Percentage Subtract", () => {
        // 100 - 10% = 90
        expect(detector.match("100 - 10%", context)).toBe("90");
    });

    test("Complex Expression", () => {
        expect(detector.match("10 * 5 + 2", context)).toBe("52");
    });

    test("Ignores plain numbers", () => {
        expect(detector.match("123", context)).toBeNull();
    });

    test("Ignores non-math text", () => {
        expect(detector.match("abc", context)).toBeNull();
    });
});
