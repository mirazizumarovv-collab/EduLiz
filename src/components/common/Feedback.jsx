import React from "react";
import { useApp } from "../../context/AppContext.jsx";
import { spacing, radius, font } from "../../constants/theme.js";
import { Button } from "./UI.jsx";

export function Toast({ text }) {
  const { theme } = useApp();
  if (!text) return null;
  return (
    <div
      role="status"
      style={{
        position: "fixed", bottom: "calc(24px + env(safe-area-inset-bottom))", left: "50%", transform: "translateX(-50%)",
        background: theme.colors.surfaceStrong, color: theme.colors.onAccent, padding: "10px 18px", borderRadius: radius.pill,
        fontSize: font.size.sm, fontFamily: font.family, fontWeight: 600, zIndex: 200,
        boxShadow: "0 8px 20px rgba(0,0,0,0.25)", whiteSpace: "nowrap", maxWidth: "92vw", overflow: "hidden", textOverflow: "ellipsis",
      }}
    >
      {text}
    </div>
  );
}

// A real bottom sheet: scrolls internally when content is long, closes on
// backdrop click, and respects the safe-area inset at the bottom.
export function BottomSheet({ open, onClose, title, children }) {
  const { theme } = useApp();
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560, margin: "0 auto", maxHeight: "85vh", overflowY: "auto",
          background: theme.colors.surface, color: theme.colors.textPrimary, borderRadius: "20px 20px 0 0",
          padding: `18px 20px calc(24px + env(safe-area-inset-bottom))`,
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: theme.colors.tint, margin: "0 auto 14px" }} />
        {title && <div style={{ fontFamily: font.family, fontSize: font.size.lg, color: theme.colors.textPrimary, fontWeight: 800, marginBottom: 14 }}>{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, body, confirmLabel, cancelLabel, onConfirm, onCancel, danger = true }) {
  const { theme } = useApp();
  if (!open) return null;
  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, background: theme.colors.surface, color: theme.colors.textPrimary, borderRadius: radius.lg, padding: 20 }}>
        <div style={{ fontFamily: font.family, fontSize: font.size.md, fontWeight: 800, color: theme.colors.textPrimary, marginBottom: 8 }}>{title}</div>
        <div style={{ fontFamily: font.family, fontSize: font.size.sm, color: theme.colors.textSecondary, lineHeight: 1.5, marginBottom: 18 }}>{body}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" onClick={onCancel} style={{ flex: 1 }}>{cancelLabel}</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} style={{ flex: 1, background: danger ? theme.colors.danger : theme.colors.surfaceStrong, color: "#fff" }}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ icon = "🗒️", title, action }) {
  const { theme } = useApp();
  return (
    <div style={{ textAlign: "center", padding: `${spacing.xxl}px ${spacing.lg}px`, color: theme.colors.textSecondary, fontFamily: font.family }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: font.size.sm, lineHeight: 1.5 }}>{title}</div>
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function LoadingSkeleton({ rows = 4 }) {
  const { theme } = useApp();
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 48, borderRadius: radius.md, background: theme.colors.surfaceAlt,
            marginBottom: spacing.sm, animation: "pulse 1.3s ease-in-out infinite",
          }}
        />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry, t }) {
  const { theme } = useApp();
  return (
    <div style={{ textAlign: "center", padding: `${spacing.xxl}px ${spacing.lg}px`, fontFamily: font.family }}>
      <div style={{ fontSize: 30, marginBottom: 10 }}>⚠️</div>
      <div style={{ fontSize: font.size.sm, color: theme.colors.textPrimary, marginBottom: 14 }}>{message}</div>
      {onRetry && <Button onClick={onRetry}>{t("retry")}</Button>}
    </div>
  );
}
