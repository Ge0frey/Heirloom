import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { useVault } from "@/contexts/VaultContext";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";

const DashboardPage = () => {
  const { address, disconnect, sbtcBalance, usdcxBalance } = useWallet();
  const { vault, sendHeartbeat, clearVault } = useVault();
  const navigate = useNavigate();
  const [sendingHeartbeat, setSendingHeartbeat] = useState(false);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!vault) return;
    const interval = setInterval(() => {
      const now = new Date();
      const deadline = new Date(vault.lastHeartbeat);
      deadline.setDate(deadline.getDate() + vault.heartbeatInterval);
      const diff = deadline.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        setCountdown({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / (1000 * 60)) % 60),
          seconds: Math.floor((diff / 1000) % 60),
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [vault]);

  const handleHeartbeat = async () => {
    setSendingHeartbeat(true);
    await new Promise((r) => setTimeout(r, 1500));
    sendHeartbeat();
    setSendingHeartbeat(false);
  };

  const handleDisconnect = () => {
    clearVault();
    disconnect();
    navigate("/");
  };

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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b-8 border-foreground bg-background sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-20">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-lg font-black hover:underline">
            <ArrowLeft className="h-5 w-5" strokeWidth={3} />
            Home
          </button>
          <span className="text-2xl font-black">⚡ Vault Dashboard</span>
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
        <div className="neo-section-lime neo-border-thick rounded-2xl p-8 neo-shadow-xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <span className="neo-badge bg-background mb-3 inline-block">Vault Status</span>
              <h2 className="text-4xl md:text-5xl font-black uppercase">{vault.status}</h2>
              <p className="text-sm font-bold text-foreground/70 mt-1 font-mono">
                Owner: {address}
              </p>
            </div>
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
          </div>
        </div>

        {/* Countdown */}
        <div className="neo-card-static">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-6">
            Next Heartbeat Due In
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
            Last heartbeat: {vault.lastHeartbeat.toLocaleString()}
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
            <p className="text-4xl font-black">{vault.sbtcDeposit.toFixed(4)}</p>
            <p className="text-sm font-bold text-muted-foreground">≈ ${(vault.sbtcDeposit * 100000).toLocaleString()}</p>
          </div>

          <div className="neo-card-static">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-accent-cyan neo-border rounded-xl p-3">
                <DollarSign className="h-6 w-6" strokeWidth={2.5} />
              </div>
              <h3 className="font-black">USDCx Locked</h3>
            </div>
            <p className="text-4xl font-black">${vault.usdcxDeposit.toLocaleString()}</p>
            <p className="text-sm font-bold text-muted-foreground">Stable value</p>
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
                <span className="font-black">{vault.heartbeatInterval}d</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-bold">Grace</span>
                <span className="font-black">{vault.gracePeriod}d</span>
              </div>
              <div className="flex justify-between border-t-4 border-foreground pt-1 mt-1">
                <span className="text-sm font-bold">Total</span>
                <span className="font-black">{vault.heartbeatInterval + vault.gracePeriod}d</span>
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
                    {(vault.sbtcDeposit * h.splitBps / 10000).toFixed(4)} sBTC
                  </p>
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
                <p className="font-black">Guardian Active</p>
                <p className="text-sm font-mono text-muted-foreground">{vault.guardian}</p>
              </div>
            </div>
          </div>
        )}

        {/* Emergency */}
        <div className="neo-card-static border-accent-red">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-black text-lg">Emergency Withdraw</h3>
              <p className="text-sm font-medium text-muted-foreground">
                Reclaim all assets and cancel the vault.
              </p>
            </div>
            <Button variant="destructive" size="default">
              <AlertTriangle className="h-4 w-4" /> Emergency Withdraw
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;