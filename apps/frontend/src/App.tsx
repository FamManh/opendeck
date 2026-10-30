import { BrowserRouter, Route, Routes } from 'react-router'
import { CreateRoomPage } from '@/pages/CreateRoom'
import { ForgotPage } from '@/pages/Forgot'
import { HomePage } from '@/pages/Home'
import { LoginPage } from '@/pages/Login'
import { RegisterPage } from '@/pages/Register'
import { ResetPage } from '@/pages/Reset'
import { RoomPage } from '@/pages/Room'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot" element={<ForgotPage />} />
        <Route path="/reset" element={<ResetPage />} />
        <Route path="/rooms/new" element={<CreateRoomPage />} />
        <Route path="/r/:slug" element={<RoomPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  )
}
