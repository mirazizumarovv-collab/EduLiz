import React from "react";
import { useApp } from "../../context/AppContext.jsx";
import { spacing, radius, font } from "../../constants/theme.js";

export function Button({ children, onClick, variant = "primary", disabled, style, ...rest }) {
  const { theme } = useApp();
  const c = theme.colors;
  const variants = {
    primary: { background: c.surfaceStrong, color: c.onAccent },
    secondary: { background: c.surfaceAlt, color: c.textPrimary },
    danger: { background: "transparent", color: c.danger },
    ghost: { background: "transparent", color: c.accent },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: "none", borderRadius: radius.md, padding: "13px 18px", fontWeight: 700,
        fontSize: font.size.md, fontFamily: font.family, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, minHeight: 46, ...variants[variant], ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({ children, style, ...rest }) {
  const { theme } = useApp();
  return (
    <div style={{ background: theme.colors.surfaceAlt, borderRadius: radius.lg, padding: spacing.lg, ...style }} {...rest}>
      {children}
    </div>
  );
}

export function Row({ label, value, sub, tone = "normal", onClick, rightIcon, valueColor }) {
  const { theme } = useApp();
  const c = theme.colors;
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        width: "100%", textAlign: "left", border: "none", cursor: onClick ? "pointer" : "default",
        padding: "13px 14px", background: tone === "highlight" ? c.tint : c.surfaceAlt,
        borderRadius: radius.md, marginBottom: spacing.sm, minHeight: 48, boxSizing: "border-box",
        fontFamily: font.family,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: font.size.sm, color: c.textPrimary, fontWeight: tone === "highlight" ? 700 : 500 }}>{label}</div>
        {sub && <div style={{ fontSize: font.size.xs, color: c.textSecondary, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 10 }}>
        {value !== undefined && value !== "" && (
          <span style={{ fontSize: font.size.md, color: valueColor || c.accent, fontWeight: 700 }}>{value}</span>
        )}
        {rightIcon}
      </div>
    </Wrapper>
  );
}

export function Section({ title, subtitle, children }) {
  const { theme } = useApp();
  return (
    <div style={{ marginBottom: spacing.xl }}>
      <div style={{ fontSize: font.size.md, color: theme.colors.textPrimary, fontWeight: 700, fontFamily: font.family }}>{title}</div>
      {subtitle && <div style={{ fontSize: font.size.xs, color: theme.colors.textSecondary, marginTop: 2, marginBottom: spacing.sm, fontFamily: font.family }}>{subtitle}</div>}
      {!subtitle && <div style={{ marginBottom: spacing.sm }} />}
      {children}
    </div>
  );
}

export function Toggle({ isOn, onChange, ariaLabel }) {
  const { theme } = useApp();
  const c = theme.colors;
  return (
    <button
      onClick={() => onChange(!isOn)}
      aria-label={ariaLabel}
      style={{
        border: "none", background: isOn ? c.accent : c.surfaceAlt, borderRadius: radius.pill,
        width: 44, height: 26, position: "relative", cursor: "pointer", padding: 0, flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: isOn ? 20 : 2, width: 22, height: 22, borderRadius: "50%",
        background: c.surface, transition: "left 0.15s ease",
      }} />
    </button>
  );
}

export function Badge({ children, tone = "good" }) {
  const { theme } = useApp();
  const color = tone === "warn" ? theme.colors.danger : theme.colors.accent;
  return (
    <span style={{
      fontSize: font.size.xs, color, background: `${color}22`, borderRadius: radius.pill,
      padding: "4px 10px", fontWeight: 700, fontFamily: font.family, display: "inline-block",
    }}>
      {children}
    </span>
  );
}

// Urgent/attention-needed items get a visually distinct treatment — colored
// left border + icon + bold — so they don't look like every other row.
export function AlertCard({ Icon, label, sub, tone = "warn", onClick }) {
  const { theme } = useApp();
  const c = theme.colors;
  const color = tone === "warn" ? c.bad : tone === "caution" ? c.medium : c.accent;
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
      border: "none", borderLeft: `4px solid ${color}`, cursor: onClick ? "pointer" : "default",
      padding: "12px 14px", background: `${color}14`, borderRadius: radius.md, marginBottom: spacing.sm, fontFamily: font.family,
    }}>
      <span style={{ flexShrink: 0, color }}><Icon size={19} /></span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: font.size.sm, fontWeight: 700, color: c.textPrimary }}>{label}</div>
        {sub && <div style={{ fontSize: font.size.xs, color: c.textSecondary, marginTop: 1 }}>{sub}</div>}
      </div>
    </Wrapper>
  );
}

// Small numeric stat pill — used for compact "child overview" strips instead
// of full-width rows, so a glance conveys 2-3 numbers at once.
export function StatPill({ icon, value, label, color }) {
  const { theme } = useApp();
  const c = theme.colors;
  return (
    <div style={{ flex: 1, textAlign: "center", padding: "10px 4px", borderRadius: radius.md, background: c.surfaceAlt }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: color || c.accent }}>{icon ? `${icon} ` : ""}{value}</div>
      <div style={{ fontSize: 9.5, color: c.textSecondary, marginTop: 2 }}>{label}</div>
    </div>
  );
}
