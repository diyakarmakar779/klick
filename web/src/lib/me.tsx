import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Api, ApiError, type Me, type OnboardingStep } from "./api";

const STEPS: OnboardingStep[] = ["account", "consent", "block", "identity", "integrations", "questionnaire"];
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

// Local design review only (npm run dev, then ?preview, or ?preview=<onboarding step> such as account or consent).
function previewMe(step: string): Me {
  const full = step === "done" || !step;
  return {
    id: "preview",
    displayName: "Diya Karmakar",
    headline: full ? "Building Klick, so meeting people at events feels less random." : "",
    role: full ? "Backend engineer" : "",
    company: full ? "Execora" : "",
    bio: "",
    location: full ? "Bengaluru, India (IST)" : "",
    block: { color: "blue", studs: 4 },
    sharing: { beforeKlick: ["photo", "role_company"], afterAccept: ["photo", "role_company", "location", "linkedin"] },
    interests: full ? ["AI agents", "Events", "Privacy"] : [],
    goals: [],
    accessibility: { simpleLanguage: false, readAloud: false, prefersTextFirst: false, quietSpaces: false },
    defaultVisibility: "hidden",
    discoverability: "ask",
    contact: { email: "diya@example.com" },
    linkedin: null,
    linkedinProfile: null,
    questionnaire: full ? { lookingFor: ["Founders"], lookingForDetail: "", offering: ["Product feedback"], offeringDetail: "", topics: ["AI", "Design"], meetingStyle: "either" } : null,
    onboarding: { step: (STEPS.includes(step as OnboardingStep) ? step : "done") as OnboardingStep, completedAt: null },
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMe(): MeState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMe outside MeProvider");
  return v;
}
