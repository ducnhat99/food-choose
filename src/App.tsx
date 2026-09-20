import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import { RecipeModeProvider } from './context/RecipeModeContext'
import { Favorites } from './pages/Favorites'
import { History } from './pages/History'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Preferences } from './pages/Preferences'
import { RecipeDetail } from './pages/RecipeDetail'
import { Search } from './pages/Search'
import { SignUp } from './pages/SignUp'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <RecipeModeProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="search" element={<Search />} />
                  <Route path="recipe/:source/:id" element={<RecipeDetail />} />
                  <Route path="login" element={<Login />} />
                  <Route path="signup" element={<SignUp />} />
                  <Route
                    path="favorites"
                    element={
                      <ProtectedRoute>
                        <Favorites />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="history"
                    element={
                      <ProtectedRoute>
                        <History />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="preferences"
                    element={
                      <ProtectedRoute>
                        <Preferences />
                      </ProtectedRoute>
                    }
                  />
                </Route>
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </RecipeModeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  )
}
