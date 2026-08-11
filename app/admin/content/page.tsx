'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  FileText, BookOpen, Link2, Megaphone, Plus, RefreshCw,
  Search, Edit2, Trash2, Eye, Archive, Send, MoreVertical,
  Clock, CheckCircle2, RotateCcw, XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Post {
  id: string
  title: string
  content: string
  type: 'article' | 'resource' | 'announcement'
  status: 'published' | 'draft' | 'archived'
  category: string | null
  published_at: string | null
  created_at: string
  author_id: string | null
  deleted_at: string | null
  profiles?: { name: string } | null
}

const TYPE_CONFIG = {
  article:      { label: 'Article',      icon: FileText,  color: 'bg-blue-100 text-blue-700 border-blue-200' },
  resource:     { label: 'Resource',     icon: BookOpen,  color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  announcement: { label: 'Announcement', icon: Megaphone, color: 'bg-violet-100 text-violet-700 border-violet-200' },
}

const STATUS_CONFIG = {
  published: { label: 'Published', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700' },
  draft:     { label: 'Draft',     icon: Clock,        color: 'bg-yellow-100 text-yellow-700' },
  archived:  { label: 'Archived',  icon: Archive,      color: 'bg-gray-100 text-gray-600' },
}

const REFRESH_INTERVAL = 30_000

type PostForm = { title: string; content: string; type: string; category: string; status: string }
const EMPTY_FORM: PostForm = { title: '', content: '', type: 'article', category: '', status: 'draft' }

interface ContentFormDialogProps {
  open: boolean
  onClose: () => void
  editPost: Post | null
  form: PostForm
  setForm: React.Dispatch<React.SetStateAction<PostForm>>
  saving: boolean
  onSave: () => void
}

// Defined outside ContentManagementPage — nesting this in the page's render body
// meant it was re-created every render (including every 1s countdown tick), which
// made React tear down and remount the open dialog continuously (visible as a
// blink/shake).
function ContentFormDialog({ open, onClose, editPost, form, setForm, saving, onSave }: ContentFormDialogProps) {
  const handleClose = () => { onClose(); setForm(EMPTY_FORM) }
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editPost ? 'Edit Post' : 'Create New Content'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</label>
              <Select value={form.type} onValueChange={v => { if (v) setForm(f => ({ ...f, type: v as Post['type'] })) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="article">Article</SelectItem>
                  <SelectItem value="resource">Resource</SelectItem>
                  <SelectItem value="announcement">Announcement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Status</label>
              <Select value={form.status} onValueChange={v => { if (v) setForm(f => ({ ...f, status: v as Post['status'] })) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Title</label>
            <Input
              placeholder="Enter title…"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category (optional)</label>
            <Input
              placeholder="e.g. Tips, Guide, Platform Update…"
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Content</label>
            <Textarea
              placeholder="Write your content here…"
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              className="min-h-[200px] resize-y"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving} className="gap-2">
            {form.status === 'published' ? <Send className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            {saving ? 'Saving…' : editPost ? 'Save Changes' : form.status === 'published' ? 'Publish' : 'Save Draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ContentManagementPage() {
  const supabase = createClient()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'article' | 'resource' | 'announcement'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived' | 'trash'>('all')
  const [search, setSearch] = useState('')
  const [createDialog, setCreateDialog] = useState(false)
  const [editPost, setEditPost] = useState<Post | null>(null)
  const [form, setForm] = useState<PostForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(name)')
      .order('created_at', { ascending: false })
    setPosts(data ?? [])
    setCountdown(REFRESH_INTERVAL / 1000)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, REFRESH_INTERVAL)
    countdownRef.current = setInterval(() => {
      setCountdown(c => (c <= 1 ? REFRESH_INTERVAL / 1000 : c - 1))
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [load])

  const savePost = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required')
      return
    }
    setSaving(true)
    const payload = {
      title: form.title,
      content: form.content,
      type: form.type,
      status: form.status,
      category: form.category || null,
      published_at: form.status === 'published' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }
    if (editPost) {
      const { error } = await supabase.from('posts').update(payload).eq('id', editPost.id)
      if (error) toast.error(error.message)
      else { toast.success('Post updated'); setEditPost(null); load() }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('posts').insert({ ...payload, author_id: user?.id })
      if (error) toast.error(error.message)
      else { toast.success('Post created'); setCreateDialog(false); load() }
    }
    setForm(EMPTY_FORM)
    setSaving(false)
  }

  const changeStatus = async (post: Post, status: 'published' | 'draft' | 'archived') => {
    const { error } = await supabase.from('posts').update({
      status,
      published_at: status === 'published' ? new Date().toISOString() : post.published_at,
    }).eq('id', post.id)
    if (error) toast.error(error.message)
    else { toast.success(`Post ${status}`); load() }
  }

  const deletePost = async (id: string) => {
    if (!confirm('Move this post to Trash? It will be permanently deleted after 30 days.')) return
    const { error } = await supabase.from('posts').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Post moved to Trash'); load() }
  }

  const restorePost = async (id: string) => {
    const { error } = await supabase.from('posts').update({ deleted_at: null }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Post restored'); load() }
  }

  const permanentlyDeletePost = async (id: string) => {
    if (!confirm('Permanently delete this post? This cannot be undone.')) return
    const { error } = await supabase.from('posts').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Post permanently deleted'); load() }
  }

  const openEdit = (post: Post) => {
    setForm({ title: post.title, content: post.content, type: post.type, category: post.category ?? '', status: post.status })
    setEditPost(post)
  }

  const trashCount = posts.filter(p => p.deleted_at).length
  const counts = {
    all: posts.filter(p => !p.deleted_at).length,
    article: posts.filter(p => p.type === 'article' && !p.deleted_at).length,
    resource: posts.filter(p => p.type === 'resource' && !p.deleted_at).length,
    announcement: posts.filter(p => p.type === 'announcement' && !p.deleted_at).length,
  }

  const filtered = posts.filter(p => {
    if (statusFilter === 'trash') {
      if (!p.deleted_at) return false
    } else {
      if (p.deleted_at) return false
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
    }
    if (tab !== 'all' && p.type !== tab) return false
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const stats = {
    total: posts.length,
    published: posts.filter(p => p.status === 'published').length,
    draft: posts.filter(p => p.status === 'draft').length,
    archived: posts.filter(p => p.status === 'archived').length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Content Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Articles · Resources · Announcements · Auto-refreshing in {countdown}s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-muted/50 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <Button onClick={() => setCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Content
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total',     value: stats.total,     color: 'text-gray-700' },
          { label: 'Published', value: stats.published, color: 'text-emerald-600' },
          { label: 'Draft',     value: stats.draft,     color: 'text-yellow-600' },
          { label: 'Archived',  value: stats.archived,  color: 'text-gray-500' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn('text-2xl font-bold mt-1', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-muted/50 rounded-lg p-1 gap-0.5">
          {(['all', 'article', 'resource', 'announcement'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                tab === t ? 'bg-white dark:bg-gray-800 shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
              <span className="ml-1.5 text-[10px] opacity-60">{counts[t]}</span>
            </button>
          ))}
        </div>

        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="trash">Trash{trashCount ? ` (${trashCount})` : ''}</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search content…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 w-56 text-sm"
          />
        </div>
      </div>

      {/* Content table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No content found</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setCreateDialog(true)}>
              Create first post
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Title</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-center">Type</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-center">Status</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Author</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="px-5 py-3 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(post => {
                const TypeInfo = TYPE_CONFIG[post.type]
                const StatusInfo = STATUS_CONFIG[post.status]
                const TypeIcon = TypeInfo.icon
                const StatusIcon = StatusInfo.icon
                return (
                  <tr key={post.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-medium truncate max-w-xs">{post.title}</p>
                        {post.category && (
                          <p className="text-xs text-muted-foreground mt-0.5">{post.category}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Badge className={cn('text-[10px] border gap-1', TypeInfo.color)}>
                        <TypeIcon className="h-2.5 w-2.5" />
                        {TypeInfo.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Badge className={cn('text-[10px] gap-1', StatusInfo.color)}>
                        <StatusIcon className="h-2.5 w-2.5" />
                        {StatusInfo.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">
                      {post.profiles?.name ?? 'System'}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(post.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {post.deleted_at ? (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={() => restorePost(post.id)}>
                              <RotateCcw className="h-3 w-3 mr-1" />Restore
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => permanentlyDeletePost(post.id)}>
                              <XCircle className="h-3 w-3 mr-1" />Delete forever
                            </Button>
                          </>
                        ) : (
                          <>
                            {post.status !== 'published' && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => changeStatus(post, 'published')}>
                                <Send className="h-3 w-3 mr-1" />Publish
                              </Button>
                            )}
                            {post.status !== 'archived' && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => changeStatus(post, 'archived')}>
                                <Archive className="h-3 w-3" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(post)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => deletePost(post.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <ContentFormDialog
        open={createDialog}
        onClose={() => setCreateDialog(false)}
        editPost={null}
        form={form}
        setForm={setForm}
        saving={saving}
        onSave={savePost}
      />
      <ContentFormDialog
        open={!!editPost}
        onClose={() => setEditPost(null)}
        editPost={editPost}
        form={form}
        setForm={setForm}
        saving={saving}
        onSave={savePost}
      />
    </div>
  )
}
