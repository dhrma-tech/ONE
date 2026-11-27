import { lazy, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./app/Shell";
import { useGlobalKeys } from "./app/keys";
import { SCOPE } from "./scope";
import { ui } from "./data/ui";
import Placeholder from "./pages/Placeholder";

const StyleGuide = lazy(() => import("./pages/StyleGuide"));

function Keys() {
  useGlobalKeys();
  return null;
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={SCOPE === "master" ? <Placeholder scene="home" title="Home" /> : <Navigate to={`/${SCOPE}`} replace />} />
        <Route path="career/*" element={<Placeholder scene="career" title="Career" />} />
        <Route path="mind/*" element={<Placeholder scene="mind" title="Mind" />} />
        <Route path="body/*" element={<Placeholder scene="body" title="Body" />} />
        <Route path="persona/*" element={<Placeholder scene="persona" title="Persona" />} />
        <Route path="settings/*" element={<Placeholder scene="settings" title="Settings" />} />
        <Route path="ui" element={<StyleGuide />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  useEffect(() => {
    ui.setTheme(ui.get().theme);
  }, []);
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Keys />
      <AppRoutes />
    </BrowserRouter>
  );
}
