# ChatThread

Message bubbles for person-to-person chat and Klick AI, plus the composer.

| Bubble | Class | Notes |
|---|---|---|
| other | `pd-msg--other` | `secondary`, tail bottom-left. |
| self | `pd-msg--self` | `primary`, tail bottom-right. Never brand: chat stays neutral. |
| failed | `pd-msg--failed` | Dashed destructive outline plus a "Not sent. Retry" line. |
| system | `pd-msg--system` | Centred caption for context: where the Klick happened. |
| AI | `pd-msg--ai` | A card, headed by the one-stud block and "Klick AI, private to you", with source pills for every memory or event used. |

AI answers always show their sources and never send anything; drafts open in an editable preview first. A private memory is never exposed in a person-to-person chat.
