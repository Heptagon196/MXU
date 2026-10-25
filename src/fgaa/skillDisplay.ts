type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };

/** Called directly by the editor's user gesture; only exit fullscreen we own. */
export async function enterSkillDisplay(): Promise<() => Promise<void>> {
  if (!window.matchMedia('(pointer: coarse)').matches) return async () => {};
  let ownedFullscreen = false;
  let locked = false;
  const orientation = screen.orientation as LockableOrientation | undefined;
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
      ownedFullscreen = true;
    }
    if (orientation?.lock) {
      await orientation.lock('landscape');
      locked = true;
    }
  } catch {
    // Some mobile browsers/WebViews deny locking. The portrait UI asks to rotate.
  }
  return async () => {
    if (locked) orientation?.unlock();
    if (ownedFullscreen && document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* Browser may already have exited. */
      }
    }
  };
}
