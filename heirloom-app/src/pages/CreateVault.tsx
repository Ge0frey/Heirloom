import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { useVault, type Heir, type VaultData } from "@/contexts/VaultContext";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Heart,
  Clock,
  Users,
  Shield,
  Bitcoin,
  DollarSign,
  CheckCircle,
} from "lucide-react";

const STEPS = ["Heartbeat", "Heirs", "Deposit", "Review"];

const CreateVaultPage = () => {
  const { address, sbtcBalance, usdcxBalance } = useWallet();
  const { createVault } = useVault();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);

  // Step 1: Heartbeat
  const [heartbeatDays, setHeartbeatDays] = useState(90);
  const [graceDays, setGraceDays] = useState(30);

  // Step 2: Heirs
  const [heirs, setHeirs] = useState<Heir[]>([
    { address: "", label: "Heir 1", splitBps: 10000 },
  ]);

  // Step 3: Deposit
  const [sbtcDeposit, setSbtcDeposit] = useState(0.1);
  const [usdcxDeposit, setUsdcxDeposit] = useState(1000);

  // Step 4: Guardian
  const [guardian, setGuardian] = useState("");

  // Submitted
  const [submitted, setSubmitted] = useState(false);

  const totalBps = heirs.reduce((sum, h) => sum + h.splitBps, 0);
  const isHeirsValid = heirs.length > 0 && totalBps === 10000 && heirs.every((h) => h.address.trim().length > 0);

  const addHeir = () => {
    if (heirs.length >= 10) return;
    setHeirs([...heirs, { address: "", label: `Heir ${heirs.length + 1}`, splitBps: 0 }]);
  };

  const removeHeir = (idx: number) => {
    if (heirs.length <= 1) return;
    setHeirs(heirs.filter((_, i) => i !== idx));
  };

  const updateHeir = (idx: number, field: keyof Heir, value: string | number) => {
    setHeirs(heirs.map((h, i) => (i === idx ? { ...h, [field]: value } : h)));
  };

  const handleSubmit = () => {
    const vault: VaultData = {
      heartbeatInterval: heartbeatDays,
      gracePeriod: graceDays,
      heirs,
      guardian: guardian.trim() || null,
      sbtcDeposit,
      usdcxDeposit,
      createdAt: new Date(),
      lastHeartbeat: new Date(),
      status: "active",
    };
    createVault(vault);
    setSubmitted(true);
    setTimeout(() => navigate("/dashboard"), 2000);
  };

  const canProceed = () => {
    if (step === 0) return heartbeatDays >= 1 && graceDays >= 1;
    if (step === 1) return isHeirsValid;
    if (step === 2) return sbtcDeposit > 0 || usdcxDeposit > 0;
    return true;
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-accent-lime flex items-center justify-center p-6">
        <div className="neo-card-static text-center max-w-md w-full">
          <div className="bg-accent-lime neo-border rounded-full p-6 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <CheckCircle className="h-10 w-10" strokeWidth={2.5} />
          </div>
          <h2 className="text-3xl font-black mb-3">Vault Created!</h2>
          <p className="text-lg font-medium text-muted-foreground">
            Your heartbeat is live. Redirecting to dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b-8 border-foreground bg-background sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between h-20">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-lg font-black hover:underline">
            <ArrowLeft className="h-5 w-5" strokeWidth={3} />
            Back
          </button>
          <span className="text-2xl font-black">⚡ Create Vault</span>
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-secondary border-b-4 border-foreground">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1">
                <div
                  className={`h-3 neo-border rounded-full ${
                    i <= step ? "bg-accent-lime" : "bg-secondary"
                  } transition-colors`}
                />
                <p
                  className={`text-xs font-bold uppercase tracking-widest mt-2 ${
                    i === step ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Step 0: Heartbeat */}
        {step === 0 && (
          <div className="space-y-8">
            <div>
              <span className="neo-badge bg-accent-pink mb-4 inline-block">Step 1</span>
              <h2 className="text-4xl md:text-5xl font-black leading-[0.9]">
                Set your{" "}
                <span className="bg-accent-pink px-2 inline-block rotate-[-1deg]">heartbeat.</span>
              </h2>
              <p className="text-lg font-medium text-muted-foreground mt-4 max-w-xl">
                How often will you check in? If you miss a heartbeat, the grace period starts.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="neo-card-static">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-accent-pink neo-border rounded-xl p-3">
                    <Heart className="h-6 w-6" strokeWidth={2.5} />
                  </div>
                  <h3 className="text-xl font-black">Heartbeat Interval</h3>
                </div>
                <div className="space-y-4">
                  <input
                    type="range"
                    min={1}
                    max={365}
                    value={heartbeatDays}
                    onChange={(e) => setHeartbeatDays(Number(e.target.value))}
                    className="w-full h-3 bg-secondary neo-border rounded-full appearance-none cursor-pointer accent-accent-pink"
                  />
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Days</span>
                    <span className="text-5xl font-black">{heartbeatDays}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[30, 60, 90, 180, 365].map((d) => (
                      <button
                        key={d}
                        onClick={() => setHeartbeatDays(d)}
                        className={`neo-border rounded-lg px-3 py-1 text-sm font-bold transition-all ${
                          heartbeatDays === d ? "bg-accent-pink" : "bg-secondary"
                        }`}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="neo-card-static">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-accent-yellow neo-border rounded-xl p-3">
                    <Clock className="h-6 w-6" strokeWidth={2.5} />
                  </div>
                  <h3 className="text-xl font-black">Grace Period</h3>
                </div>
                <div className="space-y-4">
                  <input
                    type="range"
                    min={1}
                    max={90}
                    value={graceDays}
                    onChange={(e) => setGraceDays(Number(e.target.value))}
                    className="w-full h-3 bg-secondary neo-border rounded-full appearance-none cursor-pointer accent-accent-yellow"
                  />
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Days</span>
                    <span className="text-5xl font-black">{graceDays}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[7, 14, 30, 60, 90].map((d) => (
                      <button
                        key={d}
                        onClick={() => setGraceDays(d)}
                        className={`neo-border rounded-lg px-3 py-1 text-sm font-bold transition-all ${
                          graceDays === d ? "bg-accent-yellow" : "bg-secondary"
                        }`}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="neo-card-static bg-accent-lime/20">
              <p className="text-base font-bold">
                ⏱️ Total deadline: <span className="text-2xl font-black">{heartbeatDays + graceDays} days</span> — if you don't check in for this long, your heirs can claim.
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Heirs */}
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <span className="neo-badge bg-accent-cyan mb-4 inline-block">Step 2</span>
              <h2 className="text-4xl md:text-5xl font-black leading-[0.9]">
                Define your{" "}
                <span className="bg-accent-cyan px-2 inline-block rotate-[1deg]">heirs.</span>
              </h2>
              <p className="text-lg font-medium text-muted-foreground mt-4 max-w-xl">
                Add up to 10 beneficiaries. Their percentage splits must total exactly 100%.
              </p>
            </div>

            <div className="space-y-4">
              {heirs.map((heir, idx) => (
                <div key={idx} className="neo-card-static flex flex-col md:flex-row gap-4 items-start md:items-center">
                  <div className="flex-1 w-full space-y-3 md:space-y-0 md:flex md:gap-4 md:items-center">
                    <div className="flex-1">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                        Label
                      </label>
                      <input
                        type="text"
                        value={heir.label}
                        onChange={(e) => updateHeir(idx, "label", e.target.value)}
                        maxLength={50}
                        className="w-full neo-border rounded-lg px-4 py-3 bg-background font-bold text-base neo-shadow-sm focus:bg-accent-cyan/20 focus:outline-none transition-colors"
                        placeholder="e.g. My Son"
                      />
                    </div>
                    <div className="flex-[2]">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                        Stacks Address
                      </label>
                      <input
                        type="text"
                        value={heir.address}
                        onChange={(e) => updateHeir(idx, "address", e.target.value)}
                        maxLength={128}
                        className="w-full neo-border rounded-lg px-4 py-3 bg-background font-medium text-sm font-mono neo-shadow-sm focus:bg-accent-cyan/20 focus:outline-none transition-colors"
                        placeholder="SP2J6ZY48GV1EZ..."
                      />
                    </div>
                    <div className="w-full md:w-28">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                        Share %
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={heir.splitBps / 100}
                        onChange={(e) => {
                          const val = Math.min(100, Math.max(0, Number(e.target.value)));
                          updateHeir(idx, "splitBps", val * 100);
                        }}
                        className="w-full neo-border rounded-lg px-4 py-3 bg-background font-black text-xl text-center neo-shadow-sm focus:bg-accent-cyan/20 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => removeHeir(idx)}
                    disabled={heirs.length <= 1}
                    className="neo-border rounded-lg p-3 bg-accent-red/20 hover:bg-accent-red transition-colors disabled:opacity-30"
                  >
                    <Trash2 className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <Button variant="outline" onClick={addHeir} disabled={heirs.length >= 10}>
                <Plus className="h-5 w-5" /> Add Heir
              </Button>
              <div
                className={`neo-badge ${
                  totalBps === 10000 ? "bg-accent-lime" : totalBps > 10000 ? "bg-accent-red" : "bg-accent-yellow"
                }`}
              >
                Total: {(totalBps / 100).toFixed(0)}% {totalBps === 10000 ? "✓" : totalBps > 10000 ? "⚠ Over!" : "— must be 100%"}
              </div>
            </div>

            {/* Optional guardian */}
            <div className="neo-card-static">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-accent-purple neo-border rounded-xl p-3">
                  <Shield className="h-6 w-6" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-xl font-black">Guardian (Optional)</h3>
                  <p className="text-sm font-medium text-muted-foreground">
                    A trusted address that can pause the vault during grace period
                  </p>
                </div>
              </div>
              <input
                type="text"
                value={guardian}
                onChange={(e) => setGuardian(e.target.value)}
                maxLength={128}
                className="w-full neo-border rounded-lg px-4 py-3 bg-background font-medium text-sm font-mono neo-shadow-sm focus:bg-accent-purple/20 focus:outline-none transition-colors"
                placeholder="SP... (leave empty for no guardian)"
              />
            </div>
          </div>
        )}

        {/* Step 2: Deposit */}
        {step === 2 && (
          <div className="space-y-8">
            <div>
              <span className="neo-badge bg-accent-orange mb-4 inline-block">Step 3</span>
              <h2 className="text-4xl md:text-5xl font-black leading-[0.9]">
                Fund your{" "}
                <span className="bg-accent-orange px-2 inline-block rotate-[-1deg]">vault.</span>
              </h2>
              <p className="text-lg font-medium text-muted-foreground mt-4 max-w-xl">
                Deposit sBTC and/or USDCx. You can always add more or withdraw later.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="neo-card-static">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-accent-orange neo-border rounded-xl p-3">
                    <Bitcoin className="h-6 w-6" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">sBTC</h3>
                    <p className="text-sm font-bold text-muted-foreground">
                      Balance: {sbtcBalance.toFixed(4)} sBTC
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <input
                    type="number"
                    min={0}
                    max={sbtcBalance}
                    step={0.0001}
                    value={sbtcDeposit}
                    onChange={(e) => setSbtcDeposit(Math.min(sbtcBalance, Math.max(0, Number(e.target.value))))}
                    className="w-full neo-border rounded-lg px-4 py-4 bg-background font-black text-3xl text-center neo-shadow-sm focus:bg-accent-orange/20 focus:outline-none transition-colors"
                  />
                  <div className="flex gap-2 flex-wrap">
                    {[0.01, 0.05, 0.1, 0.5].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setSbtcDeposit(Math.min(sbtcBalance, amt))}
                        className={`neo-border rounded-lg px-3 py-1 text-sm font-bold transition-all ${
                          sbtcDeposit === amt ? "bg-accent-orange" : "bg-secondary"
                        }`}
                      >
                        {amt} sBTC
                      </button>
                    ))}
                    <button
                      onClick={() => setSbtcDeposit(sbtcBalance)}
                      className="neo-border rounded-lg px-3 py-1 text-sm font-bold bg-accent-lime"
                    >
                      MAX
                    </button>
                  </div>
                </div>
              </div>

              <div className="neo-card-static">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-accent-cyan neo-border rounded-xl p-3">
                    <DollarSign className="h-6 w-6" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">USDCx</h3>
                    <p className="text-sm font-bold text-muted-foreground">
                      Balance: {usdcxBalance.toLocaleString()} USDCx
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <input
                    type="number"
                    min={0}
                    max={usdcxBalance}
                    step={1}
                    value={usdcxDeposit}
                    onChange={(e) => setUsdcxDeposit(Math.min(usdcxBalance, Math.max(0, Number(e.target.value))))}
                    className="w-full neo-border rounded-lg px-4 py-4 bg-background font-black text-3xl text-center neo-shadow-sm focus:bg-accent-cyan/20 focus:outline-none transition-colors"
                  />
                  <div className="flex gap-2 flex-wrap">
                    {[100, 500, 1000, 5000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setUsdcxDeposit(Math.min(usdcxBalance, amt))}
                        className={`neo-border rounded-lg px-3 py-1 text-sm font-bold transition-all ${
                          usdcxDeposit === amt ? "bg-accent-cyan" : "bg-secondary"
                        }`}
                      >
                        ${amt}
                      </button>
                    ))}
                    <button
                      onClick={() => setUsdcxDeposit(usdcxBalance)}
                      className="neo-border rounded-lg px-3 py-1 text-sm font-bold bg-accent-lime"
                    >
                      MAX
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-8">
            <div>
              <span className="neo-badge bg-accent-lime mb-4 inline-block">Step 4</span>
              <h2 className="text-4xl md:text-5xl font-black leading-[0.9]">
                Review &{" "}
                <span className="bg-accent-lime px-2 inline-block rotate-[1deg]">confirm.</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="neo-card-static">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Heartbeat</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-bold">Interval</span>
                    <span className="font-black text-xl">{heartbeatDays} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Grace Period</span>
                    <span className="font-black text-xl">{graceDays} days</span>
                  </div>
                  <div className="flex justify-between border-t-4 border-foreground pt-2 mt-2">
                    <span className="font-bold">Total Deadline</span>
                    <span className="font-black text-xl">{heartbeatDays + graceDays} days</span>
                  </div>
                </div>
              </div>

              <div className="neo-card-static">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Deposits</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-bold">sBTC</span>
                    <span className="font-black text-xl">{sbtcDeposit.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">USDCx</span>
                    <span className="font-black text-xl">${usdcxDeposit.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="neo-card-static">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
                Heirs ({heirs.length})
              </h3>
              <div className="space-y-3">
                {heirs.map((h, i) => (
                  <div key={i} className="flex items-center justify-between neo-border rounded-lg p-4 bg-secondary">
                    <div>
                      <p className="font-black text-lg">{h.label}</p>
                      <p className="text-xs font-mono text-muted-foreground">
                        {h.address.slice(0, 10)}...{h.address.slice(-6)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-2xl">{(h.splitBps / 100).toFixed(0)}%</p>
                      <p className="text-xs font-bold text-muted-foreground">
                        {(sbtcDeposit * h.splitBps / 10000).toFixed(4)} sBTC + ${(usdcxDeposit * h.splitBps / 10000).toFixed(0)} USDCx
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {guardian && (
              <div className="neo-card-static bg-accent-purple/10">
                <p className="font-bold">
                  🛡️ Guardian: <span className="font-mono text-sm">{guardian}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center mt-12 pt-8 border-t-4 border-foreground">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setStep(step - 1)}
            disabled={step === 0}
          >
            <ArrowLeft className="h-5 w-5" /> Back
          </Button>

          {step < 3 ? (
            <Button
              variant="lime"
              size="lg"
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
            >
              Next <ArrowRight className="h-5 w-5" />
            </Button>
          ) : (
            <Button variant="lime" size="xl" onClick={handleSubmit}>
              🔒 Create Vault
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateVaultPage;
