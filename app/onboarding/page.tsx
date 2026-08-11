'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, ArrowRight, ArrowLeft, GraduationCap, Lightbulb, Plus, X, CheckCircle2, Search, MapPin } from 'lucide-react'
import type { SkillCategory, SkillLevel } from '@/lib/types'
import { COUNTRIES, SUGGESTED_SKILLS, LEARN_SUGGESTIONS } from '@/lib/constants'
import { ScrollArea } from '@/components/ui/scroll-area'

const CATEGORIES: SkillCategory[] = [
  'Technology', 'Language', 'Art & Design', 'Music', 'Business', 'Fitness', 'Cooking', 'Education', 'Other',
]
const LEVELS: SkillLevel[] = ['Beginner', 'Intermediate', 'Expert']

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Profile Data
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [searchCountry, setSearchCountry] = useState('')
  
  // Skills Data
  const [teachSkills, setTeachSkills] = useState<{name: string, category: SkillCategory, level: SkillLevel}[]>([])
  const [learnSkills, setLearnSkills] = useState<{name: string, category: SkillCategory}[]>([])
  
  // New skill form state
  const [newTeach, setNewTeach] = useState({ name: '', category: '' as SkillCategory, level: 'Intermediate' as SkillLevel })
  const [newLearn, setNewLearn] = useState({ name: '', category: '' as SkillCategory })

  const filteredCountries = COUNTRIES.filter(c => 
    c.toLowerCase().includes(searchCountry.toLowerCase())
  )

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase.from('profiles').select('onboarding_completed').eq('id', user.id).single()
      if (profile?.onboarding_completed) {
        router.push('/dashboard')
        return
      }
      setLoading(false)
    }
    checkUser()
  }, [])

  const handleComplete = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      // 1. Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ bio, location, onboarding_completed: true })
        .eq('id', user.id)
      
      if (profileError) throw profileError

      // 2. Add teach skills
      if (teachSkills.length > 0) {
        const { error: teachError } = await supabase.from('user_skills').insert(
          teachSkills.map(s => ({
            user_id: user.id,
            skill_name: s.name,
            category: s.category,
            level: s.level,
            type: 'teach'
          }))
        )
        if (teachError) throw teachError
      }

      // 3. Add learn skills
      if (learnSkills.length > 0) {
        const { error: learnError } = await supabase.from('user_skills').insert(
          learnSkills.map(s => ({
            user_id: user.id,
            skill_name: s.name,
            category: s.category,
            type: 'learn'
          }))
        )
        if (learnError) throw learnError
      }

      toast.success('Onboarding complete! Welcome to SkillSwap.')
      router.push('/dashboard')
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const addTeachSkill = (skill: {name: string, category: SkillCategory, level: SkillLevel}) => {
    if (teachSkills.some(s => s.name.toLowerCase() === skill.name.toLowerCase())) {
      toast.error('Skill already added')
      return
    }
    setTeachSkills(p => [...p, skill])
  }

  const addLearnSkill = (skill: {name: string, category: SkillCategory}) => {
    if (learnSkills.some(s => s.name.toLowerCase() === skill.name.toLowerCase())) {
      toast.error('Skill already added')
      return
    }
    setLearnSkills(p => [...p, skill])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Progress Bar */}
        <div className="flex justify-between mb-8 px-2">
          {[1, 2, 3, 4].map((i) => (
            <div 
              key={i} 
              className={`h-2 flex-1 mx-1 rounded-full transition-colors ${i <= step ? 'bg-violet-500' : 'bg-muted-foreground/20'}`}
            />
          ))}
        </div>

        {step === 1 && (
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="text-2xl">Welcome to SkillSwap!</CardTitle>
              <CardDescription>Let's get your profile set up so you can start swapping skills.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="bio">Tell us about yourself</Label>
                <Textarea 
                  id="bio"
                  placeholder="e.g. I'm a software engineer who loves teaching Python and wants to learn how to bake sourdough."
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">This will be shown on your public profile.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Where are you based?</Label>
                <Select onValueChange={(v) => { if (v) setLocation(v) }} value={location}>
                  <SelectTrigger className="w-full">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <SelectValue placeholder="Select your country" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2 sticky top-0 bg-popover z-10">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="Search countries..." 
                          className="pl-8 h-9"
                          value={searchCountry}
                          onChange={(e) => setSearchCountry(e.target.value)}
                        />
                      </div>
                    </div>
                    <ScrollArea className="h-72">
                      {filteredCountries.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                      {filteredCountries.length === 0 && (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No countries found.
                        </div>
                      )}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                onClick={() => setStep(2)}
                disabled={!location}
              >
                Next: Skills you can teach <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 2 && (
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <GraduationCap className="h-6 w-6 text-violet-500" />
                What can you teach?
              </CardTitle>
              <CardDescription>Add at least one skill you're comfortable sharing with others.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-2 min-h-[40px]">
                {teachSkills.map((s, i) => (
                  <Badge key={i} variant="secondary" className="px-3 py-1.5 gap-1.5">
                    {s.name} · {s.level}
                    <button onClick={() => setTeachSkills(p => p.filter((_, idx) => idx !== i))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {teachSkills.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">Add your first skill below...</p>
                )}
              </div>

              <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Category</Label>
                    <Select onValueChange={(v) => setNewTeach(p => ({...p, category: v as SkillCategory}))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Skill Name</Label>
                    <Input 
                      placeholder="e.g. Python"
                      value={newTeach.name}
                      onChange={(e) => setNewTeach(p => ({...p, name: e.target.value}))}
                    />
                  </div>
                </div>

                {newTeach.category && SUGGESTED_SKILLS[newTeach.category] && (
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Suggested for {newTeach.category}</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {SUGGESTED_SKILLS[newTeach.category].map(s => (
                        <button
                          key={s}
                          onClick={() => setNewTeach(p => ({ ...p, name: s }))}
                          className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                            newTeach.name === s 
                            ? 'bg-violet-100 border-violet-300 text-violet-700' 
                            : 'bg-background hover:bg-muted border-input'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Your Level</Label>
                    <Select defaultValue="Intermediate" onValueChange={(v) => setNewTeach(p => ({...p, level: v as SkillLevel}))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Level" />
                      </SelectTrigger>
                      <SelectContent>
                        {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => {
                        if (!newTeach.name || !newTeach.category) {
                          toast.error('Name and Category are required')
                          return
                        }
                        addTeachSkill(newTeach)
                        setNewTeach({name: '', category: newTeach.category, level: 'Intermediate'})
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add Skill
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button 
                className="flex-1" 
                onClick={() => setStep(3)}
                disabled={teachSkills.length === 0}
              >
                Next: What do you want to learn? <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 3 && (
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Lightbulb className="h-6 w-6 text-yellow-500" />
                What do you want to learn?
              </CardTitle>
              <CardDescription>Tell us what you're interested in picking up next.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-2 min-h-[40px]">
                {learnSkills.map((s, i) => (
                  <Badge key={i} variant="outline" className="px-3 py-1.5 gap-1.5 border-yellow-200 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/10 dark:text-yellow-400">
                    {s.name}
                    <button onClick={() => setLearnSkills(p => p.filter((_, idx) => idx !== i))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {learnSkills.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">Add something you want to learn...</p>
                )}
              </div>

              <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Category</Label>
                    <Select onValueChange={(v) => setNewLearn(p => ({...p, category: v as SkillCategory}))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Skill Name</Label>
                    <Input 
                      placeholder="e.g. Sourdough Baking"
                      value={newLearn.name}
                      onChange={(e) => setNewLearn(p => ({...p, name: e.target.value}))}
                    />
                  </div>
                </div>

                {newLearn.category && SUGGESTED_SKILLS[newLearn.category] && (
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Suggested for {newLearn.category}</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {SUGGESTED_SKILLS[newLearn.category].map(s => (
                        <button
                          key={s}
                          onClick={() => setNewLearn(p => ({ ...p, name: s }))}
                          className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                            newLearn.name === s 
                            ? 'bg-yellow-100 border-yellow-300 text-yellow-700' 
                            : 'bg-background hover:bg-muted border-input'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!newLearn.category && (
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Trending Skills</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {LEARN_SUGGESTIONS.map(s => (
                        <button
                          key={s}
                          onClick={() => {
                            // Find category for this skill
                            let cat: SkillCategory = 'Other';
                            for (const [c, skills] of Object.entries(SUGGESTED_SKILLS)) {
                              if (skills.includes(s)) {
                                cat = c as SkillCategory;
                                break;
                              }
                            }
                            addLearnSkill({ name: s, category: cat })
                          }}
                          className="text-xs px-2 py-1 rounded-md border bg-background hover:bg-muted border-input transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-end">
                  <Button 
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      if (!newLearn.name || !newLearn.category) {
                        toast.error('Name and Category are required')
                        return
                      }
                      addLearnSkill(newLearn)
                      setNewLearn({name: '', category: newLearn.category})
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Skill
                  </Button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button 
                className="flex-1" 
                onClick={() => setStep(4)}
                disabled={learnSkills.length === 0}
              >
                Almost there! <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 4 && (
          <Card className="shadow-lg border-0 text-center py-8">
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold">You're all set!</h2>
                <p className="text-muted-foreground">We'll use these skills to find your first match.</p>
              </div>
              
              <div className="bg-muted/30 rounded-xl p-6 text-left space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Teaching</p>
                  <div className="flex flex-wrap gap-2">
                    {teachSkills.map((s, i) => (
                      <Badge key={i} variant="secondary">{s.name}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Learning</p>
                  <div className="flex flex-wrap gap-2">
                    {learnSkills.map((s, i) => (
                      <Badge key={i} variant="outline">{s.name}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button 
                className="w-full h-12 text-lg font-semibold" 
                onClick={handleComplete}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  'Complete & Browse Skills'
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setStep(3)} disabled={saving}>
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Change skills
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  )
}
