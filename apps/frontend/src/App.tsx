import { Navigate, Route, Routes } from 'react-router-dom';
import { useGetMeQuery } from './api';
import { Layout } from './components/Layout';
import { Screen } from './components/Screen';
import { FortuneDetail } from './pages/FortuneDetail';
import { History } from './pages/History';
import { Settings } from './pages/Settings';
import { Today } from './pages/Today';
import { Welcome } from './pages/Welcome';

export function App() {
  const { data: me, isLoading, isError, refetch } = useGetMeQuery();
  // A 401 already redirected to login inside baseQuery; anything else is shown.
  if (isError && !me) {
    return <Screen title="The veil is clouded" action={<button className="btn-ghost" onClick={() => void refetch()}>Try again</button>}>We couldn't reach Third Eye.</Screen>;
  }
  if (isLoading || !me) return <Screen title="Opening the veil…" />;
  if (!me.onboarded) return <Welcome />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Today />} />
        <Route path="history" element={<History />} />
        <Route path="history/:id" element={<FortuneDetail />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
