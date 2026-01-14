import { Context, Detector } from "../registry";

export class NavigationDetector implements Detector {
    id = "navigation";
    priority = 30; // Low priority to avoid false positives

    match(text: string, context: Context): string | null {
        const trimmed = text.trim();
        if (!trimmed) return null;

        // 1. URL detection
        // Simple regex for likely URLs
        if (/^(https?:\/\/|www\.)[^\s]+$/.test(trimmed) || /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\/?(?:[^\s]*)$/.test(trimmed)) {
            // Basic domain check to avoid "1.5" matching as URL
            if (/^\d+(\.\d+)?$/.test(trimmed)) return null;

            let url = trimmed;
            if (!url.startsWith("http") && !url.startsWith("www.")) {
                url = "https://" + url;
            }
            return url;
        }

        // 2. File Path detection (Unix style for macOS)
        // Absolute paths /Users/..., /System/...
        // Relative paths ~/Documents, ./Script
        if (/^(\/|~|\.)/.test(trimmed) && trimmed.length > 2) {
            // Heuristic: should look like a path
            if (trimmed.includes("/")) {
                // Resolve tilde for local user "jason" (Context adaptation)
                // In a generic extension, we couldn't do this easily without OS info.
                let path = trimmed;
                if (path.startsWith("~")) {
                    path = path.replace(/^~/, "/Users/jason");
                }
                return path;
            }
        }

        return null;
    }
}
