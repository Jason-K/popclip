import { CombinationsDetector } from "../src/detectors/combinations";

describe("CombinationsDetector", () => {
    const detector = new CombinationsDetector();
    const context = {};

    test("12c2c3 -> 17%", () => {
        // [12, 3, 2]
        // 1. 0.12 + 0.03(0.88) = 0.1464 -> rounds to 0.15
        // 2. 0.15 + 0.02(0.85) = 0.167 -> rounds to 0.17
        // Result 17%
        expect(detector.match("12c2c3", context)).toBe("12 c 3 c 2 = 17%");
    });

    test("12c12 -> 23%", () => {
        // 0.12 + 0.12(0.88) = 0.2256 -> rounds to 0.23
        expect(detector.match("12c12", context)).toBe("12 c 12 = 23%");
    });
});
