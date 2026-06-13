import { cn } from '@/lib/utils'
import { Inbox } from 'lucide-react'

interface EmptyProps {
  title?: string
  description?: string
  className?: string
}

export default function Empty({ title, description, className }: EmptyProps) {
  return (
    <div className={cn('flex h-full items-center justify-center', className)}>
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-dark-800 flex items-center justify-center">
          <Inbox className="w-8 h-8 text-dark-500" />
        </div>
        {title && <p className="text-white font-medium mb-1">{title}</p>}
        {description && <p className="text-dark-400 text-sm">{description}</p>}
      </div>
    </div>
  )
}
