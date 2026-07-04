import { useId, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

export type CommandTone =
  | "low"
  | "guarded"
  | "elevated"
  | "severe"
  | "radar"
  | "weather"
  | "neutral";

type CommandPanelProps = {
  eyebrow?: string;
  title: string;
  status?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>;

export type CommandMetric = {
  id: string;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: CommandTone;
};

type MetricDeckProps = {
  metrics: CommandMetric[];
  ariaLabel?: string;
  className?: string;
};

type SignalPillProps = {
  tone?: CommandTone;
  label?: string;
  children: ReactNode;
  className?: string;
  as?: "span" | "div";
} & Omit<HTMLAttributes<HTMLSpanElement | HTMLDivElement>, "aria-label" | "children" | "className">;

type DivergenceMeterProps = {
  label: string;
  value: number;
  tone?: CommandTone;
  className?: string;
};

export type RiskTickerItem = {
  id: string;
  label: string;
  value: ReactNode;
  direction: "up" | "down" | "flat";
  detail?: ReactNode;
  tone?: CommandTone;
};

type RiskTickerProps = {
  items: RiskTickerItem[];
  ariaLabel?: string;
  className?: string;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function toneClass(tone: CommandTone | undefined) {
  if (!tone || tone === "neutral") {
    return undefined;
  }

  return `risk-level--${tone}`;
}

function clampPercent(value: number) {
  const finiteValue = Number.isFinite(value) ? value : 0;

  return Math.max(-100, Math.min(100, Math.round(finiteValue)));
}

function directionGlyph(direction: RiskTickerItem["direction"]) {
  if (direction === "up") {
    return "UP";
  }

  if (direction === "down") {
    return "DOWN";
  }

  return "FLAT";
}

export function CommandPanel({
  eyebrow,
  title,
  status,
  children,
  className,
  role,
  ...sectionProps
}: CommandPanelProps) {
  const ariaLabel = sectionProps["aria-label"] ?? title;

  return (
    <section
      {...sectionProps}
      aria-label={ariaLabel}
      className={cx("command-panel", "command-surface", className)}
      role={role ?? "region"}
    >
      <div
        aria-hidden="true"
        className="command-decorative-layer command-scanline"
        data-testid="command-panel-decor"
      />
      <div className="command-panel__header">
        <div>
          {eyebrow ? <div className="command-panel__eyebrow">{eyebrow}</div> : null}
          <h2 className="command-panel__title">{title}</h2>
        </div>
        {status ? <div className="command-panel__status">{status}</div> : null}
      </div>
      <div className="command-panel__body">{children}</div>
    </section>
  );
}

export function MetricDeck({ metrics, ariaLabel = "Command metrics", className }: MetricDeckProps) {
  return (
    <div aria-label={ariaLabel} className={cx("metric-deck", className)} role="list">
      {metrics.map((metric) => (
        <div
          className={cx("metric-deck__item", toneClass(metric.tone))}
          key={metric.id}
          role="listitem"
        >
          <span className="metric-deck__label">{metric.label}</span>
          <span className="metric-deck__value">{metric.value}</span>
          {metric.detail ? <div className="metric-deck__detail">{metric.detail}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function SignalPill({
  tone = "radar",
  label,
  children,
  className,
  as = "span",
  ...pillProps
}: SignalPillProps) {
  const Component = as;

  return (
    <Component
      {...pillProps}
      aria-label={label}
      className={cx("signal-pill", `signal-pill--${tone}`, toneClass(tone), className)}
    >
      {children}
    </Component>
  );
}

export function DivergenceMeter({
  label,
  value,
  tone = "radar",
  className,
}: DivergenceMeterProps) {
  const clampedValue = clampPercent(value);
  const magnitude = Math.abs(clampedValue);
  const style = {
    "--divergence-value": `${clampedValue}%`,
    "--divergence-extent": `${magnitude / 2}%`,
    "--divergence-offset": clampedValue < 0 ? "-100%" : "0%",
  } as CSSProperties;

  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={-100}
      aria-valuenow={clampedValue}
      className={cx("divergence-meter", toneClass(tone), className)}
      role="meter"
      style={style}
    >
      <span className="divergence-meter__label">{label}</span>
      <span className="divergence-meter__track">
        <span className="divergence-meter__bar" />
      </span>
    </div>
  );
}

export function RiskTicker({
  items,
  ariaLabel = "Risk ticker",
  className,
}: RiskTickerProps) {
  const boundaryId = useId();

  return (
    <div
      aria-describedby={boundaryId}
      aria-label={ariaLabel}
      className={cx("risk-ticker", className)}
      role="group"
    >
      <div aria-label={`${ariaLabel} signals`} className="risk-ticker__track" role="list">
        {items.map((item) => (
          <div
            className={cx("risk-ticker__item", toneClass(item.tone))}
            key={item.id}
            role="listitem"
          >
            <span className="risk-ticker__label">{item.label}</span>
            <span className="risk-ticker__value">{item.value}</span>
            <span
              aria-label={`${item.label} risk direction ${item.direction}`}
              className="risk-ticker__direction"
            >
              {directionGlyph(item.direction)}
            </span>
            {item.detail ? <span className="risk-ticker__detail">{item.detail}</span> : null}
          </div>
        ))}
      </div>
      <span className="risk-ticker__boundary" id={boundaryId}>
        signal-only
      </span>
    </div>
  );
}
