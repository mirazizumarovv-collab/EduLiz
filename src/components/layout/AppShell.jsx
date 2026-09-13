import React, { useState } from "react";
import { Menu, X, LogOut, Sun, Moon } from "lucide-react";
import { useApp } from "../../context/AppContext.jsx";

export function AppShell({ navItems, activeScreen, onNavigate, roleLabel, roleName, children }) {
  const { theme, themeMode, setThemeMode, logout, t } = useApp();
  const c = theme.colors;
  const [drawerOpen, setDrawerOpen] = useState(false);

  const NavList = ({ onItemClick }) => (
    <>
      {navItems.map(item => {
        const isActive = activeScreen === item.key;
        return (
          <button
            key={item.key}
            onClick={() => { onNavigate(item.key); onItemClick?.(); }}
            style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
              border: "none", background: isActive ? c.surfaceStrong : "transparent",
              color: isActive ? c.onAccent : c.textPrimary, borderRadius: 10, padding: "11px 14px",
              fontSize: 14, fontWeight: isActive ? 700 : 500, cursor: "pointer", marginBottom: 4,
            }}
          >
            <item.Icon size={18} />
            {item.label}
          </button>
        );
      })}
    </>
  );

  return (
    <div style={{ minHeight: "100dvh", background: theme.colors.background, display: "flex", fontFamily: "'Manrope', system-ui, sans-serif", color: c.textPrimary }}>
      {/* Desktop sidebar */}
      <div className="staff-sidebar" style={{ width: 240, flexShrink: 0, background: c.surface, borderRight: `1px solid ${c.border}`, padding: 18, display: "none", flexDirection: "column" }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: c.textPrimary }}>{t("appName")}</div>
          <div style={{ fontSize: 11.5, color: c.textSecondary, marginTop: 2 }}>{roleLabel} · {roleName}</div>
        </div>
        <div style={{ flex: 1 }}>
          <NavList />
        </div>
        <button onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")} style={{ display: "flex", alignItems: "center", gap: 10, border: "none", background: "transparent", color: c.textSecondary, padding: "10px 14px", cursor: "pointer", fontSize: 13 }}>
          {themeMode === "dark" ? <Sun size={16} /> : <Moon size={16} />} {themeMode === "dark" ? "Light" : "Dark"}
        </button>
        <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: 10, border: "none", background: "transparent", color: c.danger, padding: "10px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
          <LogOut size={16} /> {t("logout")}
        </button>
      </div>

      {/* Mobile top bar */}
      <div className="staff-topbar" style={{ position: "fixed", top: 0, left: 0, right: 0, height: 56, background: c.surface, borderBottom: `1px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", zIndex: 30 }}>
        <button onClick={() => setDrawerOpen(true)} style={{ border: "none", background: "transparent", color: c.textPrimary, cursor: "pointer", display: "flex" }}>
          <Menu size={22} />
        </button>
        <div style={{ fontSize: 14, fontWeight: 800, color: c.textPrimary }}>{t("appName")}</div>
        <div style={{ width: 22 }} />
      </div>

      {drawerOpen && (
        <div onClick={() => setDrawerOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 40 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 260, height: "100%", background: c.surface, padding: 18, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: c.textPrimary }}>{t("appName")}</div>
                <div style={{ fontSize: 11, color: c.textSecondary }}>{roleLabel} · {roleName}</div>
              </div>
              <button onClick={() => setDrawerOpen(false)} style={{ border: "none", background: "transparent", color: c.textPrimary, cursor: "pointer", display: "flex" }}><X size={20} /></button>
            </div>
            <div style={{ flex: 1 }}>
              <NavList onItemClick={() => setDrawerOpen(false)} />
            </div>
            <button onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")} style={{ display: "flex", alignItems: "center", gap: 10, border: "none", background: "transparent", color: c.textSecondary, padding: "10px 14px", cursor: "pointer", fontSize: 13 }}>
              {themeMode === "dark" ? <Sun size={16} /> : <Moon size={16} />} {themeMode === "dark" ? "Light" : "Dark"}
            </button>
            <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: 10, border: "none", background: "transparent", color: c.danger, padding: "10px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              <LogOut size={16} /> {t("logout")}
            </button>
          </div>
        </div>
      )}

      <div className="staff-content" style={{ flex: 1, minWidth: 0, padding: "72px 20px 24px", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
        {children}
      </div>

      <style>{`
        @media (min-width: 900px) {
          .staff-sidebar { display: flex !important; }
          .staff-topbar { display: none !important; }
          .staff-content { padding: 28px 32px !important; }
        }
      `}</style>
    </div>
  );
}
