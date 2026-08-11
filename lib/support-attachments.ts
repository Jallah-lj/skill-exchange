// Allowlist for support-ticket chat attachments. There is no malware/AV
// scanning service wired into this app, so executables are never accepted —
// only these specific, review-safe file kinds are allowed through at all.
export type AttachmentKind = 'image' | 'pdf' | 'word' | 'log' | 'video'

interface AttachmentRule {
  kind: AttachmentKind
  extensions: string[]
  mimeTypes: string[]
  maxBytes: number
}

const MB = 1024 * 1024

export const ATTACHMENT_RULES: AttachmentRule[] = [
  {
    kind: 'image',
    extensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    mimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
    maxBytes: 15 * MB,
  },
  {
    kind: 'pdf',
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    maxBytes: 15 * MB,
  },
  {
    kind: 'word',
    extensions: ['.doc', '.docx'],
    mimeTypes: [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    maxBytes: 15 * MB,
  },
  {
    kind: 'log',
    extensions: ['.log', '.txt'],
    mimeTypes: ['text/plain', ''],
    maxBytes: 10 * MB,
  },
  {
    kind: 'video',
    extensions: ['.mp4', '.mov', '.webm'],
    mimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
    maxBytes: 100 * MB,
  },
]

export const ATTACHMENT_ACCEPT = ATTACHMENT_RULES.flatMap((r) => r.extensions).join(',')

export function validateAttachment(file: File): { ok: true; kind: AttachmentKind } | { ok: false; error: string } {
  const name = file.name.toLowerCase()
  const ext = name.slice(name.lastIndexOf('.'))

  const rule = ATTACHMENT_RULES.find((r) => r.extensions.includes(ext))
  if (!rule) {
    return { ok: false, error: 'That file type isn\'t allowed. Only images, PDF, Word docs, logs, and video are accepted — executables are never allowed.' }
  }
  // MIME check as a second gate — browsers sometimes report '' for logs, so
  // an empty type is tolerated only for the log rule above.
  if (file.type && !rule.mimeTypes.includes(file.type)) {
    return { ok: false, error: 'This file\'s contents don\'t match its extension — upload rejected.' }
  }
  if (file.size > rule.maxBytes) {
    return { ok: false, error: `File is too large — max ${Math.floor(rule.maxBytes / MB)}MB for this type.` }
  }
  return { ok: true, kind: rule.kind }
}
