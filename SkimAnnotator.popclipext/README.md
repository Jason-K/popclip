# SkimAnnotator

SkimAnnotator is a PopClip extension for capturing structured markdown notes from the active Skim PDF.

## Documentation

- Script architecture and maintenance notes: [scripts/README.md](scripts/README.md)

## Structure

- [Config.json](Config.json): PopClip action definitions.
- [skim_logic.js](skim_logic.js): top-level entrypoint that loads the core workflow.
- [scripts](scripts): action scripts, core orchestration, and shared utilities.
