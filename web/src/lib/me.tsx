import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Api, ApiError, type Me } from "./api";
import { auth } from "./firebase";

interface MeState {
  me: Me | null;
  error: string | null;
  setMe: (m: Me) => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<MeState | null>(null);

// Loads the member's own profile, creating it on first sign-in.
export function MeProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const preview = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("preview") : null;
    if (preview !== null) return setMe(previewMe(preview));
    try {
      setMe(await Api.me());
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setMe(await Api.saveMe({ displayName: auth.currentUser?.displayName || "New member" }));
      } else {
        setError("Klick couldn't load your profile. Check your connection, then reload.");
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ me, error, setMe, refresh }}>{children}</Ctx.Provider>;
}

// Local design review only (npm run dev, then ?preview or ?preview=identity|integrations|questionnaire).
function previewMe(step: string): Me {
  return {
    id: "preview",
    displayName: "Diya Karmakar",
    headline: step === "done" || !step ? "Building Klick, so meeting people at events feels less random." : "",
    role: step === "done" || !step ? "Backend engineer" : "",
    company: step === "done" || !step ? "Execora" : "",
    interests: step === "done" || !step ? ["AI agents", "Events", "Privacy"] : [],
    goals: [],
    accessibility: { simpleLanguage: false, readAloud: false, prefersTextFirst: false, quietSpaces: false },
    defaultVisibility: "hidden",
    contact: { email: "diya@example.com" },
    linkedin: null,
    questionnaire: null,
    onboarding: { step: (["identity", "integrations", "questionnaire"].includes(step) ? step : "done") as Me["onboarding"]["step"], completedAt: null },
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMe(): MeState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMe outside MeProvider");
  return v;
}
