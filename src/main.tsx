import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import DebugPage from "./pages/DebugPage.tsx";
import GardenPage from "./pages/GardenPage.tsx";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}
createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/debug" element={<DebugPage />} />
        <Route path="/:gardenNumber" element={<GardenPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
