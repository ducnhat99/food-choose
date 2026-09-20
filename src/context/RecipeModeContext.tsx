import { createContext, useContext, useState, type ReactNode } from 'react'

export type RecipeMode = 'catalog' | 'ai'

const STORAGE_KEY = 'food-choose-recipe-mode'

interface RecipeModeContextValue {
  mode: RecipeMode
  setMode: (mode: RecipeMode) => void
}

const RecipeModeContext = createContext<RecipeModeContextValue | undefined>(undefined)

function readStoredMode(): RecipeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'ai' ? 'ai' : 'catalog'
  } catch {
    return 'catalog'
  }
}

export function RecipeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<RecipeMode>(readStoredMode)

  function setMode(next: RecipeMode) {
    setModeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage unavailable (private browsing, etc.) -- mode just won't persist
    }
  }

  return <RecipeModeContext.Provider value={{ mode, setMode }}>{children}</RecipeModeContext.Provider>
}

export function useRecipeMode(): RecipeModeContextValue {
  const context = useContext(RecipeModeContext)
  if (!context) throw new Error('useRecipeMode must be used within a RecipeModeProvider')
  return context
}
