import { useState } from 'react'
import { supabase } from '../lib/supabase'

const SKILL_LEVELS = [
  { value: '',             label: 'N/A — Not sure / prefer not to say' },
  { value: 'beginner',     label: 'Beginner'     },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced',     label: 'Advanced'     },
]

export default function JoinPage() {
  const [form, setForm] = useState({
    name: '', mobile: '', skill_level: '', university: '', message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [error,      setError]      = useState(null)

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error: err } = await supabase.from('contact_messages').insert({
      name:        form.name.trim(),
      mobile:      form.mobile.trim(),
      skill_level: form.skill_level || null,
      university:  form.university.trim() || null,
      message:     form.message.trim(),
    })
    if (err) {
      setError('Something went wrong — please try again.')
      setSubmitting(false)
      return
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="pt-32 pb-24 max-w-lg mx-auto px-4 text-center">
        <img src="/logo.png" alt="" className="h-24 w-auto mx-auto mb-8 drop-shadow-2xl" />
        <h2 className="text-white text-3xl font-black uppercase tracking-tight mb-3">
          Message Sent!
        </h2>
        <p className="text-white/55 text-base leading-relaxed">
          Thanks for getting in touch. We'll reach out to you soon — see you on the ice!
        </p>
      </div>
    )
  }

  return (
    <div className="pt-24 pb-24 max-w-xl mx-auto px-4">
      <div className="mb-10">
        <p className="text-[#641e31] text-xs font-black uppercase tracking-[0.3em] mb-2">
          Southampton Spitfires
        </p>
        <h1 className="text-white text-4xl sm:text-5xl font-black uppercase tracking-tight">
          Join Us
        </h1>
        <p className="text-white/40 mt-3 text-sm leading-relaxed">
          Interested in joining the Spitfires? Fill in your details below and we'll be in touch.
          No experience necessary — all levels welcome.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field label="Name *">
          <input
            type="text"
            value={form.name}
            onChange={set('name')}
            required
            placeholder="Your full name"
            className={inputClass}
          />
        </Field>

        <Field label="Mobile Number *">
          <input
            type="tel"
            value={form.mobile}
            onChange={set('mobile')}
            required
            placeholder="+44 7xxx xxxxxx"
            className={inputClass}
          />
        </Field>

        <Field label="Hockey Skill Level">
          <select
            value={form.skill_level}
            onChange={set('skill_level')}
            className={inputClass}
          >
            {SKILL_LEVELS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>

        <Field label="University">
          <input
            type="text"
            value={form.university}
            onChange={set('university')}
            placeholder="e.g. University of Southampton"
            className={inputClass}
          />
        </Field>

        <Field label="Message *">
          <textarea
            value={form.message}
            onChange={set('message')}
            required
            rows={5}
            placeholder="Tell us a bit about yourself and why you'd like to join…"
            className={`${inputClass} resize-none`}
          />
        </Field>

        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="bg-[#641e31] hover:bg-[#7a2540] disabled:opacity-50 text-white font-black px-8 py-4 rounded-lg uppercase tracking-widest text-sm transition-colors"
        >
          {submitting ? 'Sending…' : 'Send Message'}
        </button>

        <p className="text-white/20 text-xs text-center">Fields marked * are required.</p>
      </form>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-white/50 text-xs font-bold uppercase tracking-widest">{label}</label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full bg-[#111827] border border-white/10 rounded-lg px-4 py-3 text-white text-sm ' +
  'placeholder:text-white/20 focus:outline-none focus:border-[#641e31] transition-colors ' +
  '[&>option]:bg-[#111827]'
