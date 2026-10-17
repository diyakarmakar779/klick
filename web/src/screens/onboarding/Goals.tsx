import { useState } from "react";
import { Api, type Me } from "../../lib/api";
import { useMe } from "../../lib/me";
import Button from "../../ui/Button";
import ChipPicker from "../../ui/ChipPicker";
import Flow, { FlowError, useGo } from "./Flow";

const WORKING_ON = ["Early-stage startup", "Design", "Engineering", "Investing", "Community", "Research", "AI", "Climate", "Accessibility"];
const HELP_WITH = ["Product feedback", "Introductions", "Hiring", "Fundraising", "Mentoring", "Technical help"];
const WANT_TO_MEET = ["Founders", "Investors", "Designers", "Engineers", "Customers", "Mentors", "Collaborators"];

// Step 5: what brings you to events. Gemini uses only these answers to explain why someone is worth meeting.
export default function Goals({ me }: { me: Me }) {
  const { setMe } = useMe();
  const { go, busy, error, setError } = useGo();
  const [saving, setSaving] = useState(false);
  const q = me.questionnaire;
  const [topics, setTopics] = useState<string[]>(q?.topics.length ? q.topics : me.interests.slice(0, 15));
  const [offering, setOffering] = useState<string[]>(q?.offering ?? []);
  const [lookingFor, setLookingFor] = useState<string[]>(q?.lookingFor ?? []);
  const none = topics.length + offering.length + lookingFor.length === 0;

  async function save() {
    setSaving(true);
    setError("");
    try {
      await Api.saveMe({ interests: topics.map((t) => t.slice(0, 40)) });
      setMe(
        await Api.saveQuestionnaire({
          lookingFor,
          lookingForDetail: q?.lookingForDetail ?? "",
          offering,
          offeringDetail: q?.offeringDetail ?? "",
          topics: topics.map((t) => t.slice(0, 40)),
          meetingStyle: q?.meetingStyle ?? "either",
        }),
      );
    } catch {
      setSaving(false);
      setError("Couldn't save your answers. Check your connection, then retry. Nothing you picked is lost.");
    }
  }

  return (
    <Flow
      step={5}
      onBack={() => go("profile")}
      title="What brings you to events?"
      sub="Pick whatever fits. Klick uses this to explain why someone is worth meeting."
      foot={
        <>
          <FlowError>{error}</FlowError>
          <Button variant="primary" size="lg" loading={saving || busy} disabled={none} onClick={save}>
            Continue
          </Button>
          <p className="k-caption k-center">{none ? "Pick at least one." : "You can change these any time in your profile."}</p>
        </>
      }
    >
      <h2 className="k-onb__h">I'm working on</h2>
      <ChipPicker options={WORKING_ON} value={topics} onChange={setTopics} max={15} addLabel="Add a topic" />
      <h2 className="k-onb__h">I can help with</h2>
      <ChipPicker options={HELP_WITH} value={offering} onChange={setOffering} allowAdd={false} />
      <h2 className="k-onb__h">I want to meet</h2>
      <ChipPicker options={WANT_TO_MEET} value={lookingFor} onChange={setLookingFor} allowAdd={false} />
    </Flow>
  );
}
