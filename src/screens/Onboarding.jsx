import React, { useState } from "react";
import { BarChart3, Bell, MessageCircle } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";
import { Button } from "../components/common/UI.jsx";

const SLIDES = [
  { Icon: BarChart3, titleKey: "onboardTitle1", bodyKey: "onboardBody1" },
  { Icon: Bell, titleKey: "onboardTitle2", bodyKey: "onboardBody2" },
  { Icon: MessageCircle, titleKey: "onboardTitle3", bodyKey: "onboardBody3" },
];

export default function Onboarding({ onFinish }) {
  const { t, theme } = useApp();
  const c = theme.colors;
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "40px 28px calc(28px + env(safe-area-inset-bottom))" }}>
      <button onClick={onFinish} style={{ alignSelf: "flex-end", border: "none", background: "transparent", color: c.textSecondary, fontSize: 13, cursor: "pointer" }}>
        {t("skip")}
      </button>

      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 84, height: 84, borderRadius: "50%", background: c.tint, color: c.accent,
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 22px",
        }}>
          <slide.Icon size={36} strokeWidth={1.6} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: c.textPrimary, marginBottom: 10 }}>{t(slide.titleKey)}</div>
        <div style={{ fontSize: 13.5, color: c.textSecondary, lineHeight: 1.6, maxWidth: 260, margin: "0 auto" }}>{t(slide.bodyKey)}</div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
          {SLIDES.map((_, i) => (
            <span key={i} style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 3, background: i === step ? c.accent : c.tint, transition: "width 0.2s" }} />
          ))}
        </div>
        <Button onClick={() => (isLast ? onFinish() : setStep(s => s + 1))} style={{ width: "100%" }}>
          {isLast ? t("getStarted") : t("next")}
        </Button>
      </div>
    </div>
  );
}
