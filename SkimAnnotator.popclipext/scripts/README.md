# SkimAnnotator Script Architecture

This extension uses a layered script layout to keep actions small and core logic reusable.

## Directory Layout

- `actions/`
  - Per-button entry scripts used directly by PopClip actions.
  - `skim_action_runner.js` is a shared action-level launcher.
- `core/`
  - `skim_core.js` contains the main capture workflow.
- `utils/`
  - Shared utility modules for OCR, date parsing, Skim automation, filesystem/state handling, and rendering.
  - `util_loader.js` initializes and wires utility dependencies.

## Runtime Flow

1. PopClip action runs one script in `scripts/actions/`.
2. Action script loads `scripts/actions/skim_action_runner.js`.
3. Action runner loads `scripts/core/skim_core.js` and passes the mode (for example `h2`, `doc_header`).
4. Core loads `scripts/utils/util_loader.js`.
5. Loader imports utility modules and returns composed utility bundles.
6. Core executes the workflow and performs capture/output.

## Action Mapping

Action scripts currently include:

- `skim_l1.js`
- `skim_h2.js`
- `skim_h3.js`
- `skim_h4.js`
- `skim_h5.js`
- `skim_h6.js`
- `skim_blockquote.js`
- `skim_inline_quote.js`
- `skim_highlight.js`

These are referenced by action commands in `../Config.json`.

## Utility Modules

- `util_ocr.js`: OCR cleanup and text normalization.
- `util_date.js`: date parsing and Level 1 default-title building.
- `util_skim.js`: Skim data extraction and annotation calls.
- `util_fs.js`: file IO, state persistence, tail checks, and VS Code-open checks.
- `util_render.js`: markdown heading/render helpers, metadata, and RTF generation.
- `util_loader.js`: utility loading and dependency composition.

## Adding a New Action

1. Add a new `scripts/actions/skim_<name>.js` script that calls `runMode("<mode>")`.
2. Add the action entry in `../Config.json` with shell script path `osascript -l JavaScript scripts/actions/skim_<name>.js`.
3. Handle `<mode>` in `scripts/core/skim_core.js` and/or shared utilities.

## Editing Guidance

- Keep domain logic in `utils/` whenever possible.
- Keep `core/skim_core.js` focused on orchestration.
- Keep `actions/` scripts minimal and mode-specific.
