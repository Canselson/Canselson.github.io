import { supabase } from './supabase'

// Records an admin action for the audit log. Never throws — a logging
// failure should never block or roll back the action it's describing.
export async function logAudit({ action, entityType, entityId = null, summary }) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const actorEmail = session?.user?.email
    if (!actorEmail) return
    await supabase.from('admin_audit_log').insert({
      actor_email: actorEmail,
      action,
      entity_type: entityType,
      entity_id: entityId != null ? String(entityId) : null,
      summary,
    })
  } catch (err) {
    console.error('Failed to record audit log entry', err)
  }
}