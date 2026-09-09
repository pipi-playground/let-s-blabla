/**
 * 방해금지 시간대 판별. start > end 인 경우(예: 23:00~08:00)는
 * 자정을 넘기는 구간으로 취급한다.
 */
export function isWithinDnd(
  settings: { enabled: boolean; start_time: string; end_time: string; timezone: string },
  now: Date = new Date()
): boolean {
  if (!settings.enabled) return false;

  const nowInTz = new Intl.DateTimeFormat("en-GB", {
    timeZone: settings.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now); // "HH:mm"

  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
    return h * 60 + m;
  };

  const cur = toMinutes(nowInTz);
  const start = toMinutes(settings.start_time);
  const end = toMinutes(settings.end_time);

  if (start === end) return true; // 24시간 방해금지
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end; // 자정 넘어가는 구간
}
