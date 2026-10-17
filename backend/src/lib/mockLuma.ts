// Luma-shaped mock connector. Same output type as the real Luma MCP connector will return,
// so the demo can switch between them. External ids are stable so every demo member lands on the same events.
import type { ImportedEvent } from "../db/repos/events.js";

const day = 24 * 60 * 60 * 1000;

export function mockLumaEvents(memberId: string, now = new Date()): ImportedEvent[] {
  // Deterministic per member, so the seed produces a mix of states.
  const h = [...memberId].reduce((a, c) => a + c.charCodeAt(0), 0);
  return [
    {
      externalId: "evt-devfest-pune-2026",
      title: "DevFest Pune 2026",
      description: "Community conference on Android, Web, Cloud and AI, run by GDG Pune.",
      startsAt: new Date(now.getTime() + 3 * day),
      endsAt: new Date(now.getTime() + 3 * day + 8 * 60 * 60 * 1000),
      timezone: "Asia/Kolkata",
      venue: { name: "Pune International Centre", city: "Pune", online: false },
      url: "https://lu.ma/devfest-pune-2026",
      category: "Tech conference",
      tags: ["AI", "Android", "Web", "Cloud"],
      coverImageUrl: null,
      organizerName: "GDG Pune",
      guestCount: 640,
      state: h % 7 === 0 ? "host" : "registered",
    },
    {
      externalId: "evt-climate-tech-meetup",
      title: "Climate Tech Builders Meetup",
      description: "Monthly meetup for people building for climate resilience and sustainability.",
      startsAt: new Date(now.getTime() - 10 * day),
      endsAt: new Date(now.getTime() - 10 * day + 3 * 60 * 60 * 1000),
      timezone: "Asia/Kolkata",
      venue: { name: "91springboard", city: "Pune", online: false },
      url: "https://lu.ma/climate-builders-oct",
      category: "Meetup",
      tags: ["Climate", "Sustainability"],
      coverImageUrl: null,
      organizerName: "Climate Builders Pune",
      guestCount: 85,
      // Past event: some members have a host check-in record, the rest only an RSVP.
      state: h % 2 === 0 ? "attended" : "registered",
      stateRef: h % 2 === 0 ? `checkin:${memberId}` : undefined,
    },
    // Only demo members are going, so a judge finds it through Discover (where their Klicks are going).
    ...(memberId.startsWith("demo-")
      ? [
          {
            externalId: "evt-women-in-cloud-pune",
            title: "Women in Cloud Pune: Build with Gemini",
            description: "Hands-on evening of Gemini and Firebase demos, with lightning talks from first-time speakers.",
            startsAt: new Date(now.getTime() + 9 * day),
            endsAt: new Date(now.getTime() + 9 * day + 3 * 60 * 60 * 1000),
            timezone: "Asia/Kolkata",
            venue: { name: "Thoughtworks Pune", city: "Pune", online: false },
            url: "https://lu.ma/wic-pune-gemini",
            category: "Meetup",
            tags: ["AI", "Community", "Inclusion"],
            coverImageUrl: null,
            organizerName: "Women in Cloud Pune",
            guestCount: 120,
            state: "registered" as const,
          },
        ]
      : []),
  ];
}
