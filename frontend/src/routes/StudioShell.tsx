import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  closePool,
  getMyPool,
  openPool,
  patchPool,
  type PoolRule,
  type PresetStyle,
} from "../api/pool";
import { CommandPanel, SignalPill } from "../design/commandCenter";
import {
  PresetCards,
  STUDIO_PRESETS,
  type StudioPresetDefinition,
} from "../components/studio/PresetCards";
import { RuleLine } from "../components/studio/RuleLine";
import { StakeSlider } from "../components/studio/StakeSlider";
import { PoolDashboard } from "../components/studio/PoolDashboard";
import { PoolCopilotPanel } from "../components/studio/PoolCopilotPanel";
import { DevInjectDelayButton } from "../components/studio/DevInjectDelayButton";
import { useMe } from "../hooks/useMe";
import { usePoolStore } from "../store/pool";

const DEFAULT_PRESET = STUDIO_PRESETS[0];

export function StudioShell() {
  const { user } = useMe();
  const [selectedPreset, setSelectedPreset] = useState<PresetStyle>(
    DEFAULT_PRESET.id,
  );
  const [rule, setRule] = useState<PoolRule>(DEFAULT_PRESET.rule);
  const [stake, setStake] = useState(200);
  const [isOpening, setIsOpening] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { data: serverPool, isLoading, mutate } = useSWR("/pools/me", getMyPool, {
    revalidateOnFocus: false,
  });
  const activePool = usePoolStore((state) => state.activePool);
  const exposure = usePoolStore((state) => state.exposure);
  const hits24h = usePoolStore((state) => state.hits24h);
  const paidOut = usePoolStore((state) => state.paidOut);
  const ticker = usePoolStore((state) => state.ticker);
  const setActivePool = usePoolStore((state) => state.setActivePool);
  const clearPool = usePoolStore((state) => state.clearPool);

  useEffect(() => {
    if (serverPool === undefined) return;
    if (serverPool) {
      setActivePool(serverPool);
      setRule(serverPool.rule);
      setStake(serverPool.stake_ria);
      setSelectedPreset(serverPool.preset_style);
    } else if (!activePool) {
      clearPool();
    }
  }, [activePool, clearPool, serverPool, setActivePool]);

  const canOpen = Boolean(user && user.balance >= stake && !activePool);

  function handlePresetChange(preset: Pick<StudioPresetDefinition, "id" | "rule">) {
    setSelectedPreset(preset.id);
    setRule(preset.rule);
  }

  async function handleOpenPool() {
    setErrorMessage(null);
    setIsOpening(true);
    try {
      const pool = await openPool({
        preset_style: selectedPreset,
        stake_ria: stake,
        ...rule,
      });
      setActivePool(pool);
      setRule(pool.rule);
      setStake(pool.stake_ria);
      await mutate(pool, { revalidate: false });
    } catch {
      setErrorMessage("You already have an active pool - close it first");
    } finally {
      setIsOpening(false);
    }
  }

  async function handleRuleChange(nextRule: PoolRule) {
    setRule(nextRule);
    if (!activePool) return;
    try {
      const updated = await patchPool(activePool.id, nextRule);
      setActivePool(updated);
      await mutate(updated, { revalidate: false });
    } catch {
      setErrorMessage("Rule update failed");
    }
  }

  async function handleClosePool() {
    if (!activePool) return;
    setIsClosing(true);
    setErrorMessage(null);
    try {
      await closePool(activePool.id);
      clearPool();
      await mutate(null, { revalidate: false });
    } catch {
      setErrorMessage("Pool close failed");
    } finally {
      setIsClosing(false);
    }
  }

  if (isLoading) {
    return (
      <main className="command-center-shell command-safe-area" style={{ padding: 32 }}>
        loading studio...
      </main>
    );
  }

  return (
    <main
      className="command-center-shell command-safe-area"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(min(360px, 100%), 420px)",
        gap: "var(--layout-panel-gap)",
        alignItems: "start",
        maxWidth: 1360,
        margin: "0 auto",
        padding: "32px 24px 72px",
      }}
    >
      <CommandPanel
        aria-label={activePool ? "Underwriter pool live" : "Underwriter studio empty"}
        eyebrow="UNDERWRITER STUDIO"
        status={activePool ? "ACTIVE" : "READY"}
        title={
          activePool
            ? "Underwriter pool live"
            : "Underwrite delay risk in 3 seconds."
        }
      >
        <div style={{ display: "grid", gap: "var(--layout-panel-gap)" }}>
          {activePool ? (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <SignalPill tone="radar">Preset {activePool.preset_style}</SignalPill>
                <SignalPill tone={activePool.pl >= 0 ? "radar" : "elevated"}>
                  P/L {activePool.pl >= 0 ? `+${activePool.pl}` : activePool.pl} RIA
                </SignalPill>
              </div>
              <DevInjectDelayButton poolId={activePool.id} />
              <RuleLine rule={rule} onChange={handleRuleChange} />
              <PoolDashboard
                exposure={exposure}
                hits24h={hits24h}
                paidOut={paidOut}
                pool={activePool}
                ticker={ticker}
              />
              <button
                className="command-focus-ring"
                disabled={isClosing}
                onClick={handleClosePool}
                style={{
                  justifySelf: "start",
                  minHeight: 38,
                  padding: "0 14px",
                  color: "var(--warn-amber)",
                  background: "var(--command-surface-glass)",
                  border: "1px solid var(--warn-amber)",
                  borderRadius: "var(--radius-pill)",
                  cursor: isClosing ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--font-size-caption)",
                  textTransform: "uppercase",
                }}
                type="button"
              >
                {isClosing ? "CLOSING" : "CLOSE POOL"}
              </button>
            </>
          ) : (
            <>
              <PresetCards
                selectedPreset={selectedPreset}
                onPresetChange={handlePresetChange}
              />
              <RuleLine rule={rule} onChange={handleRuleChange} />
              <StakeSlider
                canOpen={canOpen}
                isOpening={isOpening}
                onOpen={handleOpenPool}
                onStakeChange={setStake}
                rule={rule}
                stake={stake}
              />
            </>
          )}
          {errorMessage ? (
            <div
              role="alert"
              style={{
                color: "var(--warn-amber)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--font-size-caption)",
              }}
            >
              {errorMessage}
            </div>
          ) : null}
        </div>
      </CommandPanel>
      <PoolCopilotPanel pool={activePool} />
    </main>
  );
}
