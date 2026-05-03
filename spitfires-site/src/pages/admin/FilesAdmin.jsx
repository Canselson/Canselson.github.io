import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Plus, Upload, Download, Trash2, ChevronDown, ChevronUp, Pencil, FileText } from 'lucide-react'

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FilesAdmin() {
  const { session } = useAuth()
  const [documents, setDocuments]         = useState([])
  const [loading, setLoading]             = useState(true)
  const [expandedId, setExpandedId]       = useState(null)
  const [versions, setVersions]           = useState({})
  const [versionsLoading, setVersionsLoading] = useState({})
  const [docModal, setDocModal]           = useState(null) // null | { mode: 'add'|'edit', doc? }
  const [deleteConfirm, setDeleteConfirm] = useState(null) // null | { type: 'doc'|'version', ... }
  const [uploadingFor, setUploadingFor]   = useState(null) // docId
  const [uploading, setUploading]         = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => { fetchDocuments() }, [])

  async function fetchDocuments() {
    setLoading(true)
    const { data } = await supabase
      .from('club_documents')
      .select('id, title, description, created_at, document_versions(count)')
      .order('created_at', { ascending: false })
    setDocuments(data ?? [])
    setLoading(false)
  }

  async function fetchVersions(docId) {
    setVersionsLoading(v => ({ ...v, [docId]: true }))
    const { data } = await supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', docId)
      .order('version_number', { ascending: false })
    setVersions(v => ({ ...v, [docId]: data ?? [] }))
    setVersionsLoading(v => ({ ...v, [docId]: false }))
  }

  function toggleExpand(docId) {
    if (expandedId === docId) {
      setExpandedId(null)
    } else {
      setExpandedId(docId)
      if (!versions[docId]) fetchVersions(docId)
    }
  }

  function triggerUpload(docId) {
    setUploadingFor(docId)
    fileInputRef.current.click()
  }

  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file || !uploadingFor) { e.target.value = ''; return }
    const docId = uploadingFor
    setUploadingFor(null)
    e.target.value = ''
    setUploading(true)

    // Determine next version number
    const { data: latest } = await supabase
      .from('document_versions')
      .select('version_number')
      .eq('document_id', docId)
      .order('version_number', { ascending: false })
      .limit(1)
    const nextVersion = latest?.length ? latest[0].version_number + 1 : 1

    const ext      = file.name.includes('.') ? file.name.split('.').pop() : ''
    const filePath = `${docId}/${crypto.randomUUID()}${ext ? '.' + ext : ''}`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file)

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { error: dbError } = await supabase.from('document_versions').insert({
      document_id:    docId,
      version_number: nextVersion,
      file_name:      file.name,
      file_path:      filePath,
      file_size:      file.size,
      uploader_email: session.user.email,
    })

    if (dbError) {
      alert('Failed to record version: ' + dbError.message)
      setUploading(false)
      return
    }

    setUploading(false)
    fetchDocuments()
    setExpandedId(docId)
    fetchVersions(docId)
  }

  async function downloadVersion(filePath, fileName) {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 60)
    if (error) { alert('Could not generate download link'); return }
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = fileName
    a.click()
  }

  async function deleteVersion(version) {
    await supabase.storage.from('documents').remove([version.file_path])
    await supabase.from('document_versions').delete().eq('id', version.id)
    setVersions(v => ({
      ...v,
      [version.document_id]: v[version.document_id].filter(x => x.id !== version.id),
    }))
    fetchDocuments()
    setDeleteConfirm(null)
  }

  async function deleteDocument(doc) {
    const { data: versionList } = await supabase
      .from('document_versions')
      .select('file_path')
      .eq('document_id', doc.id)
    if (versionList?.length) {
      await supabase.storage.from('documents').remove(versionList.map(v => v.file_path))
    }
    await supabase.from('club_documents').delete().eq('id', doc.id)
    setDocuments(d => d.filter(x => x.id !== doc.id))
    if (expandedId === doc.id) setExpandedId(null)
    setDeleteConfirm(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-widest text-white">Files</h1>
          <p className="text-white/40 text-xs mt-0.5">Club documents and version history</p>
        </div>
        <button
          onClick={() => setDocModal({ mode: 'add' })}
          className="flex items-center gap-2 bg-[#00436b] hover:bg-[#005a8f] text-white text-xs font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={13} />
          <span>New Document</span>
        </button>
      </div>

      {uploading && (
        <div className="mb-4 flex items-center gap-3 bg-[#111827] border border-white/10 rounded-lg px-4 py-3 text-white/60 text-xs">
          <div className="w-3.5 h-3.5 border border-white/20 border-t-white/60 rounded-full animate-spin shrink-0" />
          Uploading…
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-20 text-white/20 text-sm uppercase tracking-widest">
          No documents yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {documents.map(doc => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              expanded={expandedId === doc.id}
              versions={versions[doc.id]}
              versionsLoading={versionsLoading[doc.id]}
              onToggle={() => toggleExpand(doc.id)}
              onEdit={() => setDocModal({ mode: 'edit', doc })}
              onDelete={() => setDeleteConfirm({ type: 'doc', doc })}
              onUpload={() => triggerUpload(doc.id)}
              onDownload={downloadVersion}
              onDeleteVersion={v => setDeleteConfirm({ type: 'version', version: v })}
            />
          ))}
        </div>
      )}

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

      {docModal && (
        <DocModal
          mode={docModal.mode}
          initialDoc={docModal.doc}
          onClose={() => setDocModal(null)}
          onSaved={() => { setDocModal(null); fetchDocuments() }}
        />
      )}

      {deleteConfirm?.type === 'doc' && (
        <ConfirmModal
          message={`Delete "${deleteConfirm.doc.title}" and all its versions? This cannot be undone.`}
          onConfirm={() => deleteDocument(deleteConfirm.doc)}
          onClose={() => setDeleteConfirm(null)}
        />
      )}

      {deleteConfirm?.type === 'version' && (
        <ConfirmModal
          message={`Delete v${deleteConfirm.version.version_number} (${deleteConfirm.version.file_name})? This cannot be undone.`}
          onConfirm={() => deleteVersion(deleteConfirm.version)}
          onClose={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}

// ─── Document Card ────────────────────────────────────────────────────────────

function DocumentCard({ doc, expanded, versions, versionsLoading, onToggle, onEdit, onDelete, onUpload, onDownload, onDeleteVersion }) {
  const versionCount = doc.document_versions?.[0]?.count ?? 0

  return (
    <div className="bg-[#111827] border border-white/10 rounded-xl overflow-hidden">
      <div className="flex items-center gap-4 px-5 py-4">
        <FileText size={17} className="text-[#00436b] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm truncate">{doc.title}</p>
          {doc.description && (
            <p className="text-white/40 text-xs mt-0.5 truncate">{doc.description}</p>
          )}
        </div>
        <span className="text-white/25 text-xs shrink-0 hidden sm:block">
          {versionCount} version{versionCount !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={onUpload} title="Upload new version"
            className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <Upload size={14} />
          </button>
          <button onClick={onEdit} title="Edit"
            className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete} title="Delete document"
            className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 size={14} />
          </button>
          <button onClick={onToggle} title={expanded ? 'Collapse' : 'Show versions'}
            className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/10 bg-[#0d1520]">
          {versionsLoading ? (
            <div className="p-5 text-white/30 text-xs text-center">Loading…</div>
          ) : !versions?.length ? (
            <div className="p-5 text-white/20 text-xs text-center uppercase tracking-widest">
              No versions yet — upload one with the <Upload size={11} className="inline-block mx-0.5 -mt-0.5" /> button.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/20 uppercase tracking-widest border-b border-white/5 text-left">
                  <th className="px-5 py-2.5 font-bold w-16">Ver.</th>
                  <th className="px-3 py-2.5 font-bold">File</th>
                  <th className="px-3 py-2.5 font-bold hidden sm:table-cell">Uploaded by</th>
                  <th className="px-3 py-2.5 font-bold hidden md:table-cell">Date</th>
                  <th className="px-3 py-2.5 font-bold hidden lg:table-cell">Size</th>
                  <th className="px-5 py-2.5 w-16" />
                </tr>
              </thead>
              <tbody>
                {versions.map(v => (
                  <tr key={v.id} className="border-b border-white/5 last:border-0">
                    <td className="px-5 py-3 text-white/50 font-bold">v{v.version_number}</td>
                    <td className="px-3 py-3 text-white/80 max-w-[160px] truncate">{v.file_name}</td>
                    <td className="px-3 py-3 text-white/40 hidden sm:table-cell max-w-[180px] truncate">{v.uploader_email}</td>
                    <td className="px-3 py-3 text-white/40 hidden md:table-cell whitespace-nowrap">
                      {new Date(v.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-3 text-white/40 hidden lg:table-cell">{formatSize(v.file_size)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-0.5 justify-end">
                        <button onClick={() => onDownload(v.file_path, v.file_name)} title="Download"
                          className="p-1.5 rounded text-white/40 hover:text-white hover:bg-white/5 transition-colors">
                          <Download size={13} />
                        </button>
                        <button onClick={() => onDeleteVersion(v)} title="Delete version"
                          className="p-1.5 rounded text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Doc Modal ────────────────────────────────────────────────────────────────

function DocModal({ mode, initialDoc, onClose, onSaved }) {
  const [title,       setTitle]       = useState(initialDoc?.title ?? '')
  const [description, setDescription] = useState(initialDoc?.description ?? '')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    setError(null)
    const payload = { title: title.trim(), description: description.trim() || null }
    const { error } = mode === 'add'
      ? await supabase.from('club_documents').insert(payload)
      : await supabase.from('club_documents').update(payload).eq('id', initialDoc.id)
    if (error) { setError(error.message); setLoading(false); return }
    onSaved()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed z-50 inset-x-4 top-1/2 -translate-y-1/2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[420px] bg-[#111827] border border-white/10 rounded-2xl p-6">
        <p className="text-white font-bold mb-5">{mode === 'add' ? 'New Document' : 'Edit Document'}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-white/50 text-xs font-bold uppercase tracking-widest">Title</span>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              autoFocus
              placeholder="e.g. Club Constitution, AGM Minutes…"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-white/50 text-xs font-bold uppercase tracking-widest">Description</span>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional description…"
              className={inputClass + ' resize-none'}
            />
          </label>
          {error && (
            <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">{error}</p>
          )}
          <div className="flex gap-3 mt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest text-white/50 bg-white/5 hover:bg-white/10 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest text-white bg-[#00436b] hover:bg-[#005a8f] disabled:opacity-50 transition-colors">
              {loading ? 'Saving…' : mode === 'add' ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({ message, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false)
  async function confirm() { setLoading(true); await onConfirm() }
  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed z-50 inset-x-4 top-1/2 -translate-y-1/2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[380px] bg-[#111827] border border-white/10 rounded-2xl p-6">
        <p className="text-white font-bold mb-2">Are you sure?</p>
        <p className="text-white/50 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest text-white/50 bg-white/5 hover:bg-white/10 transition-colors">
            Cancel
          </button>
          <button onClick={confirm} disabled={loading}
            className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest text-white bg-[#641e31] hover:bg-[#7a2540] disabled:opacity-50 transition-colors">
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const inputClass = 'bg-[#0a0f1a] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00436b] transition-colors w-full'
