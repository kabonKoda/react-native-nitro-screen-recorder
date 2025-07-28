/*───────────────────────────────────────────────────────────────────────────
 🔊  Logger (emoji + gated by config.showPluginLogs)
───────────────────────────────────────────────────────────────────────────*/
export type PluginLogger = {
  info: (...msg: any[]) => void;
  warn: (...msg: any[]) => void;
  error: (...msg: any[]) => void;
  step: (title: string) => void;
};

const TAG = 'ScreenRecorder - ConfigPlugin';

function supportsColor(): boolean {
  const { NO_COLOR, FORCE_COLOR } = process.env;
  if (NO_COLOR) return false;
  if (FORCE_COLOR === '0') return false;
  return !!process.stdout && process.stdout.isTTY !== false;
}

function blue(s: string) {
  // \x1b[34m = blue, \x1b[39m = default fg (safer than full reset)
  return supportsColor() ? `\x1b[34m${s}\x1b[39m` : s;
}

export function makePluginLogger(enabled: boolean): PluginLogger {
  const baseTag = blue(TAG);
  const fmt = (emoji: string, parts: any[]) =>
    `[${emoji} ${baseTag}] ${parts.map(String).join(' ')}`;

  return {
    info: (...msg: any[]) => enabled && console.log(fmt('🟢', msg)),
    warn: (...msg: any[]) => enabled && console.warn(fmt('⚠️', msg)),
    error: (...msg: any[]) => enabled && console.error(fmt('🔴', msg)),
    step: (title: string) =>
      enabled && console.log(fmt('🟢', [`— ${title} —`])),
  } as PluginLogger;
}
