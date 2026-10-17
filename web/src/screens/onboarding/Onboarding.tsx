import type { Me } from "../../lib/api";
import Consent from "./Consent";
import MakeBlock from "./MakeBlock";
import LinkedIn from "./LinkedIn";
import YourProfile from "./YourProfile";
import Goals from "./Goals";
import Sharing from "./Sharing";
import Discoverability from "./Discoverability";
import Sources from "./Sources";
import Review from "./Review";

// Signed in (step 1), then: consent -> block -> LinkedIn -> profile -> goals -> sharing -> who can find you
// -> event source -> review. The step lives on the server, so a reload or another device resumes here.
export default function Onboarding({ me }: { me: Me }) {
  switch (me.onboarding.step) {
    case "consent":
      return <Consent />;
    case "block":
      return <MakeBlock me={me} />;
    case "identity":
      return <LinkedIn me={me} />;
    case "profile":
      return <YourProfile me={me} />;
    case "questionnaire":
      return <Goals me={me} />;
    case "sharing":
      return <Sharing me={me} />;
    case "discoverability":
      return <Discoverability me={me} />;
    case "integrations":
      return <Sources />;
    default:
      return <Review me={me} />;
  }
}
