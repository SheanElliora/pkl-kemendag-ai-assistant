import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import ChatPage from "./pages/ChatPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import CmsPage from "./pages/CmsPage.jsx";
import { getUser } from "./api.js";
import "./App.css";

// HashRouter dipakai agar rute /#/cms tetap berfungsi
// ketika halaman di-refresh/dibuka langsung di hosting statis
// (tidak butuh konfigurasi server untuk fallback ke index.html).

function RequireCms({ children }) {
  return getUser() ? children : <Navigate to="/cms/login" replace />;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/cms/login" element={<LoginPage />} />
        <Route
          path="/cms"
          element={
            <RequireCms>
              <CmsPage />
            </RequireCms>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}