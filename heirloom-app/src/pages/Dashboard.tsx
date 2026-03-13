import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { useVault } from "@/contexts/VaultContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { explorerTxUrl } from "@/config/constants";
import {
  Heart,
  Clock,
  Users,
  Shield,
  Bitcoin,
  DollarSign,
  LogOut,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  ExternalLink,
} from "lucide-react";

const statusColors: Record<string, string> = {
  active: "neo-section-lime",
  grace: "bg-accent-yellow",
  claimable: "bg-accent-red",
  distributed: "bg-secondary",
};

const DashboardPage = () => {
  const { stxAddress, disconnectWallet } = useWallet();
  const { vault, loading, pendingTxId, pendingCreate, sendHeartbeatOnChain, emergencyWithdrawOnChain, clearVault, fetchVault } = useVault();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sendingHeartbeat, setSendingHeartbeat] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [lastTxId, setLastTxId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Local countdown timer based on wall-clock time and vault's absolute timestamps.
  // Only restarts when lastHeartbeat actually changes (i.e. a real heartbeat was sent),
  // not on every poll cycle.
  useEffect(() => {
    if (!vault) return;

    const updateCountdown = () => {
      if (vault.isDistributed) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const graceDeadline = vault.lastHeartbeat + vault.heartbeatInterval;
      const pauseBonus = vault.guardianPauseUsed ? 2592000 : 0;
      const claimableDeadline = graceDeadline + vault.gracePeriod + pauseBonus;

      let remaining: number;
      if (now < graceDeadline) {
        remaining = graceDeadline - now;
      } else if (now < claimableDeadline) {
        remaining = claimableDeadline - now;
      } else {
        remaining = 0;
      }

      remaining = Math.max(0, remaining);
      setCountdown({
        days: Math.floor(remaining / 86400),
        hours: Math.floor((remaining % 86400) / 3600),
        minutes: Math.floor((remaining % 3600) / 60),
        seconds: remaining % 60,
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [vault?.lastHeartbeat, vault?.heartbeatInterval, vault?.gracePeriod, vault?.isDistributed, vault?.guardianPauseUsed]);

  const handleHeartbeat = async () => {
    setSendingHeartbeat(true);
    try {
      const txId = await sendHeartbeatOnChain();
      setLastTxId(txId);
      toast({ title: "Heartbeat Sent!", description: "Your vault timer has been reset." });
      setTimeout(fetchVault, 5000);
    } catch (err: any) {
      toast({ title: "Heartbeat Failed", description: err?.message || "Transaction rejected", variant: "destructive" });
    } finally {
      setSendingHeartbeat(false);
    }
  };

  const handleEmergencyWithdraw = async () => {
    if (!confirm("Are you sure? This will return all assets and cancel the vault permanently.")) return;
    setWithdrawing(true);
    try {
      const txId = await emergencyWithdrawOnChain();
      setLastTxId(txId);
      toast({ title: "Emergency Withdraw", description: "Assets returned to your wallet." });
      setTimeout(fetchVault, 5000);
    } catch (err: any) {
      toast({ title: "Withdraw Failed", description: err?.message || "Transaction rejected", variant: "destructive" });
    } finally {
      setWithdrawing(false);
    }
  };

  const handleDisconnect = () => {
    clearVault();
    disconnectWallet();
    navigate("/");
  };

  if (loading && !vault && !pendingCreate) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="neo-card-static text-center max-w-md">
          <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin" strokeWidth={2.5} />
          <h2 className="text-2xl font-black mb-3">Loading Vault...</h2>
          <p className="text-muted-foreground font-medium">Fetching on-chain data</p>
        </div>
      </div>
    );
  }

  if (!vault && pendingCreate) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="neo-card-static text-center max-w-md">
          <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin" strokeWidth={2.5} />
          <h2 className="text-2xl font-black mb-3">Vault Creation Pending</h2>
          <p className="text-muted-foreground font-medium mb-6">
            Waiting for your transaction to confirm on-chain. This may take a minute...
          </p>
          {pendingTxId && (
            <a
              href={explorerTxUrl(pendingTxId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 neo-badge bg-accent-cyan hover:bg-accent-cyan/80 transition-colors"
            >
              View on Explorer <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="neo-card-static text-center max-w-md">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4" strokeWidth={2.5} />
          <h2 className="text-2xl font-black mb-3">No Vault Found</h2>
          <p className="text-muted-foreground font-medium mb-6">Create a vault first to see your dashboard.</p>
          <Button variant="lime" onClick={() => navigate("/create-vault")}>
            Create Vault
          </Button>
          <div className="border-t-4 border-foreground pt-6 mt-6">
            <p className="text-sm font-bold text-muted-foreground mb-3">Were you named as an heir?</p>
            <Button variant="orange" onClick={() => navigate("/claim")}>
              Claim Inheritance
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const sbtcDisplay = (vault.sbtcBalance / 1e8).toFixed(8);
  const usdcxDisplay = (vault.usdcxBalance / 1e6).toFixed(2);
  // Compute countdown label from wall-clock time so it stays in sync with the local countdown
  const countdownLabel = (() => {
    if (vault.isDistributed) return "Vault Distributed";
    const now = Math.floor(Date.now() / 1000);
    const graceDeadline = vault.lastHeartbeat + vault.heartbeatInterval;
    const pauseBonus = vault.guardianPauseUsed ? 2592000 : 0;
    const claimableDeadline = graceDeadline + vault.gracePeriod + pauseBonus;
    if (now >= claimableDeadline) return "Vault Is Claimable";
    if (now >= graceDeadline) return "Time Until Claimable";
    return "Next Heartbeat Due In";
  })();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b-8 border-foreground bg-background sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-20">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-lg font-black hover:underline">
            <ArrowLeft className="h-5 w-5" strokeWidth={3} />
            Home
          </button>
          <span className="text-2xl font-black">Vault Dashboard</span>
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest hover:underline"
          >
            <LogOut className="h-4 w-4" strokeWidth={2.5} />
            Disconnect
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-8">
        {/* Status banner */}
        <div className={`${statusColors[vault.state] || "bg-secondary"} neo-border-thick rounded-2xl p-8 neo-shadow-xl`}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <span className="neo-badge bg-background mb-3 inline-block">Vault Status</span>
              <h2 className="text-4xl md:text-5xl font-black uppercase">{vault.state}</h2>
              <p className="text-sm font-bold text-foreground/70 mt-1 font-mono">
                Owner: {stxAddress}
              </p>
            </div>
            {vault.state !== "distributed" && (
              <Button
                variant="default"
                size="xl"
                onClick={handleHeartbeat}
                disabled={sendingHeartbeat}
                className="shrink-0"
              >
                {sendingHeartbeat ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Signing...</>
                ) : (
                  <><Heart className="h-5 w-5" /> Send Heartbeat</>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Last tx link */}
        {(lastTxId || pendingTxId) && (
          <div className="neo-card-static bg-accent-cyan/10">
            <a
              href={explorerTxUrl(lastTxId || pendingTxId || "")}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 font-bold hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              View latest transaction on Explorer
            </a>
          </div>
        )}

        {/* Countdown */}
        <div className="neo-card-static">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-6">
            {countdownLabel}
          </h3>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Days", value: countdown.days },
              { label: "Hours", value: countdown.hours },
              { label: "Min", value: countdown.minutes },
              { label: "Sec", value: countdown.seconds },
            ].map((unit) => (
              <div key={unit.label} className="text-center">
                <div className="bg-secondary neo-border rounded-xl py-4 px-2 neo-shadow-sm">
                  <span className="text-4xl md:text-6xl font-black">{String(unit.value).padStart(2, "0")}</span>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-2">
                  {unit.label}
                </p>
              </div>
            ))}
          </div>
          <p className="text-sm font-bold text-muted-foreground mt-4">
            Last heartbeat: {vault.lastHeartbeat > 0 ? new Date(vault.lastHeartbeat * 1000).toLocaleString() : "N/A"}
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="neo-card-static">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-accent-orange neo-border rounded-xl p-3">
                <Bitcoin className="h-6 w-6" strokeWidth={2.5} />
              </div>
              <h3 className="font-black">sBTC Locked</h3>
            </div>
            <p className="text-4xl font-black">{sbtcDisplay}</p>
            <p className="text-sm font-bold text-muted-foreground">{vault.sbtcBalance} sats</p>
          </div>

          <div className="neo-card-static">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-accent-cyan neo-border rounded-xl p-3">
                <DollarSign className="h-6 w-6" strokeWidth={2.5} />
              </div>
              <h3 className="font-black">USDCx Locked</h3>
            </div>
            <p className="text-4xl font-black">${usdcxDisplay}</p>
            <p className="text-sm font-bold text-muted-foreground">{vault.usdcxBalance} micro-units</p>
          </div>

          <div className="neo-card-static">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-accent-pink neo-border rounded-xl p-3">
                <Clock className="h-6 w-6" strokeWidth={2.5} />
              </div>
              <h3 className="font-black">Parameters</h3>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-sm font-bold">Interval</span>
                <span className="font-black">{vault.heartbeatInterval >= 86400 ? `${Math.round(vault.heartbeatInterval / 86400)}d` : `${vault.heartbeatInterval}s`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-bold">Grace</span>
                <span className="font-black">{vault.gracePeriod >= 86400 ? `${Math.round(vault.gracePeriod / 86400)}d` : `${vault.gracePeriod}s`}</span>
              </div>
              <div className="flex justify-between border-t-4 border-foreground pt-1 mt-1">
                <span className="text-sm font-bold">Total</span>
                <span className="font-black">{(vault.heartbeatInterval + vault.gracePeriod) >= 86400 ? `${Math.round((vault.heartbeatInterval + vault.gracePeriod) / 86400)}d` : `${vault.heartbeatInterval + vault.gracePeriod}s`}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Heirs */}
        <div className="neo-card-static">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-accent-yellow neo-border rounded-xl p-3">
              <Users className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <h3 className="text-xl font-black">Heirs ({vault.heirs.length})</h3>
          </div>
          <div className="space-y-3">
            {vault.heirs.map((h, i) => (
              <div key={i} className="flex items-center justify-between neo-border rounded-lg p-4 bg-secondary">
                <div>
                  <p className="font-black text-lg">{h.label}</p>
                  <p className="text-xs font-mono text-muted-foreground">
                    {h.address.slice(0, 12)}...{h.address.slice(-6)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black text-2xl">{(h.splitBps / 100).toFixed(0)}%</p>
                  <p className="text-xs font-bold text-muted-foreground">
                    {((vault.sbtcBalance / 1e8) * h.splitBps / 10000).toFixed(8)} sBTC
                  </p>
                  {vault.usdcxBalance > 0 && (
                    <p className="text-xs font-bold text-muted-foreground">
                      ${((vault.usdcxBalance / 1e6) * h.splitBps / 10000).toFixed(2)} USDCx
                    </p>
                  )}
                  {h.hasClaimed && (
                    <span className="neo-badge bg-accent-lime text-xs mt-1 inline-block">Claimed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Guardian */}
        {vault.guardian && (
          <div className="neo-card-static bg-accent-purple/10">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6" strokeWidth={2.5} />
              <div>
                <p className="font-black">Guardian {vault.guardianPauseUsed ? "(Pause Used)" : "Active"}</p>
                <p className="text-sm font-mono text-muted-foreground">{vault.guardian}</p>
              </div>
            </div>
          </div>
        )}

        {/* Emergency */}
        {vault.state !== "distributed" && (
          <div className="neo-card-static border-accent-red">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-lg">Emergency Withdraw</h3>
                <p className="text-sm font-medium text-muted-foreground">
                  Reclaim all assets and cancel the vault permanently.
                </p>
              </div>
              <Button
                variant="destructive"
                size="default"
                onClick={handleEmergencyWithdraw}
                disabled={withdrawing}
              >
                {withdrawing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Withdrawing...</>
                ) : (
                  <><AlertTriangle className="h-4 w-4" /> Emergency Withdraw</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
