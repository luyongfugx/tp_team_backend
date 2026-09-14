import { resolveLocale } from "@/lib/i18n";

export type TeamspaceTranslations = { w: Record<string, string>; s: Record<string, string> };
export function isBaseTeamspaceLocale(locale: string) {
  return ["en", "zh-Hans", "zh-Hant"].includes(resolveLocale(locale));
}
export function isRTLTeamspaceLocale(locale: string) {
  return ["ar", "arz", "he", "fa", "ur", "ps", "dv", "yi"].includes(resolveLocale(locale));
}
const pending = new Map<string, Promise<TeamspaceTranslations | undefined>>();
const loaded = new Map<string, TeamspaceTranslations>();
export function cachedTeamspaceTranslations(locale: string) {
  return loaded.get(resolveLocale(locale));
}
export function loadTeamspaceTranslations(locale: string): Promise<TeamspaceTranslations | undefined> {
  const resolved = resolveLocale(locale);
  if (isBaseTeamspaceLocale(resolved)) return Promise.resolve(undefined);
  let task = pending.get(resolved);
  if (!task) {
    task = import(`./locales/${resolved}.json`).then(module => {
      const data = module.default as TeamspaceTranslations;
      loaded.set(resolved, data);
      return data;
    });
    pending.set(resolved, task);
    void task.catch(() => pending.delete(resolved));
  }
  return task;
}
