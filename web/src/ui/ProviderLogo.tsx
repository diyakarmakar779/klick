import { useState } from "react";

const PROVIDERS = {
  linkedin: {
    label: "LinkedIn",
    src: null,
    fallback: "in",
  },
  google_calendar: {
    label: "Google Calendar",
    src: "/assets/providers/google-calendar.png",
    fallback: "31",
  },
  luma: {
    label: "Luma",
    src: "/assets/providers/luma.png",
    fallback: "L",
  },
} as const;

export type ProviderId = keyof typeof PROVIDERS;

export default function ProviderLogo({ provider, size = "md" }: { provider: ProviderId; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState(false);
  const item = PROVIDERS[provider];
  return (
    <span className={`k-provider-logo k-provider-logo--${size} k-provider-logo--${provider}`} aria-label={item.label} role="img">
      {failed || !item.src ? <span aria-hidden="true">{item.fallback}</span> : <img src={item.src} alt="" onError={() => setFailed(true)} />}
    </span>
  );
}
