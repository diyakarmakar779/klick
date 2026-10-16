# Prod :D design system, offline copy

- **index.html**: open in a browser to see every component, with a theme switcher (product colour x light/dark).
- **README.md**: the brand book: colour, type, shape, dark mode, responsive rules, voice, iconography.
- **tokens.json**: every token with values per theme and a usage note. The source for code.
- **tokens.css**: the same tokens as CSS variables. Themes switch with `<html data-theme="blue-light">` (blue, red, yellow, green, each `-light` or `-dark`).
- **components/**: one folder per component with its guidelines (README.md) and a preview (preview.html). `components/bundle.css` holds the reference styles the previews use (`pd-*` classes).

The app's own code (`app/globals.css`, `components/ui/button.tsx`) is separate and still needs updating to match this version.
