'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { GraduationCap, Lightbulb, Plus, Check, X, Pin } from 'lucide-react'
import type { UserSkill, SkillCategory, SkillLevel } from '@/lib/types'
import { SUGGESTED_SKILLS, LEARN_SUGGESTIONS } from '@/lib/constants'
import type { NewSkillInput } from '@/hooks/use-profile'
import { cn } from '@/lib/utils'

const CATEGORIES: SkillCategory[] = [
  'Technology', 'Language', 'Art & Design', 'Music', 'Business', 'Fitness', 'Cooking', 'Education', 'Other',
]
const LEVELS: SkillLevel[] = ['Beginner', 'Intermediate', 'Expert']

interface SelectedChip {
  name: string
  category: SkillCategory
}

interface SkillsSectionProps {
  variant: 'teach' | 'learn'
  skills: UserSkill[]
  isEditing: boolean
  onAdd: (skills: NewSkillInput[]) => Promise<boolean>
  onRemove: (id: string) => void
  onTogglePin: (id: string, pinned: boolean) => void
}

const VARIANT_CONFIG = {
  teach: {
    title: 'Skills I can teach',
    description: 'Skill tags for the expertise you offer.',
    icon: GraduationCap,
    iconClass: 'text-violet-500',
    badgeVariant: 'secondary' as const,
    namePlaceholder: 'Skill name (e.g. Python)',
    suggestedActiveClass: 'bg-violet-100 border-violet-300 text-violet-700',
    addLabel: 'Add teaching skill',
    empty: 'No teaching skills added yet.',
  },
  learn: {
    title: 'Skills I want to learn',
    description: 'Learning goals that help you grow.',
    icon: Lightbulb,
    iconClass: 'text-yellow-500',
    badgeVariant: 'outline' as const,
    namePlaceholder: 'Skill name (e.g. Guitar)',
    suggestedActiveClass: 'bg-yellow-100 border-yellow-300 text-yellow-700',
    addLabel: 'Add learning goal',
    empty: 'No learning goals added yet.',
  },
}

export function SkillsSection({ variant, skills, isEditing, onAdd, onRemove, onTogglePin }: SkillsSectionProps) {
  const config = VARIANT_CONFIG[variant]
  const Icon = config.icon
  const [category, setCategory] = useState<SkillCategory | ''>('')
  const [name, setName] = useState('')
  const [level, setLevel] = useState<SkillLevel | ''>('')
  const [description, setDescription] = useState('')
  const [selectedChips, setSelectedChips] = useState<SelectedChip[]>([])
  const [addingSelected, setAddingSelected] = useState(false)

  const resetCustomEntry = () => {
    setCategory('')
    setName('')
    setLevel('')
    setDescription('')
  }

  const handleAddCustom = async () => {
    const added = await onAdd([{ name, category, level, description, type: variant }])
    if (added) resetCustomEntry()
  }

  const toggleChip = (chip: SelectedChip) => {
    setSelectedChips((prev) =>
      prev.some((c) => c.name === chip.name)
        ? prev.filter((c) => c.name !== chip.name)
        : [...prev, chip]
    )
  }

  const isChipSelected = (skillName: string) => selectedChips.some((c) => c.name === skillName)

  const handleAddSelected = async () => {
    setAddingSelected(true)
    const added = await onAdd(
      selectedChips.map((chip) => ({ name: chip.name, category: chip.category, level: '', description: '', type: variant }))
    )
    if (added) setSelectedChips([])
    setAddingSelected(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${config.iconClass}`} />
          {config.title}
        </CardTitle>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {skills.length > 0 ? skills.map((s) => (
            <Badge key={s.id} variant={config.badgeVariant} className="gap-1.5 pr-1 pl-3 py-1.5">
              {s.pinned && <Pin className="h-3 w-3 text-yellow-500" />}
              {s.skill_name}
              {variant === 'teach' && s.level && <span className="text-muted-foreground">· {s.level}</span>}
              {isEditing && (
                <button
                  onClick={() => onTogglePin(s.id, !s.pinned)}
                  aria-label={s.pinned ? `Unpin ${s.skill_name}` : `Pin ${s.skill_name}`}
                  className={cn('ml-1', s.pinned && 'text-yellow-500')}
                >
                  <Pin className="h-3 w-3" />
                </button>
              )}
              {isEditing && (
                <button onClick={() => onRemove(s.id)} aria-label={`Remove ${s.skill_name}`} className="ml-0.5">
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          )) : (
            <p className="text-sm text-muted-foreground">{config.empty}</p>
          )}
        </div>

        {isEditing && (
          <div className="space-y-4">
            <Separator />

            <div className="grid gap-3">
              <Label className="text-xs uppercase font-medium text-muted-foreground">Pick multiple at once</Label>
              <Select onValueChange={(v) => setCategory(v as SkillCategory)} value={category}>
                <SelectTrigger>
                  <SelectValue placeholder="Browse a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>

              {category && SUGGESTED_SKILLS[category] && (
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_SKILLS[category].map((s) => {
                    const selected = isChipSelected(s)
                    return (
                      <button
                        key={s}
                        onClick={() => toggleChip({ name: s, category })}
                        className={cn(
                          'inline-flex items-center gap-1 text-xs rounded-full border px-3 py-1 transition',
                          selected ? config.suggestedActiveClass : 'bg-background hover:bg-muted border-input',
                        )}
                      >
                        {selected && <Check className="h-3 w-3" />}
                        {s}
                      </button>
                    )
                  })}
                </div>
              )}

              {variant === 'learn' && !category && (
                <div className="grid gap-2">
                  <Label className="text-xs uppercase font-medium text-muted-foreground">Trending skills</Label>
                  <div className="flex flex-wrap gap-2">
                    {LEARN_SUGGESTIONS.map((s) => {
                      const selected = isChipSelected(s)
                      return (
                        <button
                          key={s}
                          onClick={() => {
                            let matchedCategory: SkillCategory = 'Other'
                            for (const [c, catSkills] of Object.entries(SUGGESTED_SKILLS)) {
                              if (catSkills.includes(s)) {
                                matchedCategory = c as SkillCategory
                                break
                              }
                            }
                            toggleChip({ name: s, category: matchedCategory })
                          }}
                          className={cn(
                            'inline-flex items-center gap-1 text-xs rounded-full border px-3 py-1 transition',
                            selected ? config.suggestedActiveClass : 'bg-background hover:bg-muted border-input',
                          )}
                        >
                          {selected && <Check className="h-3 w-3" />}
                          {s}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {selectedChips.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleAddSelected} disabled={addingSelected}>
                  <Plus className="h-4 w-4 mr-1" /> Add {selectedChips.length} selected skill{selectedChips.length > 1 ? 's' : ''}
                </Button>
              )}
            </div>

            <Separator />

            <div className="grid gap-3">
              <Label className="text-xs uppercase font-medium text-muted-foreground">Or add one manually</Label>
              <div className="grid grid-cols-2 gap-3">
                <Select onValueChange={(v) => setCategory(v as SkillCategory)} value={category}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  placeholder={config.namePlaceholder}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {variant === 'teach' && (
                <div className="grid grid-cols-2 gap-3">
                  <Select onValueChange={(v) => setLevel(v as SkillLevel)} value={level}>
                    <SelectTrigger>
                      <SelectValue placeholder="Your level" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Short description (optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              )}

              <Button variant="outline" size="sm" onClick={handleAddCustom}>
                <Plus className="h-4 w-4 mr-1" /> {config.addLabel}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
