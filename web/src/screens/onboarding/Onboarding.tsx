import type { Me } from "../../lib/api";
import Identity from "./Identity";
import Sources from "./Sources";
import Questions from "./Questions";

// Google sign-in, then: identity -> where your events live -> who you want to meet.
export default function Onboarding({ me }: { me: Me }) {
  if (me.onboarding.step === "identity") return <Identity />;
  if (me.onboarding.step === "integrations") return <Sources />;
  return <Questions me={me} />;
}
