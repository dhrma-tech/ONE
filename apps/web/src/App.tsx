import { lazy, useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Shell, PageFallback } from "./app/Shell";
import { useGlobalKeys } from "./app/keys";
import { focus } from "./modules/focus";
import { boot } from "./app/boot";
import { SCOPE } from "./scope";
import { ui } from "./data/ui";
import { useAuth } from "./data/supabase";
import { LOCAL_MODE } from "./env";
import Placeholder from "./pages/Placeholder";

const StyleGuide = lazy(() => import("./pages/StyleGuide"));
const Login = lazy(() => import("./pages/Login"));
const Home = lazy(() => import("./pages/home/Home"));
const Career = lazy(() => import("./pages/career/Career"));
const Mind = lazy(() => import("./pages/mind/Mind"));

const KEY_HANDLERS = { onFocus: () => focus.start({}) };
function Keys() {
  useGlobalKeys(KEY_HANDLERS);
  return null;
}

function AuthGate({ children }: { children: ReactNode }) {
  const a = useAuth();
  if (LOCAL_MODE) return <>{children}</>;
  if (!a.ready) return <PageFallback />;
  if (!a.session)
    return (
      <Shell>
        <Login />
      </Shell>
    );
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={SCOPE === "master" ? <Home /> : <Navigate to={`/${SCOPE}`} replace />} />
        <Route path="career/*" element={<Career />} />
        <Route path="mind/*" element={<Mind />} />
        <Route path="body/*" element={<Placeholder scene="body" title="Body" />} />
        <Route path="persona/*" element={<Placeholder scene="persona" title="Persona" />} />
        <Route path="settings/*" element={<Placeholder scene="settings" title="Settings" />} />
        <Route path="auth/callback" element={<Navigate to="/" replace />} />
        <Route path="ui" element={<StyleGuide />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  useEffect(() => {
    ui.setTheme(ui.get().theme);
    void boot();
  }, []);
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Keys />
      <AuthGate>
        <AppRoutes />
      </AuthGate>
    </BrowserRouter>
  );
}
