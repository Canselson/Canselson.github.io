import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// In-memory rate limit: IP → { count, resetAt }
// Resets per warm serverless instance; prevents rapid repeat submissions
const rateLimits = new Map()
const WINDOW_MS     = 60_000 // 1 minute
const MAX_PER_WINDOW = 3

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ip  = req.headers['x-real-ip'] || req.headers['x-forwarded-for']?.split(',')[0].trim() || 'unknown'
  const now = Date.now()
  const entry = rateLimits.get(ip)

  if (entry && now < entry.resetAt) {
    if (entry.count >= MAX_PER_WINDOW) {
      return res.status(429).json({ error: 'Too many requests — please wait a moment before trying again.' })
    }
    entry.count++
  } else {
    rateLimits.set(ip, { count: 1, resetAt: now + WINDOW_MS })
  }

  const { name, mobile, skill_level, university, message, _pot } = req.body ?? {}

  // Honeypot: filled only by bots — silently accept so we don't reveal the check
  if (_pot) return res.status(200).json({ ok: true })

  if (!name?.trim() || !mobile?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'Required fields missing' })
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

  const { error } = await supabase.from('contact_messages').insert({
    name:        name.trim(),
    mobile:      mobile.trim(),
    skill_level: skill_level || null,
    university:  university?.trim() || null,
    message:     message.trim(),
  })

  if (error) return res.status(500).json({ error: 'Failed to send message — please try again.' })

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'Southampton Spitfires <noreply@southamptonspitfires.me>',
    to: 'suiihc@soton.ac.uk',
    subject: `New contact form submission from ${name.trim()}`,
    text: [
      `Name: ${name.trim()}`,
      `Mobile: ${mobile.trim()}`,
      `Skill level: ${skill_level || 'Not specified'}`,
      `University: ${university?.trim() || 'Not specified'}`,
      ``,
      `Message:`,
      message.trim(),
    ].join('\n'),
  })

  return res.status(200).json({ ok: true })
}
