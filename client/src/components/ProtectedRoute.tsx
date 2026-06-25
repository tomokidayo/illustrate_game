import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** ログイン済みユーザー（登録・ゲスト両方）のみ通過 */
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/lobby" replace />;
}

/** 登録ユーザーのみ通過（ゲスト不可） */
export function AuthOnlyRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/lobby" replace />;
  if (user.isGuest) return <Navigate to="/lobby" replace />;
  return <>{children}</>;
}
