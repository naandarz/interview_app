import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import type { Project } from './types'
import { useWorkspace } from './store'

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Interview Workspace` : 'Interview Workspace'
  }, [title])
}

export function useProject(): Project | null {
  const { projectId } = useParams<{ projectId: string }>()
  const { data } = useWorkspace()
  if (!projectId) return null
  return data.projects.find((project) => project.id === projectId) ?? null
}

export function useDebouncedCallback<T extends (...args: never[]) => void>(callback: T, delay: number): T {
  const timer = useRef<number | null>(null)
  const latest = useRef(callback)
  latest.current = callback

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  return ((...args: Parameters<T>) => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      latest.current(...args)
    }, delay)
  }) as T
}

export function nextRespondentCode(existing: string[]): string {
  const used = new Set(existing.map((code) => code.toUpperCase()))
  let index = 1
  while (used.has(`R${String(index).padStart(2, '0')}`)) index += 1
  return `R${String(index).padStart(2, '0')}`
}
