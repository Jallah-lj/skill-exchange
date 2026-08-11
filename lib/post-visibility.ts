import { Globe, Users, Lock, UserCheck } from 'lucide-react'

export type Visibility = 'public' | 'connections' | 'private' | 'specific'

export const VISIBILITY_OPTIONS: Array<{ value: Visibility; label: string; description: string; icon: typeof Globe }> = [
  { value: 'public', label: 'Public', description: 'Anyone on SkillSwap', icon: Globe },
  { value: 'connections', label: 'Connections', description: 'Only people you’re connected with', icon: Users },
  { value: 'specific', label: 'Specific people', description: 'Only connections you pick', icon: UserCheck },
  { value: 'private', label: 'Only me', description: 'Nobody else can see it', icon: Lock },
]

export const VISIBILITY_META: Record<Visibility, { label: string; icon: typeof Globe }> = Object.fromEntries(
  VISIBILITY_OPTIONS.map((o) => [o.value, { label: o.label, icon: o.icon }])
) as Record<Visibility, { label: string; icon: typeof Globe }>
