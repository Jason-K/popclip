import { PhoneDetector } from "../src/detectors/phone";

describe("PhoneDetector", () => {
    const detector = new PhoneDetector();
    const context = {};

    test("US Format", () => {
        expect(detector.match("5551234567", context)).toBe("(555) 123-4567");
    });

    test("Formatted Input", () => {
        expect(detector.match("555-123-4567", context)).toBe("(555) 123-4567");
    });

    test("Invalid Number", () => {
        expect(detector.match("123", context)).toBeNull();
    });
});
