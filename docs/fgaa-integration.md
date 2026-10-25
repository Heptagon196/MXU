# FGAA integration branch

This fork tracks MaaXYZ/MXU and adds FGAA feature pages without replacing MXU's instance tabs.

- `src/fgaa/ProductShell.tsx` owns feature navigation. The original `App` stays mounted while switching pages, preserving running tasks and instance state.
- `src/fgaa/battleLibrary.ts` implements `.fga` import/export, immutable edits, validation and storage backups. Unknown FGA fields remain intact.
- `src/fgaa/battleStore.ts` owns library state. Storage is currently client-local; native file storage and migration of the prior Flutter library are still pending.
- `src/fgaa/BattleLibraryPage.tsx` supports import, export, duplication, metadata and party editing. `SkillEditor.tsx` adds nine servant skills, repeated/special targets, master skills, command spells, enemy selection, order change, ordered NPs and insertion within wave/turn history. Undo/redo stays with each configuration across feature navigation. Remaining battle settings are being migrated.
- `skillPlan.ts` models the editable command grammar. Uneditable imported commands remain unchanged. Invalid edits that merge attacks beyond the card limit leave the original command intact. Game execution still uses the original Kotlin parser, not this editor parser.
- The Chaldea feature page is an explicit integration placeholder. It does not yet embed the module.
- Battle settings now have a separate section from the skill board. Server, raid delay, enemy targeting and all support selection fields are editable. Inactive support preferences remain stored when switching modes. Image-reference lists use explicit Apply buttons before library save. Material selection supports bilingual search over 97 FGA materials and preserves unknown imported identifiers. Card policies and spam settings are still pending migration.
- `src/i18n/locales/fgaa-materials.json` is generated from the pinned FGA enum and English/Chinese localization. Regenerate from the host with `python tools/generate-material-catalog.py --mxu`; add `--check` to verify it after an upstream update.
- Translation resources live under `src/i18n/locales/fgaa-*`. Other languages fall back to English.

Verification: `pnpm build`, `pnpm test`, `pnpm test:fgaa:browser`. Browser tests use an isolated headless Edge profile on Windows, Chromium on other platforms. They never reuse the user's browser profile. Install Playwright's Chromium browser if testing on another platform.

The host's `tools/verify-mxu-planner.mjs` compares 202 editor command cases and their serialized output against the real FGA JVM parser. Run it through this repository's `pnpm exec tsx` after building the host engine and setting `JAVA_HOME`. The current 16 unit tests and 5 browser tests also cover import/export, persistence, mobile width, skill insertion, repeated targets, NP order, undo/redo, rejection of invalid attack merges and battle/support preference editing.

The branch does not yet implement FGA execution through Tauri or Android. The FGAA host repository still contains the working JVM parser/preferences bridge and the original Flutter integration baseline.

The settings browser test exports `test-results/fgaa-settings.fga`. From the host root, run `node tools/verify-mxu-preferences.mjs` with `JAVA_HOME` configured to validate this actual UI export, including the selected material enum, through the FGA `IBattleConfig` adapter. Six browser tests now pass, including unknown material preservation.

Upstream updates should be merged into this integration branch and tested before updating the host's pinned commit. Keep application-specific changes within `src/fgaa` and the few documented entry points wherever possible.

## Card policies

`CardSettings.tsx` edits wave-specific card and servant ordering, Brave Chain, rearrangement and shuffle settings. Reorder controls preserve other waves; added waves copy the final order. The original FGA format is retained: priorities use newline-separated waves, servant tokens contain no spaces, boolean/Brave Chain wave lists use commas, and shuffle wave is an integer. Unsupported priority values remain unchanged until an explicit reset (which can be undone).

Current validation: 18 unit tests, 6 browser tests and the host's actual-export JVM verifier pass. The preference browser case changes two card waves, servant ordering, Brave Chain, rearrangement and shuffle before exporting. Spam settings, native execution and the remaining migration work are not yet implemented here.
