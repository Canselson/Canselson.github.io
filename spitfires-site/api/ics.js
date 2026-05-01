import { createClient } from '@supabase/supabase-js'

const TEAM_NAMES = {
  'a-team': 'A Team',
  'b-team': 'B Team',
  'c-team': 'C Team',
  'd-team': 'D Team',
  'womens': "Women's",
}

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .order('starts_at', { ascending: true })

  if (error) {
    res.status(500).send('Error fetching events')
    return
  }

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Content-Disposition', 'inline; filename="spitfires.ics"')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.send(buildICS(events || []))
}

function buildICS(events) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Southampton Spitfires//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Southampton Spitfires',
    'X-WR-TIMEZONE:Europe/London',
  ]

  for (const ev of events) {
    const start = new Date(ev.starts_at)
    const end   = ev.ends_at
      ? new Date(ev.ends_at)
      : new Date(start.getTime() + (ev.duration_hours ?? 2) * 60 * 60 * 1000)
    const teamLabel = TEAM_NAMES[ev.team] ?? 'Spitfires'
    const summary = ev.type === 'game'
      ? `${teamLabel} ${ev.home_away === 'home' ? 'Home' : 'Away'} vs ${ev.opponent}`
      : ev.title

    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.id}@southamptonspitfires.me`,
      `DTSTAMP:${toICSDate(new Date())}`,
      `DTSTART:${toICSDate(start)}`,
      `DTEND:${toICSDate(end)}`,
      `SUMMARY:${escapeICS(summary)}`,
      ...(ev.location    ? [`LOCATION:${escapeICS(ev.location)}`]    : []),
      ...(ev.description ? [`DESCRIPTION:${escapeICS(ev.description)}`] : []),
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

function toICSDate(date) {
  return date.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
}

function escapeICS(str) {
  return str.replace(/\\/g, '\\\\').replace(/[,;]/g, c => `\\${c}`).replace(/\n/g, '\\n')
}
