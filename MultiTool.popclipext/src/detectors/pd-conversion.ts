import { Context, Detector } from "../registry";

function formatCurrency(n: number): string {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const keyValues: Record<number, number> = {
    1: 3, 2: 6, 3: 9, 4: 12, 5: 15, 6: 18, 7: 21, 8: 24, 9: 27, 10: 30.25,
    11: 34.25, 12: 38.25, 13: 42.25, 14: 46.25, 15: 50.5, 16: 55.5, 17: 60.5,
    18: 65.5, 19: 70.5, 20: 75.5, 21: 80.5, 22: 85.5, 23: 90.5, 24: 95.5,
    25: 100.75, 26: 106.75, 27: 112.75, 28: 118.75, 29: 124.75, 30: 131,
    31: 138, 32: 145, 33: 152, 34: 159, 35: 166, 36: 173, 37: 180, 38: 187,
    39: 194, 40: 201, 41: 208, 42: 215, 43: 222, 44: 229, 45: 236, 46: 243,
    47: 250, 48: 257, 49: 264, 50: 271.25, 51: 279.25, 52: 287.25, 53: 295.25,
    54: 303.25, 55: 311.25, 56: 319.25, 57: 327.25, 58: 335.25, 59: 343.25,
    60: 351.25, 61: 359.25, 62: 367.25, 63: 375.25, 64: 383.25, 65: 391.25,
    66: 399.25, 67: 407.25, 68: 415.25, 69: 423.25, 70: 433.25, 71: 449.25,
    72: 465.25, 73: 481.25, 74: 497.25, 75: 513.25, 76: 529.25, 77: 545.25,
    78: 561.25, 79: 577.25, 80: 593.25, 81: 609.25, 82: 625.25, 83: 641.25,
    84: 657.25, 85: 673.25, 86: 689.25, 87: 705.25, 88: 721.25, 89: 737.25,
    90: 753.25, 91: 769.25, 92: 785.25, 93: 801.25, 94: 817.25, 95: 833.25,
    96: 849.25, 97: 865.25, 98: 881.25, 99: 897.25
};

export class PdConversionDetector implements Detector {
    id = "pd_conversion";
    priority = 120;

    match(text: string, context: Context): string | null {
        const trimmed = text.trim();
        if (!trimmed) return null;

        const m = trimmed.match(/\b([1-9][0-9]?)%?\s*pd\b/i);
        if (!m) return null;

        const percentKey = parseInt(m[1], 10);
        if (!(percentKey >= 1 && percentKey <= 99)) return null;

        const weeks = keyValues[percentKey];
        if (weeks == null) return null;

        const paymentValue = weeks * 290.0;
        const dollars = formatCurrency(Number(paymentValue.toFixed(2)));
        const weeksText = `${weeks} weeks`;
        const both = `${weeksText}, ${dollars}`;

        (context as any).pd = {
            percent: percentKey,
            weeks: weeksText,
            dollars,
            both,
        };

        return both;
    }
}
