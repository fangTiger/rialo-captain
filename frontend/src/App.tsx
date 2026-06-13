import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Login } from "./routes/Login";
import { TowerShell } from "./routes/TowerShell";
import { ProtectedRoute } from "./auth/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <TowerShell />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
