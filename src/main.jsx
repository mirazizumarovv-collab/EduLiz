import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Registered only in production builds — Vite's dev server already handles
// fast reloads, and a service worker caching dev assets would just cause
// confusing stale-content bugs while developing.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // If registration fails (e.g. unsupported host), the app still works
      // as a normal website — install/offline just won't be available.
    });
  });
}
