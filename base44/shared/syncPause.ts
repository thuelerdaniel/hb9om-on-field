// Shared helper: checks if the global log-sync pause flag is set.
// When true, all log sync functions (wavelogApi permanent_sync, fetchQrzClubLog, syncClubLog)
// skip execution and return immediately.
// The flag is stored in AppSetting with key='sync_paused', value='true'/'false'.

export async function isSyncPaused(base44: any): Promise<boolean> {
  try {
    const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'sync_paused' });
    return !!(settings && settings.length > 0 && settings[0].value === 'true');
  } catch {
    return false;
  }
}