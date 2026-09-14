import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import React, { lazy, Suspense } from "react";
import ChatPage from "./pages/ChatPage.jsx";
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const CmsPage = lazy(() => import("./pages/CmsPage.jsx"));
import { getUser } from "./api.js";
import "./App.css";

function RequireCms({ children }) {
  return getUser() ? children : <Navigate to="/cms/login" replace />;
}

function LoadingFallback() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "Source Sans 3, sans-serif", color: "#475569" }}>
      Memuat...
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={<LoadingFallback />}>
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
      </Suspense>
    </HashRouter>
  );
}
