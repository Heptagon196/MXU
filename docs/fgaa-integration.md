# FGAA integration branch

This fork tracks MaaXYZ/MXU and adds FGAA feature pages without replacing MXU's instance tabs.

- `src/fgaa/ProductShell.tsx` owns feature navigation. The original `App` stays mounted while switching pages, preserving running tasks and instance state.
- `src/fgaa/battleLibrary.ts` implements `.fga` import/export, immutable edits, validation and storage backups. Unknown FGA fields remain intact.
- `src/fgaa/battleStore.ts` owns library state. Storage is currently client-local; native file storage and migration of the prior Flutter library are still pending.
- `src/fgaa/BattleLibraryPage.tsx` supports import, export, duplication, metadata and party editing. `SkillEditor.tsx` adds nine servant skills, repeated/special targets, master skills, command spells, enemy selection, order change, ordered NPs and insertion within wave/turn history. Undo/redo stays with each configuration across feature navigation. Remaining battle settings are being migrated.
- `skillPlan.ts` models the editable command grammar. Uneditable imported commands remain unchanged. Invalid edits that merge attacks beyond the card limit leave the original command intact. Game execution still uses the original Kotlin parser, not this editor parser.
- The Chaldea feature page is an explicit integration placeholder. It does not yet embed the module.
- Battle settings now have a separate section from the skill board. Server, raid delay, enemy targeting and all support selection fields are editable. Inactive support preferences remain stored when switching modes. Image-reference lists use explicit Apply buttons before library save. Material selection, card policies and spam settings are still pending migration.
- Translation resources live under `src/i18n/locales/fgaa-*`. Other languages fall back to English.

Verification: `pnpm build`, `pnpm test`, `pnpm test:fgaa:browser`. Browser tests use an isolated headless Edge profile on Windows, Chromium on other platforms. They never reuse the user's browser profile. Install Playwright's Chromium browser if testing on another platform.

The host's `tools/verify-mxu-planner.mjs` compares 202 editor command cases and their serialized output against the real FGA JVM parser. Run it through this repository's `pnpm exec tsx` after building the host engine and setting `JAVA_HOME`. The current 16 unit tests and 5 browser tests also cover import/export, persistence, mobile width, skill insertion, repeated targets, NP order, undo/redo, rejection of invalid attack merges and battle/support preference editing.

The branch does not yet implement FGA execution through Tauri or Android. The FGAA host repository still contains the working JVM parser/preferences bridge and the original Flutter integration baseline.

The settings browser test exports `test-results/fgaa-settings.fga`. From the host root, run `node tools/verify-mxu-preferences.mjs` with `JAVA_HOME` configured to validate this actual UI export through the FGA `IBattleConfig` adapter.

Upstream updates should be merged into this integration branch and tested before updating the host's pinned commit. Keep application-specific changes within `src/fgaa` and the few documented entry points wherever possible.
