'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, MapPin, Globe, Code2, Link as LinkIcon } from 'lucide-react'
import { COUNTRIES } from '@/lib/constants'
import { AVAILABILITY_OPTIONS, AVAILABILITY_LABELS, type ProfileFormState } from '@/hooks/use-profile'

interface ProfileDetailsCardProps {
  form: ProfileFormState
  isEditing: boolean
  onChange: (patch: Partial<ProfileFormState>) => void
}

export function ProfileDetailsCard({ form, isEditing, onChange }: ProfileDetailsCardProps) {
  const [searchCountry, setSearchCountry] = useState('')

  const filteredCountries = COUNTRIES.filter((c) =>
    c.toLowerCase().includes(searchCountry.toLowerCase())
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Name</Label>
          {!isEditing ? (
            <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm text-foreground">
              {form.name || 'No name yet'}
            </div>
          ) : (
            <Input
              value={form.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Your name"
            />
          )}
        </div>

        <div className="space-y-3">
          <Label>Username</Label>
          {!isEditing ? (
            <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm text-foreground">
              @{form.username || 'no-username'}
            </div>
          ) : (
            <Input
              value={form.username}
              onChange={(e) => onChange({ username: e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, '') })}
              placeholder="your-username"
            />
          )}
          <p className="text-xs text-muted-foreground">
            Others can @mention you with this handle in posts and comments.
          </p>
        </div>

        <div className="space-y-3">
          <Label>Headline</Label>
          {!isEditing ? (
            <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm text-foreground">
              {form.headline || 'No headline yet. Use this to describe what you teach and learn.'}
            </div>
          ) : (
            <Input
              value={form.headline}
              onChange={(e) => onChange({ headline: e.target.value })}
              placeholder="Headline, e.g. Full-stack mentor and language exchange coach"
            />
          )}
        </div>

        <div className="space-y-3">
          <Label>Availability</Label>
          {!isEditing ? (
            <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm text-foreground">
              {AVAILABILITY_LABELS[form.availability]}
            </div>
          ) : (
            <Select
              onValueChange={(v) => onChange({ availability: v as ProfileFormState['availability'] })}
              value={form.availability}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select availability" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABILITY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {AVAILABILITY_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-3">
          <Label>Bio</Label>
          {!isEditing ? (
            <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm leading-6 text-foreground">
              {form.bio || 'Tell others what makes you unique — your expertise, style, and goals.'}
            </div>
          ) : (
            <Textarea
              value={form.bio}
              onChange={(e) => onChange({ bio: e.target.value })}
              placeholder="Tell others about yourself — your background, interests, teaching style..."
              rows={5}
            />
          )}
        </div>

        <div className="space-y-3">
          <Label>Location</Label>
          {!isEditing ? (
            <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm text-foreground">
              {form.location || 'Location not specified'}
            </div>
          ) : (
            <Select onValueChange={(v) => { if (v) onChange({ location: v }) }} value={form.location}>
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
          )}
        </div>

        <div className="space-y-3">
          <Label>Links</Label>
          {!isEditing ? (
            <div className="flex flex-col gap-2">
              {[
                { href: form.websiteUrl, icon: Globe, label: 'Website' },
                { href: form.githubUrl, icon: Code2, label: 'GitHub' },
                { href: form.linkedinUrl, icon: LinkIcon, label: 'LinkedIn' },
              ].filter((l) => l.href).map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-violet-600 hover:underline dark:text-violet-400"
                >
                  <l.icon className="h-4 w-4" /> {l.label}
                </a>
              ))}
              {!form.websiteUrl && !form.githubUrl && !form.linkedinUrl && (
                <p className="text-sm text-muted-foreground">No links added yet.</p>
              )}
            </div>
          ) : (
            <div className="grid gap-2">
              <div className="relative">
                <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={form.websiteUrl}
                  onChange={(e) => onChange({ websiteUrl: e.target.value })}
                  placeholder="https://yourwebsite.com"
                />
              </div>
              <div className="relative">
                <Code2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={form.githubUrl}
                  onChange={(e) => onChange({ githubUrl: e.target.value })}
                  placeholder="https://github.com/you"
                />
              </div>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={form.linkedinUrl}
                  onChange={(e) => onChange({ linkedinUrl: e.target.value })}
                  placeholder="https://linkedin.com/in/you"
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
