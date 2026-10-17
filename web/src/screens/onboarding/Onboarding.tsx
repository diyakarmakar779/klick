import type { Me } from "../../lib/api";
import Account from "./Account";
import Consent from "./Consent";
import MakeBlock from "./MakeBlock";
import LinkedIn from "./LinkedIn";
import Sources from "./Sources";
import Questions from "./Questions";

// After Google sign-in: verified email -> consent -> make your block -> LinkedIn badge -> where your events live
// -> who you want to meet -> Home. The step lives on the server, so a reload resumes here.
export default function Onboarding({ me }: { me: Me }) {
  switch (me.onboarding.step) {
    case "account":
      return <Account me={me} />;
    case "consent":
      return <Consent />;
    case "block":
      return <MakeBlock me={me} />;
    case "identity":
      return <LinkedIn me={me} />;
    case "integrations":
      return <Sources />;
    default:
      return <Questions me={me} />;
  }
}
