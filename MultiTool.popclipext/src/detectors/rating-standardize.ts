import { Context, Detector } from "../registry";

export class RatingStandardizeDetector implements Detector {
    id = "rating_standardize";
    priority = 100;

    private pattern = /(?:([0-9.]+)%?\s*-?\s*)?\(?\s*(\d{2}\.\d{2}\.\d{2}\.\d{2})\s*-?\s*(\d{1,2})\s*-?\s*\[(\d(?:\.\d+)?)\]\s*(\d{1,2})\s*-?\s*(\d{3}[C-J])\s*-?\s*(\d{1,2})\s*(?:-|=)?\s*(\d{1,2})?%?\s*\)?\s*(?:=\s*)?(?:[0-9.]+%?\s*=?\s*)?([0-9.]+)?%?/i;

    match(text: string, context: Context): string | null {
        const lines = text.split("\n");
        const processedLines = lines.map(line => this.processSingleRating(line));
        const processed = processedLines.join("\n");
        if (processed !== text) {
            return processed;
        }
        // If unchanged but the pattern matches, still return standardized text
        const matchedAny = lines.some(line => this.pattern.test(line.trim()));
        return matchedAny ? processed : null;
    }

    private processSingleRating(line: string): string {
        line = line.trim();
        if (!line) return line;

        const pattern = this.pattern;

        const match = line.match(pattern);
        if (!match) return line;

        const percentageRaw = match[1];
        const ratingRef = match[2];
        const wpi = match[3];
        const dfecCode = match[4];
        const postDfec = match[5];
        const occCode = match[6];
        const postOcc = match[7];
        let postAge = match[8];
        let finalPd = match[9];

        // Standardize starting percentage
        let percentage = "1.0";
        if (percentageRaw) {
            const pctValue = parseFloat(percentageRaw.replace('%', ''));
            let val = pctValue > 1 ? pctValue / 100 : pctValue;
            let s = String(val);
            // trim trailing zeros
            if (s.indexOf('.') >= 0) {
                s = s.replace(/\.0+$/, '').replace(/(\..*?)0+$/, '$1');
            }
            percentage = s === '1' ? '1.0' : s;
        }

        // If post-age is missing, use post-occ
        if (!postAge && postOcc) {
            postAge = postOcc;
        }

        // If group didn't capture final PD, try to capture trailing "= 12% PD"
        if (!finalPd) {
            const end = line.match(/([0-9.]+)%?\s*(?:PD)?\s*$/i);
            if (end) {
                finalPd = end[1];
            }
        }

        // Compute final PD if still missing
        if (!finalPd && postAge) {
            const val = Math.round(parseFloat(postAge) * parseFloat(percentage));
            finalPd = String(val);
        } else if (finalPd) {
            const val = Math.round(parseFloat(finalPd.replace('%', '').trim()));
            finalPd = String(val);
        }

        return `${percentage} (${ratingRef} - ${wpi} - [${dfecCode}]${postDfec} - ${occCode} - ${postOcc} - ${postAge}) = ${finalPd}% PD`;
    }
}
