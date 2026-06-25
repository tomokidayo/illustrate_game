import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute, { AuthOnlyRoute } from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import Rules from './pages/Rules';
import Profile from './pages/Profile';
import AdminUsers from './pages/AdminUsers';
import GuestUsername from './pages/GuestUsername';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* 認証不要 */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/guest-username" element={<GuestUsername />} />
          {/* ゲスト・登録ユーザー両方可 */}
          <Route path="/room/:roomCode" element={<ProtectedRoute><Game /></ProtectedRoute>} />
          {/* 登録ユーザーのみ */}
          <Route path="/profile" element={<AuthOnlyRoute><Profile /></AuthOnlyRoute>} />
          <Route path="/admin/users" element={<AuthOnlyRoute><AdminUsers /></AuthOnlyRoute>} />
          <Route path="*" element={<Navigate to="/lobby" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
