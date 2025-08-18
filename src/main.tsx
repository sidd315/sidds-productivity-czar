// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthGate } from "./AuthGate";  // ✅ named import that matches the export
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </React.StrictMode>
);
