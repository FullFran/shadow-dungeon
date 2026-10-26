/**
 * The title menu (owner, 2026-10-26: "muy pocos botones"): Play goes to the
 * town, Play online creates or joins a room and walks its town, Options
 * holds everything else. Every service of the game lives in the town (its Esc
 * menu, src/town/town-menu.ts); the title only starts play.
 */
export const TITLE_ENTRIES = ['play', 'online', 'options'] as const;
export type TitleEntry = (typeof TITLE_ENTRIES)[number];

/** The Options submenu, in order; `install` only while the game can be installed. */
export const OPTIONS_ENTRIES = ['settings', 'account', 'achievements', 'prologue', 'credits', 'install'] as const;
export type OptionsEntry = (typeof OPTIONS_ENTRIES)[number];

export const optionsEntries = (installable: boolean): OptionsEntry[] => OPTIONS_ENTRIES.filter((e) => e !== 'install' || installable);

/** i18n key of each entry's label. */
export const TITLE_LABEL: Record<TitleEntry | OptionsEntry, string> = {
  play: 'title.play',
  online: 'lobby.online',
  options: 'title.options',
  settings: 'title.settings',
  account: 'title.account',
  achievements: 'title.achievements',
  prologue: 'title.prologue',
  credits: 'title.credits',
  install: 'pwa.install',
};

/** i18n key of an Options entry's description (the described menu beside the list). */
export const optionsAboutKey = (entry: OptionsEntry): string => `options.about.${entry}`;
