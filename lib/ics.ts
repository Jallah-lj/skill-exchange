const pad = (n: number) => String(n).padStart(2, '0')

function formatUTC(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

export function buildICS({
  title,
  description,
  startAt,
  durationMinutes,
}: {
  title: string
  description: string
  startAt: Date
  durationMinutes: number
}): string {
  const end = new Date(startAt.getTime() + durationMinutes * 60_000)
  const uid = `skillswap-${Date.now()}@skillswap.app`

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SkillSwap//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${formatUTC(startAt)}`,
    `DTEND:${formatUTC(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description.replace(/[\r\n]+/g, '\\n')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadICS(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
