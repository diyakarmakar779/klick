// Sample members for the demo. They import the same mock Luma events, so a judge who taps "Demo events"
// lands among people with real roles, goals and things to talk about. Every id starts with "demo-".
import type { Member, Questionnaire } from "../db/schema.js";

export interface DemoPerson {
  id: string;
  name: string;
  role: string;
  company: string;
  location: string;
  interests: string[];
  questionnaire: Omit<Questionnaire, "updatedAt" | "meetingStyle">;
  devfestGoal: string | null;
  visibility: Member["defaultVisibility"];
  accessibility?: Partial<Member["accessibility"]>;
}

const q = (lookingFor: string[], offering: string[], topics: string[], lookingForDetail = "") => ({
  lookingFor,
  offering,
  topics,
  lookingForDetail,
  offeringDetail: "",
});

export const DEMO_PEOPLE: DemoPerson[] = [
  { id: "demo-meera", name: "Meera Iyer", role: "Product designer", company: "Fernwood Labs", location: "Pune", interests: ["onboarding", "user research", "accessibility"],
    questionnaire: q(["design feedback", "user research partners"], ["interview scripts", "design reviews"], ["onboarding", "user research", "accessibility"]),
    devfestGoal: "Find teams who want a free onboarding teardown", visibility: "confirmed_attendees" },
  { id: "demo-ravi", name: "Ravi Patil", role: "Founder", company: "FloodSignal", location: "Pune", interests: ["flood alerts", "sms", "civic tech"],
    questionnaire: q(["Hindi and Marathi TTS help", "city partners"], ["civic tech intros", "SMS at scale"], ["civic tech", "climate resilience", "voice"]),
    devfestGoal: "Add Hindi voice alerts to flood SMS", visibility: "confirmed_attendees" },
  { id: "demo-sana", name: "Sana Shaikh", role: "Community lead", company: "Women in Cloud Pune", location: "Pune", interests: ["community", "events", "inclusion"],
    questionnaire: q(["speakers", "venue partners"], ["speaking slots", "community intros"], ["inclusion", "community", "cloud"]),
    devfestGoal: "Recruit first-time speakers", visibility: "confirmed_attendees" },
  { id: "demo-kabir", name: "Kabir Mehta", role: "ML engineer", company: "Vaani AI", location: "Bengaluru", interests: ["gemini", "agents", "voice"],
    questionnaire: q(["co-founder", "design partner"], ["Gemini prototyping help", "voice agent demos"], ["voice", "agents", "gemini"], "A product-minded co-founder for a voice-first app"),
    devfestGoal: "Meet a product co-founder", visibility: "confirmed_attendees" },
  { id: "demo-rohan", name: "Rohan Shetty", role: "Founder", company: "Ledgerly", location: "Bengaluru", interests: ["fundraising", "b2b saas", "fintech"],
    questionnaire: q(["first design hire", "pre-seed advice"], ["fundraising notes", "pitch feedback"], ["fundraising", "b2b saas", "onboarding"]),
    devfestGoal: "Talk to people raising a pre-seed round", visibility: "confirmed_attendees" },
  { id: "demo-priya", name: "Priya Nair", role: "Growth lead", company: "Tandem", location: "Pune", interests: ["growth", "activation", "onboarding"],
    questionnaire: q(["activation experiments", "analytics help"], ["growth playbooks", "onboarding metrics"], ["onboarding", "growth", "retention"]),
    devfestGoal: null, visibility: "confirmed_attendees" },
  { id: "demo-devika", name: "Devika Sen", role: "Angel investor", company: "", location: "Mumbai", interests: ["climate", "fintech", "fundraising"],
    questionnaire: q(["climate and fintech founders"], ["pre-seed investment", "intros to funds"], ["fundraising", "climate", "fintech"]),
    devfestGoal: "Meet early founders in climate and fintech", visibility: "confirmed_attendees" },
  { id: "demo-neha", name: "Neha Joshi", role: "Data scientist", company: "KrishiLens", location: "Nashik", interests: ["agritech", "vision ai", "ml"],
    questionnaire: q(["farmer cooperatives", "field pilot partners"], ["vision model help"], ["agritech", "vision ai", "climate"]),
    devfestGoal: "Pilot crop-disease detection with farmers", visibility: "confirmed_attendees", accessibility: { simpleLanguage: true } },
  { id: "demo-ananya", name: "Ananya Rao", role: "Product manager", company: "Northwind Pay", location: "Bengaluru", interests: ["fintech", "accessibility", "sign language"],
    questionnaire: q(["accessibility testers"], ["PM mentoring", "fintech intros"], ["accessibility", "fintech", "product"]),
    devfestGoal: null, visibility: "confirmed_attendees" },
  { id: "demo-vikram", name: "Vikram Singh", role: "Developer advocate", company: "GDG Pune", location: "Pune", interests: ["devrel", "firebase", "flutter"],
    questionnaire: q(["speakers for DevFest"], ["Firebase help", "speaking coaching"], ["firebase", "flutter", "community"]),
    devfestGoal: "Recruit speakers for next year", visibility: "confirmed_attendees" },
  { id: "demo-fatima", name: "Fatima Khan", role: "NLP researcher", company: "Swasthya Labs", location: "Pune", interests: ["healthcare", "nlp", "multilingual"],
    questionnaire: q(["hospital partners", "Urdu and Marathi reviewers"], ["multilingual NLP help"], ["healthcare", "multilingual", "voice"]),
    devfestGoal: "Translate health advisories into Urdu and Marathi", visibility: "confirmed_attendees", accessibility: { readAloud: true } },
  // Going but chose not to be found: shows that hidden people never appear, only in floored counts.
  { id: "demo-dev", name: "Dev Nair", role: "Backend engineer", company: "Pinecrest", location: "Pune", interests: ["backend", "cloud run", "pub/sub"],
    questionnaire: q([], [], ["backend"]), devfestGoal: null, visibility: "hidden" },
];
