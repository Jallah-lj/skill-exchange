'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Briefcase, Plus, X } from 'lucide-react'
import type { Experience } from '@/lib/types'
import type { NewExperienceInput } from '@/hooks/use-profile'

interface ExperienceSectionProps {
  experiences: Experience[]
  isEditing: boolean
  onAdd: (input: NewExperienceInput) => Promise<boolean>
  onRemove: (id: string) => void
}

const EMPTY_INPUT: NewExperienceInput = {
  title: '',
  organization: '',
  startDate: '',
  endDate: '',
  isCurrent: false,
  description: '',
}

function formatMonth(dateStr: string | null) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

export function ExperienceSection({ experiences, isEditing, onAdd, onRemove }: ExperienceSectionProps) {
  const [input, setInput] = useState<NewExperienceInput>(EMPTY_INPUT)
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    setAdding(true)
    const added = await onAdd(input)
    if (added) setInput(EMPTY_INPUT)
    setAdding(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-violet-500" />
          Experience & education
        </CardTitle>
        <CardDescription>Teaching roles, courses, certifications, or education worth highlighting.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {experiences.length > 0 ? (
          <div className="space-y-3">
            {experiences.map((exp) => (
              <div key={exp.id} className="flex items-start justify-between gap-3 rounded-xl border border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{exp.title}</p>
                  {exp.organization && <p className="text-sm text-muted-foreground">{exp.organization}</p>}
                  <p className="text-xs text-muted-foreground">
                    {formatMonth(exp.start_date)}
                    {exp.is_current ? ' · Present' : exp.end_date ? ` · ${formatMonth(exp.end_date)}` : ''}
                  </p>
                  {exp.description && <p className="mt-1 text-sm text-foreground">{exp.description}</p>}
                </div>
                {isEditing && (
                  <button onClick={() => onRemove(exp.id)} aria-label={`Remove ${exp.title}`} className="shrink-0 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No experience added yet.</p>
        )}

        {isEditing && (
          <div className="space-y-4">
            <Separator />
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Title (e.g. Piano Instructor)"
                  value={input.title}
                  onChange={(e) => setInput((p) => ({ ...p, title: e.target.value }))}
                />
                <Input
                  placeholder="Organization (optional)"
                  value={input.organization}
                  onChange={(e) => setInput((p) => ({ ...p, organization: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Start</Label>
                  <Input
                    type="month"
                    value={input.startDate}
                    onChange={(e) => setInput((p) => ({ ...p, startDate: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">End</Label>
                  <Input
                    type="month"
                    value={input.endDate}
                    disabled={input.isCurrent}
                    onChange={(e) => setInput((p) => ({ ...p, endDate: e.target.value }))}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={input.isCurrent}
                  onChange={(e) => setInput((p) => ({ ...p, isCurrent: e.target.checked, endDate: e.target.checked ? '' : p.endDate }))}
                />
                I'm currently in this role
              </label>

              <Textarea
                placeholder="Short description (optional)"
                value={input.description}
                onChange={(e) => setInput((p) => ({ ...p, description: e.target.value }))}
                rows={3}
              />

              <Button variant="outline" size="sm" onClick={handleAdd} disabled={adding}>
                <Plus className="h-4 w-4 mr-1" /> Add experience
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
