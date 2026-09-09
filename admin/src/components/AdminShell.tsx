import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Sidebar } from './Sidebar'
import type { AdminView } from './Sidebar'
import { DashboardView } from '../pages/DashboardView'
import { RegistrationsView } from '../pages/RegistrationsView'
import { ProgramsView } from '../pages/ProgramsView'
import { GalleryView } from '../pages/GalleryView'
import { ChangePasswordView } from '../pages/ChangePasswordView'
import { RegisterStudentView } from '../pages/RegisterStudentView'

export function AdminShell() {
  const { admin, logout } = useAuth()
  const [view, setView] = useState<AdminView>('dashboard')

  return (
    <main className="min-h-screen bg-surface md:flex">
      <Sidebar admin={admin} logout={logout} view={view} onViewChange={setView} />
      {view === 'dashboard' ? <DashboardView /> : view === 'registrations' ? <RegistrationsView /> : view === 'register-student' ? <RegisterStudentView onNavigate={() => setView('registrations')} /> : view === 'programs' ? <ProgramsView /> : view === 'gallery' ? <GalleryView /> : <ChangePasswordView />}
    </main>
  )
}
