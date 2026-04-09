import { createContext, useContext, useState, ReactNode } from 'react'

export interface Project {
    id: string
    key: string
    name: string
    description: string | null
    created_by: string
    created_at: string
}

interface ProjectContextValue {
    project: Project | null
    setProject: (project: Project | null) => void
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined)

const STORAGE_KEY = 'pf_selected_project'

export function ProjectProvider({ children }: { children: ReactNode }) {
    const [project, setProjectState] = useState<Project | null>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            return stored ? JSON.parse(stored) : null
        } catch {
            return null
        }
    })

    function setProject(p: Project | null) {
        setProjectState(p)
        if (p) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
        } else {
            localStorage.removeItem(STORAGE_KEY)
        }
    }

    return (
        <ProjectContext.Provider value={{ project, setProject }}>
            {children}
        </ProjectContext.Provider>
    )
}

export function useProject(): ProjectContextValue {
    const ctx = useContext(ProjectContext)
    if (!ctx) throw new Error('useProject must be used within ProjectProvider')
    return ctx
}
