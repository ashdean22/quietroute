'use client'

import dynamic from 'next/dynamic'

const DebugMap = dynamic(() => import('@/components/DebugMap'), {
  ssr: false,
  loading: () => (
    <div className="h-screen w-full bg-slate-100 flex items-center justify-center text-gray-500">
      Loading map…
    </div>
  ),
})

export default function DebugMapLoader() {
  return <DebugMap />
}
