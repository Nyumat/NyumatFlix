const RADIUS = 19.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type MediaPeekScoreProps = {
  value: number;
};

export const MediaPeekScore = ({ value }: MediaPeekScoreProps) => {
  const clamped = Math.min(10, Math.max(0, value));
  const offset = CIRCUMFERENCE * (1 - clamped / 10);
  const label = clamped.toFixed(1);
  const hue = 203;
  const saturation = 52;

  return (
    <span
      className="relative grid size-11 shrink-0 place-items-center"
      aria-label={`Rating ${label} out of 10`}
    >
      <svg className="absolute inset-0" viewBox="0 0 44 44" aria-hidden="true">
        <circle
          cx="22"
          cy="22"
          r={RADIUS}
          fill="none"
          stroke="rgba(242,239,233,0.16)"
          strokeWidth="3.2"
        />
        <circle
          cx="22"
          cy="22"
          r={RADIUS}
          fill="none"
          stroke={`hsl(${hue} ${saturation}% 52%)`}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 22 22)"
        />
      </svg>
      <span className="relative text-[13px] font-semibold tabular-nums text-foreground">
        {label}
      </span>
    </span>
  );
};
