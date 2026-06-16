import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { Login } from "./routes/Login";
import { TowerShell } from "./routes/TowerShell";
import { FlightDetail } from "./routes/FlightDetail";
import { MyHangar } from "./routes/MyHangar";
import { ClaimsFeed } from "./routes/ClaimsFeed";
import { HotRoutes } from "./routes/HotRoutes";
import { RialoInside } from "./routes/RialoInside";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { TopNav } from "./components/shell/TopNav";
import { StatusBar } from "./components/shell/StatusBar";
import { SearchHotkey } from "./components/search/SearchHotkey";
import { useWebSocket } from "./hooks/useWebSocket";

function AppShell({ children }: { children: ReactNode }) {
  useWebSocket("/ws");

  return (
    <>
      <TopNav />
      {children}
      <StatusBar />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell>
                <TowerShell />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/flight/:id"
          element={
            <ProtectedRoute>
              <AppShell>
                <FlightDetail />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/policies"
          element={
            <ProtectedRoute>
              <AppShell>
                <MyHangar />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/claims"
          element={
            <ProtectedRoute>
              <AppShell>
                <ClaimsFeed />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/routes"
          element={
            <ProtectedRoute>
              <AppShell>
                <HotRoutes />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/rialo-inside"
          element={
            <ProtectedRoute>
              <AppShell>
                <RialoInside />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SearchHotkey />
    </BrowserRouter>
  );
}
