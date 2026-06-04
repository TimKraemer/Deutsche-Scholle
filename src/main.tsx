import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";

// Detail- und Debug-Seiten als eigene Chunks laden (kleinerer initialer Bundle)
const DebugPage = lazy(() => import("./pages/DebugPage.tsx"));
const GardenPage = lazy(() => import("./pages/GardenPage.tsx"));

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}
createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/debug" element={<DebugPage />} />
          <Route path="/:gardenNumber" element={<GardenPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>
);
