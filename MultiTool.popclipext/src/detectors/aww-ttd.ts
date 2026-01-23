import { Context, Detector } from "../registry";

function formatCurrency(n: number): string {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export class AwwTtdDetector implements Detector {
    id = "aww_ttd";
    priority = 95;

    match(text: string, context: Context): string | null {
        const trimmed = text.trim();
        if (!trimmed) return null;

        const m = trimmed.match(/\$(\d[\d,]*(?:\.\d{1,2})?)\b/);
        if (!m) return null;

        const amountStr = m[1].replace(/,/g, "");
        const base = parseFloat(amountStr);
        if (isNaN(base)) return null;

        const AWW_MAX = 2520.43;
        const AWW_MIN = 378.05;
        const TTD_MAX = 1680.29;
        const TTD_MIN = 252.03;

        let awwToTdDisplay: string;
        let ttdToAwwDisplay: string;

        // Determine AWW→TD conversion with bounds
        if (base > AWW_MAX) {
            awwToTdDisplay = "$1,680.29 (2025 max)";
        } else if (base <= AWW_MIN) {
            awwToTdDisplay = "$252.03 (2025 min)";
        } else {
            const awwToTd = Number(((base * 2) / 3).toFixed(2));
            awwToTdDisplay = formatCurrency(awwToTd);
        }

        // Determine TTD→AWW conversion with bounds
        const ttdRaw = Number(((base * 3) / 2).toFixed(2));
        if (ttdRaw >= TTD_MAX) {
            ttdToAwwDisplay = "max earner (2025)";
        } else if (ttdRaw <= TTD_MIN) {
            ttdToAwwDisplay = "min earner (2025)";
        } else {
            ttdToAwwDisplay = formatCurrency(ttdRaw);
        }

        (context as any).awwTtd = {
            awwToTd: awwToTdDisplay,
            ttdToAww: ttdToAwwDisplay,
        };

        // Return one computed value by default; UI provides both actions.
        return (context as any).awwTtd.awwToTd;
    }
}
