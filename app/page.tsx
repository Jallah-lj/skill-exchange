import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DottedSurface } from '@/components/ui/dotted-surface'
import { Navbar } from '@/components/navbar'
import { ArrowRight, Users, Zap, Star, BookOpen, Code2, Music, Utensils, Dumbbell, Globe } from 'lucide-react'

const skillCategories = [
  { icon: Code2, label: 'Technology', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { icon: Music, label: 'Music', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
  { icon: Utensils, label: 'Cooking', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  { icon: Globe, label: 'Language', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  { icon: Dumbbell, label: 'Fitness', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  { icon: BookOpen, label: 'Education', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
]

const howItWorks = [
  {
    step: '01',
    title: 'Create your profile',
    desc: 'List the skills you can teach and the skills you want to learn. Be specific — great matches start here.',
  },
  {
    step: '02',
    title: 'Browse & discover',
    desc: 'Search by skill category or name. Find people who want to learn what you teach, and teach what you want.',
  },
  {
    step: '03',
    title: 'Send a match request',
    desc: "Found someone interesting? Send a request. If they accept, you're connected and can chat instantly.",
  },
  {
    step: '04',
    title: 'Schedule a session',
    desc: 'Agree on a time, pick the skill to focus on, and meet right on the platform. No credits needed.',
  },
]

const testimonials = [
  {
    name: 'Amara K.',
    avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=80&h=80&fit=crop&crop=face',
    skill: 'Traded: Python for Swahili',
    quote: "I've been wanting to learn Swahili for years. I helped Sarah with her Python project, and she taught me conversational Swahili in 3 sessions. This is genius.",
  },
  {
    name: 'James T.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face',
    skill: 'Traded: Guitar for Photoshop',
    quote: "I can now play 5 chords on guitar and my design work looks 10x better. Skill exchange is the most underrated way to learn.",
  },
  {
    name: 'Lena M.',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face',
    skill: 'Traded: Cooking for Fitness',
    quote: 'I taught meal prep and learned how to actually work out. My match was so patient and the sessions were genuinely fun.',
  },
]

export default function LandingPage() {
  return (
    <>
      <DottedSurface />
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative py-24 md:py-36 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="mb-6 text-sm px-4 py-1.5">
              <Zap className="h-3.5 w-3.5 mr-1.5 text-violet-500" />
              Pure skill barter — no money, no credits
            </Badge>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
              Teach what you know.
              <br />
              Learn what you love.
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              SkillSwap connects people who have a skill to share with people who want to learn it —
              and vice versa. No money changes hands. Just knowledge.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" className="text-base px-8" nativeButton={false} render={<Link href="/signup" />}>
                Start swapping skills <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8" nativeButton={false} render={<Link href="/browse" />}>
                Browse skills
              </Button>
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                <span>Open to everyone</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4" />
                <span>Rate and review sessions</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="h-4 w-4" />
                <span>Instant chat</span>
              </div>
            </div>
          </div>
        </section>

        {/* Skill Categories */}
        <section className="py-16 px-4 bg-background/60 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto">
            <p className="text-center text-sm font-medium text-muted-foreground uppercase tracking-widest mb-8">
              Skills available on the platform
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {skillCategories.map(({ icon: Icon, label, color }) => (
                <Link
                  key={label}
                  href={`/browse?category=${label}`}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-transform hover:scale-105 ${color}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-24 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">How SkillSwap works</h2>
            <p className="text-center text-muted-foreground mb-16 max-w-xl mx-auto">
              From profile to your first session in under 10 minutes.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {howItWorks.map(({ step, title, desc }) => (
                <div key={step} className="relative">
                  <div className="text-6xl font-black text-muted-foreground/20 mb-4 font-mono">{step}</div>
                  <h3 className="font-semibold text-lg mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-24 px-4 bg-background/60 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Real swaps, real results</h2>
            <p className="text-center text-muted-foreground mb-16">People learning from each other every day.</p>
            <div className="grid sm:grid-cols-3 gap-6">
              {testimonials.map((t) => (
                <div
                  key={t.name}
                  className="rounded-2xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
                    <div>
                      <p className="font-medium text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.skill}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">&quot;{t.quote}&quot;</p>
                  <div className="flex mt-4 gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to start swapping?</h2>
            <p className="text-muted-foreground mb-8 text-lg">
              Join the community. Teach one skill, learn another. It&apos;s that simple.
            </p>
            <Button size="lg" className="text-base px-10" nativeButton={false} render={<Link href="/signup" />}>
              Create your free profile <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 px-4 text-center text-sm text-muted-foreground">
        <p>© 2026 SkillSwap. Built for learners and teachers.</p>
        <nav className="mt-3 flex items-center justify-center gap-5 text-xs">
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link href="/guidelines" className="hover:text-foreground transition-colors">Community Guidelines</Link>
          <Link href="/support" className="hover:text-foreground transition-colors">Support</Link>
        </nav>
      </footer>
    </>
  )
}
