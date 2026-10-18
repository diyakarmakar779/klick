# Klick roadmap

What comes after the prototype, and which event platforms to connect next. Written 18 Oct 2026.

## What stays the same

Every item below keeps the rules the prototype enforces: no guest lists, no automatic outreach, attendance never inferred, and every source limited to the member's own events.

## Next 3 months

- **Faster suggestions.** Gemini takes a median of 10.8 s to rank who is worth meeting (46 live calls, Oct 2026). We'll cache each member's suggestions per event, refreshing them only when someone joins, leaves or changes their goal, and limit the model's thinking time.
- **Photo memories**, alongside text and voice. The data model already has a `photo` kind and private Cloud Storage paths.
- **Read aloud** through Cloud Text-to-Speech, for members who turn on that accessibility setting.
- **Google OAuth verification**, so Calendar connects without the unverified-app screen.

## 3 to 6 months

- **More event sources** (see the table below).
- **Goal-ranked Discover.** Rank events by who's going and the member's goals, using the score designed in [`RECOMMENDATIONS.md`](RECOMMENDATIONS.md) §2. Only sources with a public-event signal can feed Discover.
- **Multilingual.** Gemini answers and drafts in the member's language (`members.languages` is already stored).
- **LinkedIn profile PDF to profile.** The member uploads their LinkedIn PDF; Gemini pre-fills role, company and interests for them to review.

## 6 to 12 months

- **Embeddings for large events.** Store a 768-dimension embedding per member (the Firestore vector index already exists) and use vector search to pick candidates before Gemini ranks them, so events with thousands of members stay fast and cheap.
- **Organiser insights.** Anonymous, aggregate numbers for an event (Klicks made, follow-ups acted on within 14 days), never names.
- **Installable app (PWA)** with an offline QR, for venues with poor signal.
- **"Someone you'd like is going" nudges**, opt-in only.

## Event platforms to connect next

Each connector follows the Luma pattern: the member signs in to their own account, Klick reads only their own events once, and the token is discarded.

| Platform | Why | How | Confidence |
|---|---|---|---|
| Eventbrite | Largest ticketing platform for meetups and conferences | Public REST API with member OAuth; read the member's own orders | High |
| Microsoft Outlook / Teams calendar | Work events for people who don't use Google | Microsoft Graph Calendar API, read-only, member OAuth | High |
| Meetup | Community and tech meetups | GraphQL API with OAuth2 and a member (`self`) query for events and RSVPs | Medium: confirm the member consent flow |
| Any calendar via an `.ics` link | Apple Calendar, Partiful and other apps that export a feed | The member pastes a private calendar link; same filtering as Google Calendar | High |
| KonfHub | Indian tech conferences | Organiser-side Registration API and webhooks, so an organiser partnership | Medium |
| Bevy | Google Developer Groups and company communities | Organiser-side; partner with a chapter | Low: no public member API found |
| Devfolio, Unstop | Hackathons and student events in India | Partnership | Low: no public member API found |

A new source goes through the same identity rules as today. An event is one record per real event, identified by the provider's id or a shared event link. A Calendar invite that carries a lu.ma link already joins the Luma event, and the same approach extends to Eventbrite and Meetup links.
