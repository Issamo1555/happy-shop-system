import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth-context'
import { Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/guide-stage')({
  component: GuideStageComponent,
})

function GuideStageComponent() {
  const { user } = useAuth()
  
  if (user?.role !== 'sales' && user?.role !== 'super_admin') {
    return <Navigate to="/dashboard" />
  }

  return (
    <div className="w-full h-[calc(100vh-2rem)] bg-slate-50">
      <iframe 
        src="/guide-stage.html" 
        className="w-full h-full border-none rounded-xl shadow-sm bg-white" 
        title="Programme de Stage"
      />
    </div>
  )
}
