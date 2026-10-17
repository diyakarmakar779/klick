# Recommendations and sharing: what we borrow from X's ranking

How Klick decides which people and events to suggest, and how it grows by people sharing it, using ideas from X's (Twitter's) ranking system. Written 13 Oct 2026, updated 17 Oct 2026 to match the code.

**Source note.** The numbers below come from the code X open-sourced in March 2023 (`twitter/the-algorithm` and `the-algorithm-ml`). X has said its ranking has changed since, so treat this as a pattern to learn from, not a description of X today.

## 1. How X ranks a "For you" timeline (the 2023 release)

1. **Candidate sourcing.** From hundreds of millions of posts, pick about 1,500. Roughly half come from accounts you follow ("in-network", ranked by RealGraph, a model of how likely you are to interact with each account). The other half come from outside ("out-of-network"), found through SimClusters (communities of shared interest) and TwHIN (embeddings of who engages with what).
2. **Heavy ranker.** A neural network predicts the chance you'll do each of about ten things with a post. The score is a weighted sum. Published weights:

   | Predicted action | Weight |
   |---|---|
   | Like | 0.5 |
   | Repost | 1 |
   | Reply | 13.5 |
   | Open the author's profile and engage | 12 |
   | Click into the conversation and stay or reply | 11 |
   | Reply that the author then replies to | 75 |
   | "Show less" / mute / block | −74 |
   | Report | −369 |

   The lesson: **two-way conversation is worth over 100 times a like, and one "not interested" cancels about 150 likes.**
3. **Filters and heuristics.** Remove blocked or muted authors, keep author diversity (don't show five posts from one person in a row), balance in-network and out-of-network, and back off after negative feedback ("feedback fatigue").
4. **Mixing.** Insert ads, follow suggestions and prompts into the final list.

## 2. What Klick takes from it

Klick ranks **people to meet at an event you're attending**, **follow-ups worth sending**, and (later) **events worth going to**. The X pattern maps well, with one big change: our goal is a real conversation between two people who both said yes, not time spent in the app.

### People matches (`GET /v1/events/:id/matches`)

| X stage | Klick today | Next step |
|---|---|---|
| Candidate sourcing | Only members confirmed for the same event who chose to be visible (R2), reciprocal | Add "out-of-network": people your accepted connections met at earlier events, if both sides allow it |
| Light ranker | `overlapRank`: shared interests, topics, "looking for" vs "offering" | Add questionnaire embeddings (Vertex AI text embeddings; the vector index on `members.embedding` exists, nothing generates embeddings yet) |
| Heavy ranker | Gemini picks up to 5 of the top 20 and explains each with quoted evidence | Feed outcome signals back in (table below) |
| Filters | Drops blocked, pending and already accepted people; drops invented ids | Diversity: don't show five people from the same company; cap per session |

**Outcome signals we can learn from, weighted the X way** (none of these need data about anyone outside Klick):

| Signal | Proposed weight | Why |
|---|---|---|
| Suggestion viewed | 0.5 | Cheap, like a "like" |
| Request sent from a suggestion | 10 | Intent |
| Request accepted | 30 | Both people said yes |
| Memory saved about this person | 40 | The meeting was worth remembering |
| Follow-up sent and the other person replied | 75 | X's top signal, and our real goal: an ongoing conversation |
| Declined / "not relevant" | −50 | Stop suggesting this kind of person |
| Blocked or reported | −300 | Never again, and review the match reason |

At demo scale we'd use these to re-weight the light ranker (and include them in Gemini's prompt as context), not to train a model.

### Event recommendations (partly built)

**Built: Discover** (`GET /v1/discover`). It lists upcoming events you aren't part of yet that at least one of your accepted Klicks is going to (and doesn't hide from Klicks), sorted by date. Each shows:

- Which of your Klicks are going, by name, since you already know them.
- How many other members going are worth meeting, as a count floored at "fewer than 3".
- Save, and "Plan to attend" (`POST /v1/events/:id/plan`).

**Not built: ranking and reach.** No score orders the list, and events no Klick is going to never appear. The plan:

- "Matches your topics: Climate, AI" (from the event's tags and your questionnaire).
- "42 Klick members going" (counts only, floored at "fewer than 3").
- Score idea: `0.4 × topic match + 0.3 × Klicks going + 0.2 × how many Klick members going (log scale) + 0.1 × freshness`, minus a penalty for categories you dismissed.
- Suggest only events that are public on their provider once events beyond your Klicks' are included.

## 3. Sharing and growth (virality)

X grows because every repost shows a post to a new audience. Klick can grow the same way, but only through things a member chooses to share (no automatic outreach, per the brief).

| Loop | What the member does | What the receiver sees |
|---|---|---|
| **"I'm going" card** | Shares an event card to WhatsApp, X or LinkedIn from the event page | Event name, date, cover, "12 people from Klick are going", and a join link with an invite code |
| **Invite a friend to an event** | Picks a contact on their own phone and sends the link themselves | "Asha invited you to meet people at DevFest Pune on Klick" |
| **Post-event recap** | Shares "I met 5 people at DevFest, here's what we talked about" (only their own memories, chosen by them) | A recap card and the join link |
| **Reconnect** | Sends a Gemini-drafted follow-up themselves | A personal message (no Klick branding needed) |

**Measuring it.** K-factor = invites sent per member × share of invites that join. Above 1 means each member brings in more than one new member. We'd track invite code → signup → connected source → first accepted connection.

## 4. "A is on Klick, B and C are not": what we can and can't show

Luma shows "Going: A, B, C" because Luma is the host's tool and guests agreed to Luma's rules. Klick can't do the same:

- **We never see B and C.** We import only each member's own events (R1). Luma's guest list is only available to hosts, and Calendar's guest list is someone else's data.
- **The brief rules it out.** It says no guest-list operations and no public attendee scraping.
- **Luma's terms require consent** from people whose data you import, and B and C haven't joined.

What we show instead:

| Instead of | We show |
|---|---|
| A list of everyone going | "N Klick members going" (counts only; "fewer than 3" for tiny numbers so no one is singled out) |
| "B and C are not on Klick" | Luma's own public "N going" (`providerGuestCount`), side by side with the Klick number. Stored on import, not shown in the app yet |
| Names of people going | Your own Klicks who are going, and, if you're findable too, people who chose to be found |
| Contacting B and C for you | An invite link you send yourself |

## 5. What's built today

- One event record per real event. A second member importing the same Luma or Calendar event joins the existing record, and a Calendar invite containing a lu.ma link joins the Luma event.
- Luma-style details: category, tags, organizer, cover image, provider guest count (stored).
- People matches: `overlapRank`, then Gemini with quoted evidence, with the deterministic ranking as a fallback.
- `GET /v1/events/:id`: the event, member counts (floored), your Klicks going, people you met here, and people worth meeting if you're findable.
- Discover, as above.
- Not built yet: ranked event recommendations, share cards, invite codes and the signal weights above.
