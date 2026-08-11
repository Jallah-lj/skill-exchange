'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight } from 'lucide-react'

interface FeatureCardProps {
  href: string
  icon: React.ElementType
  title: string
  description: string
  color: string
}

export function FeatureCard({ href, icon: Icon, title, description, color }: FeatureCardProps) {
  return (
    <Link href={href}>
      <Card className="h-full hover:shadow-lg hover:scale-105 transition-all cursor-pointer group">
        <CardContent className="pt-6 pb-6 h-full flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center ${color}`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
          </div>
          <h3 className="font-semibold text-lg mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground flex-1">{description}</p>
        </CardContent>
      </Card>
    </Link>
  )
}
