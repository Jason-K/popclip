import { NavigationDetector } from "../src/detectors/navigation";

describe("NavigationDetector", () => {
    const detector = new NavigationDetector();
    const context = {};

    test("URL Detection", () => {
        expect(detector.match("google.com", context)).toBe("https://google.com");
        expect(detector.match("https://example.com", context)).toBe("https://example.com");
        expect(detector.match("www.test.org", context)).toBe("www.test.org");
    });

    test("Absolute Path", () => {
        expect(detector.match("/Users/jason/Documents", context)).toBe("/Users/jason/Documents");
    });

    test("Relative Path", () => {
        expect(detector.match("~/Scripts", context)).toBe("~/Scripts");
    });

    test("Ignores Math", () => {
        expect(detector.match("1.5", context)).toBeNull();
    });
});
