// The Prod :D brick. Identity moments only: app mark, Klick success, empty states, the AI mark.
export default function Block({ studs = 4, unit = 9 }: { studs?: 1 | 4 | 6 | 8; unit?: number }) {
  return (
    <span className={`pd-block pd-block--${studs}`} style={{ "--u": `${unit}px` } as React.CSSProperties} aria-hidden="true">
      {Array.from({ length: studs }, (_, i) => (
        <span key={i} className="pd-stud" />
      ))}
    </span>
  );
}
