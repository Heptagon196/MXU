# FGAA integration branch

This fork tracks MaaXYZ/MXU and adds FGAA feature pages without replacing MXU's instance tabs.

- `src/fgaa/ProductShell.tsx` owns feature navigation. The original `App` stays mounted while switching pages, preserving running tasks and instance state.
- `src/fgaa/battleLibrary.ts` implements `.fga` import/export, immutable edits, validation and storage backups. Unknown FGA fields remain intact.
- `src/fgaa/battleStore.ts` owns library state. Storage is currently client-local; native file storage and migration of the prior Flutter library are still pending.
- `src/fgaa/BattleLibraryPage.tsx` supports import, export, duplication, metadata and party editing. The full FGA skill editor and remaining settings are being migrated.
- The Chaldea feature page is an explicit integration placeholder. It does not yet embed the module.
- Translation resources live under `src/i18n/locales/fgaa-*`. Other languages fall back to English.

Verification: `pnpm build`, `pnpm test`, `pnpm test:fgaa:browser`. Browser tests use an isolated headless Edge profile on Windows, Chromium on other platforms. They never reuse the user's browser profile. Install Playwright's Chromium browser if testing on another platform.

The branch does not yet implement FGA execution through Tauri or Android. The FGAA host repository still contains the working JVM parser/preferences bridge and the original Flutter integration baseline.

Upstream updates should be merged into this integration branch and tested before updating the host's pinned commit. Keep application-specific changes within `src/fgaa` and the few documented entry points wherever possible.
