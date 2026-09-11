import React from "react";
import { useApp } from "../../context/AppContext.jsx";

// Fluid on mobile (100% width), capped and centered on larger screens like a
// modern responsive web app — never a fixed 360x720 "phone mockup" box.
export function AppShell({ header, children, bottomNav }) {
  const { theme } = useApp();
  return (
    <div style={{ minHeight: "100dvh", background: theme.colors.background, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: "100%", maxWidth: 480, minHeight: "100dvh", background: theme.colors.surface,
          display: "flex", flexDirection: "column", position: "relative",
          boxShadow: "0 0 40px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ paddingTop: "env(safe-area-inset-top)", position: "sticky", top: 0, zIndex: 20, background: theme.colors.surface }}>
          {header}
        </div>
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: bottomNav ? 76 : 20 }}>
          {children}
        </div>
        {bottomNav && (
          <div style={{ position: "sticky", bottom: 0, paddingBottom: "env(safe-area-inset-bottom)", background: theme.colors.surface, zIndex: 20 }}>
            {bottomNav}
          </div>
        )}
      </div>
    </div>
  );
}
