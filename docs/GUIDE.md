# Klick step-by-step guide

How to try every Klick feature on the live app, in about 10 minutes. You need a Google account and a phone or a desktop browser. Klick is built mobile-first; on a desktop, Chrome's phone view (F12, then the device icon) shows it as designed.

- Live app: https://hey-os-511517.web.app
- API health check: https://event-networking-api-smqzajwk5q-el.a.run.app/health returns `{"ok":true}`

## Before you start

- **Use Demo events.** Most people don't have a Luma account with upcoming events, so the guide uses **Demo events**: sample events and clearly fictional sample people (`example.com` addresses). Nothing about them is real.
- **The first load can be slow.** The API scales to zero when idle, so the first request after a quiet period takes a few seconds longer while Cloud Run starts it.
- **Suggestions take time.** Gemini takes about 10 seconds to rank who is worth meeting. The page shows a loading state while it works.
- **Pop-ups must be allowed.** Google sign-in opens in a pop-up. If nothing happens, allow pop-ups for the site.

## 1. Sign in and onboard

1. Open the live app and tap **Create account**, then **Continue with Google**.
2. **You're signed in.** Klick shows the verified email from your Google account. Continue.
3. **You decide what Klick sees and shares.** Read the consent screen and continue. Klick only reads events you're part of and never shows guest lists.
4. **Make your block.** Pick a colour and stud pattern. Your block is your identity mark and, later, your QR code.
5. **Add your LinkedIn** (optional). Type your profile link. It is stored as something you told Klick; Klick never looks you up or scrapes LinkedIn.
6. **Where do your events live?** Choose **Demo events**. You can also connect Google Calendar or Luma here (see section 8).
7. **Who do you want to meet?** Pick what you're looking for, what you can offer, topics, and how you prefer to meet. Leave **Let people at my events find me** on, because suggestions are reciprocal: you only see people who chose to be found, and only if you can be found too. The **Make Klick easier for me** options (simple language, read aloud, text first, quiet spaces) change how Klick talks to you.
8. You land on **Home**.

## 2. Home

- **Follow up** shows a reminder about Meera from a past meetup, with the reason it's due.
- **Your upcoming events** lists DevFest Pune 2026 and, if you plan to attend it, the event from Discover.
- **Worth meeting next** appears once Klick has suggestions for your next event.

## 3. An event page: who's worth meeting

1. Go to **Events**, then **Yours**, and open **DevFest Pune 2026**.
2. Under **Get ready**, set **Why you're going** (for example, "find a co-founder"). Gemini uses this to rank people.
3. Check **Let members at this event find you** is on. If it's off, Klick asks you to turn it on before showing suggestions.
4. **Who's going** shows:
   - **Worth meeting:** up to 5 people, each with a reason that cites something you both shared, and a conversation starter. Ranked by Gemini; if Gemini is unavailable, a simple overlap ranking takes over.
   - **Catch up:** your existing Klicks who are going.
   - Counts of other members, floored at "fewer than 3". There is never a guest list.
5. Tap **Request a Klick** on a suggestion, choose what to share (for example, email and LinkedIn), and send it. The other person has to accept before anything is shared.

## 4. Ask Klick AI about the event

1. On the DevFest page, scroll to **Klick AI chats** (only you see these) and tap **Ask who's going, who to meet, or how to prep**, or **New chat**.
2. Ask, for example, "Who should I meet for fundraising advice?" or "Which of my Klicks are going?"
3. The answer names people as tappable cards and lists its sources. Klick AI only sees what you're allowed to see: your Klicks, people who chose to be found, your own notes. It never sees contact details or anyone else's notes.

## 5. Klicks, memories and follow-ups

1. Open **Profile**, then **Klicks** (or the Klicks button at the top of **Chats**).
   - **Requests:** Kabir has asked to Klick with you. Tap **Accept** and choose which contact fields to share.
   - **Klicked:** the three people you met at the past Climate Tech Builders Meetup.
2. Open **Meera**. Under **Memories**, type a note or tap **Record a voice note** (allow the microphone), then **Save**.
3. Gemini summarises the note into a draft memory with topics, promises and a suggested follow-up. Edit anything that's wrong and tap **Save memory**. Only you can see it.
4. Under **Follow-ups**, or on **Home**, tap **Draft a message to Meera**. Gemini writes a draft from your own notes. Klick never sends anything for you: send it yourself wherever you talk to Meera, then tap **I sent it**.

## 6. Chat with your Klicks

1. Open **Chats**. Meera and Ravi have sent you messages.
2. Open a chat and reply. Messages only flow while a Klick is accepted. If either person ends the Klick, the chat becomes read-only.
3. Your Klick AI chats for each event are listed here too.

## 7. QR: exchange details in person

This needs a second Google account, on another phone or in a private browser window.

1. On account A, open **Profile** and tap **Show my QR**. Your block turns into a scannable code.
2. On account B, tap the raised **QR** button in the bottom bar to open the scanner and point the camera at the code. Without a camera, A taps **Can't scan? Copy your link** under the QR and sends it to B, who uses **Paste a link instead**.
3. Account B sees A's public profile and which contact fields exist, but not their values. Tap **Request a Klick** and choose what to share.
4. On account A, open **Klicks**, then **Requests**, and accept with the fields A wants to share. Only now do both see the chosen details.

## 8. Discover and real event sources

- **Discover** (Events, then **Discover**) shows upcoming Luma events your Klicks are going to, only if they let their Klicks see it. With Demo events, this is "Women in Cloud Pune: Build with Gemini". Calendar-only events never appear, because they may be private meetings.
- **Google Calendar:** Profile, then **Connected accounts**, then Google Calendar. Google shows an unverified-app screen while the app's verification is pending; choose **Advanced**, then continue. Klick reads your events once, keeps only real events (no flights or reminders), and doesn't keep the access token.
- **Luma:** Profile, then **Connected accounts**, then Luma. You sign in on Luma; Klick reads only your own events through Luma's official MCP server and discards the token.

## 9. Privacy controls to try

- Profile, then **Privacy and visibility**: turn off **Be findable at new events**. You disappear from suggestions, and your suggestions stop too (they're reciprocal).
- On any event page, change whether members at that event can find you.
- On a Klick, end it or block. Blocking is final.
- Profile, then **Sign out**.

## Troubleshooting

| What you see | What to do |
|---|---|
| Nothing happens on **Continue with Google** | Allow pop-ups for the site, then try again |
| "Google hasn't verified this app" when connecting Calendar | Choose **Advanced**, then continue. Or use Demo events |
| No **Worth meeting** list on an event page | Turn on **Let members at this event find you** on that page. Suggestions are reciprocal |
| The first screen takes a few seconds | The API is starting after being idle. Later requests are fast |
| The camera won't open on the scanner | Use **Paste a link instead** |
