const levels = ["debug", "info", "warn", "error"] as const;
type Level = (typeof levels)[number];

const secretKey =
  /password|cookie|secret|token|authorization|promptText|prompt_text/i;

export function log(
  level: Level,
  message: string,
  fields?: Record<string, unknown>,
): void {
  const configured = process.env.LOG_LEVEL ?? "info";
  const minimum = levels.includes(configured as Level)
    ? (configured as Level)
    : "info";
  if (levels.indexOf(level) < levels.indexOf(minimum)) {
    return;
  }

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields ?? {})) {
    if (secretKey.test(key)) {
      continue;
    }
    safe[key] = value;
  }

  const line = JSON.stringify({ level, message, ...safe });
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}
