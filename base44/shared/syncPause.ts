// Shared helper: checks if log-sync is paused.
// v0.9018 NACHFOLGE: Per-user pause — each user controls their own sync independently.
// The flag is stored in UserHuntingSettings.sync_paused (boolean, default false).
// Falls back to the legacy global AppSetting 'sync_paused' for admin-level global halt.

export async function isSyncPaused(base44: any, userId?: string): Promise<boolean> {
  try {
    // Per-user pause (preferred)
    if (userId) {
      const settings = await base44.asServiceRole.entities.UserHuntingSettings.filter({ user_id: userId });
      if (settings && settings.length > 0 && settings[0].sync_paused === true) {
        return true;
      }
    }
    // Legacy global pause (admin emergency stop)
    const globalSettings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'sync_paused' });
    return !!(globalSettings && globalSettings.length > 0 && globalSettings[0].value === 'true');
  } catch {
    return false;
  }
}