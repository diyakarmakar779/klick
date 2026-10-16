// "Step 2 of 3" with a progress bar. Progress uses the brand colour, per the design system.
export default function Steps({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <div className="k-steps">
      <span className="k-caption">
        Step {step} of {total}
      </span>
      <div className="pd-progress" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step}>
        <div style={{ width: `${(step / total) * 100}%` }} />
      </div>
    </div>
  );
}
