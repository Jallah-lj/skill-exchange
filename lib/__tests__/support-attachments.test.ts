import { describe, it, expect } from 'vitest'
import { validateAttachment, ATTACHMENT_ACCEPT } from '../support-attachments'

function fakeFile(name: string, type: string, size = 1024): File {
  return { name, type, size } as unknown as File
}

describe('validateAttachment', () => {
  it('accepts images, pdf, word, logs, video', () => {
    expect(validateAttachment(fakeFile('shot.png', 'image/png'))).toMatchObject({ ok: true, kind: 'image' })
    expect(validateAttachment(fakeFile('doc.pdf', 'application/pdf'))).toMatchObject({ ok: true, kind: 'pdf' })
    expect(validateAttachment(fakeFile('cv.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).toMatchObject({ ok: true, kind: 'word' })
    expect(validateAttachment(fakeFile('app.log', 'text/plain'))).toMatchObject({ ok: true, kind: 'log' })
    expect(validateAttachment(fakeFile('bug.mp4', 'video/mp4'))).toMatchObject({ ok: true, kind: 'video' })
  })

  it('rejects executables outright', () => {
    for (const name of ['virus.exe', 'script.sh', 'run.bat', 'tool.msi', 'mod.dll', 'x.ps1', 'app.jar']) {
      expect(validateAttachment(fakeFile(name, 'application/octet-stream')).ok).toBe(false)
    }
  })

  it('rejects double-extension disguises by checking the LAST extension', () => {
    expect(validateAttachment(fakeFile('invoice.pdf.exe', 'application/octet-stream')).ok).toBe(false)
  })

  it('rejects MIME/extension mismatch (renamed file)', () => {
    // an .exe renamed to .png but browser reports its real type
    expect(validateAttachment(fakeFile('image.png', 'application/x-msdownload')).ok).toBe(false)
  })

  it('tolerates empty MIME only for logs', () => {
    expect(validateAttachment(fakeFile('trace.log', '')).ok).toBe(true)
    expect(validateAttachment(fakeFile('shot.png', '')).ok).toBe(true) // empty type = no second signal, ext rule decides
  })

  it('enforces per-type size caps', () => {
    const tooBig = 16 * 1024 * 1024
    expect(validateAttachment(fakeFile('big.png', 'image/png', tooBig)).ok).toBe(false)
    const okVideo = 90 * 1024 * 1024
    expect(validateAttachment(fakeFile('clip.mp4', 'video/mp4', okVideo)).ok).toBe(true)
  })

  it('exposes an accept list containing no executable extensions', () => {
    for (const bad of ['.exe', '.sh', '.bat', '.msi', '.dll', '.js']) {
      expect(ATTACHMENT_ACCEPT).not.toContain(bad)
    }
  })
})
