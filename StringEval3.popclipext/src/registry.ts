export interface Detector {
    id: string;
    priority: number;
    match(text: string, context: Context): string | null;
}

export interface Context {
    earlyExit?: boolean;
    lastMatchId?: string;
    matches?: Array<{ id: string; raw: any }>;
    [key: string]: any;
}

export class DetectorRegistry {
    private detectors: Detector[] = [];

    register(detector: Detector) {
        this.detectors.push(detector);
        this.detectors.sort((a, b) => b.priority - a.priority); // Descending priority
    }

    process(text: string, context: Context = {}): string | null {
        if (!context.matches) {
            context.matches = [];
        }

        for (const detector of this.detectors) {
            try {
                const result = detector.match(text, context);
                if (result) {
                    context.matches.push({ id: detector.id, raw: result });
                    context.lastMatchId = detector.id;

                    if (context.earlyExit) {
                        return result;
                    }
                }
            } catch (error) {
                console.error(`Detector ${detector.id} failed:`, error);
            }
        }

        // Return the result of the highest priority match if earlyExit wasn't triggered
        // In our Lua logic, it usually takes the first match, which is what we do here effectively
        // because we return immediately on match if earlyExit is true.
        // If earlyExit is false, we might want to return the best match?
        // For now, let's assume we return the *first* match we found if earlyExit was false but we finished the loop.
        // But wait, if earlyExit is false, do we keep going?
        // The Lua logic:
        // if not matched then
        //     matched = normalizeResult(result)
        //     matchedId = detector.id
        //     if context.earlyExit then break end
        // end

        // So Lua logic captures the FIRST match (highest priority), and optionally stops.
        // So we should capture the first result.

        // If we have matches, return the result AND the ID.
        // The current signature returns string | null. We might need to change it or attach it to context?
        // Changing signature might break interface. 
        // The `context.lastMatchId` is already set! We can rely on that in the caller.

        if (context.matches.length > 0) {
            // Ensure lastMatchId corresponds to the returned result (first match)
            context.lastMatchId = context.matches[0].id;
            return context.matches[0].raw as string;
        }

        return null;
    }
}
