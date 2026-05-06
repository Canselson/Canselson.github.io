import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { FileText, Download } from 'lucide-react'

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    async function fetchDocs() {
      const { data } = await supabase
        .from('club_documents')
        .select('id, title, description, document_versions(version_number, file_name, file_path, uploaded_at)')
        .eq('is_public', true)
        .order('title', { ascending: true })

      setDocuments(
        (data ?? []).map(doc => ({
          ...doc,
          latestVersion: doc.document_versions
            ?.sort((a, b) => b.version_number - a.version_number)[0] ?? null,
        }))
      )
      setLoading(false)
    }
    fetchDocs()
  }, [])

  async function download(filePath, fileName) {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 60)
    if (error) { alert('Could not generate download link'); return }
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = fileName
    a.click()
  }

  return (
    <div className="pt-24 pb-24 max-w-3xl mx-auto px-4">

      <div className="mb-12">
        <p className="text-[#641e31] text-xs font-black uppercase tracking-[0.3em] mb-2">
          Southampton Spitfires
        </p>
        <h1 className="text-white text-4xl sm:text-5xl font-black uppercase tracking-tight">
          Club Documents
        </h1>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}
        </div>
      ) : documents.length === 0 ? (
        <p className="text-white/20 text-sm uppercase tracking-widest text-center py-20">
          No documents available.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {documents.map(doc => (
            <div key={doc.id}
              className="bg-[#111827] border border-white/10 rounded-xl px-5 py-4 flex items-center gap-4">
              <FileText size={18} className="text-[#00436b] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">{doc.title}</p>
                {doc.description && (
                  <p className="text-white/40 text-xs mt-0.5">{doc.description}</p>
                )}
                {doc.latestVersion && (
                  <p className="text-white/20 text-xs mt-1">
                    Updated {new Date(doc.latestVersion.uploaded_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                )}
              </div>
              {doc.latestVersion ? (
                <button
                  onClick={() => download(doc.latestVersion.file_path, doc.latestVersion.file_name)}
                  className="flex items-center gap-2 bg-[#00436b] hover:bg-[#005a8f] text-white text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-lg transition-colors shrink-0"
                >
                  <Download size={13} />
                  <span className="hidden sm:inline">Download</span>
                </button>
              ) : (
                <span className="text-white/20 text-xs shrink-0">No file yet</span>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
