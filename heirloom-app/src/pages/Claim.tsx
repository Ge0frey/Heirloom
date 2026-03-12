import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { explorerTxUrl } from "@/config/constants";
import {
  getVaultStatus,
  getHeirInfo,
  claimInheritance,
} from "@/lib/contracts";
import {
  ArrowLeft,
  Search,
  Loader2,
  CheckCircle,
  ExternalLink,
  AlertTriangle,
  Bitcoin,
  DollarSign,
} from "lucide-react";

interface VaultInfo {
  state: string;
  sbtcBalance: number;
  usdcxBalance: number;
}

interface HeirClaimInfo {
  splitBps: number;
  hasClaimed: boolean;
  sbtcShare: number;
  usdcxShare: number;
}

const ClaimPage = () => {
  const { stxAddress, isConnected } = useWallet();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [ownerAddress, setOwnerAddress] = useState(searchParams.get("owner") || "");
  const [vaultInfo, setVaultInfo] = useState<VaultInfo | null>(null);
  const [heirInfo, setHeirInfo] = useState<HeirClaimInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimTxId, setClaimTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookupVault = async () => {
    if (!ownerAddress.trim() || !stxAddress) return;
    setLoading(true);
    setError(null);
    setVaultInfo(null);
    setHeirInfo(null);

    try {
      const statusJson = await getVaultStatus(ownerAddress.trim());
      const v = statusJson?.value;
      if (!v) {
        setError("Vault not found for this address.");
        return;
      }

      const vault: VaultInfo = {
        state: v.state?.value || "unknown",
        sbtcBalance: parseInt(v["sbtc-balance"]?.value || "0"),
        usdcxBalance: parseInt(v["usdcx-balance"]?.value || "0"),
      };
      setVaultInfo(vault);

      // Look up heir info for connected wallet
      try {
        const info = await getHeirInfo(ownerAddress.trim(), stxAddress);
        const splitBps = parseInt(info?.value?.["split-bps"]?.value || "0");
        const hasClaimed = info?.value?.["has-claimed"]?.value === true;
        const sbtcShare = Math.floor((vault.sbtcBalance * splitBps) / 10000);
        const usdcxShare = Math.floor((vault.usdcxBalance * splitBps) / 10000);

        setHeirInfo({ splitBps, hasClaimed, sbtcShare, usdcxShare });
      } catch {
        setHeirInfo(null);
        setError("Your connected wallet is not a registered heir for this vault.");
      }
    } catch (err: any) {
      setError("Vault not found. Check the owner address and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-lookup if owner param is provided
  useEffect(() => {
    if (ownerAddress && stxAddress) {
      lookupVault();
    }
  }, [stxAddress]);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const result = await claimInheritance(ownerAddress.trim());
      const txId = result?.txid || result?.txId || "";
      setClaimTxId(txId);
      toast({ title: "Claim Submitted!", description: "Your share is being transferred." });
    } catch (err: any) {
      toast({ title: "Claim Failed", description: err?.message || "Transaction rejected", variant: "destructive" });
    } finally {
      setClaiming(false);
    }
  };

  const canClaim = vaultInfo?.state === "claimable" && heirInfo && !heirInfo.hasClaimed && isConnected;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b-8 border-foreground bg-background sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between h-20">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-lg font-black hover:underline">
            <ArrowLeft className="h-5 w-5" strokeWidth={3} />
            Back
          </button>
          <span className="text-2xl font-black">Claim Inheritance</span>
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {stxAddress ? `${stxAddress.slice(0, 6)}...${stxAddress.slice(-4)}` : "Not connected"}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        {/* Success state */}
        {claimTxId && (
          <div className="neo-card-static text-center bg-accent-lime/20">
            <CheckCircle className="h-12 w-12 mx-auto mb-4" strokeWidth={2.5} />
            <h2 className="text-3xl font-black mb-3">Claim Submitted!</h2>
            <p className="text-lg font-medium text-muted-foreground mb-4">
              Your share is being transferred to your wallet.
            </p>
            <a
              href={explorerTxUrl(claimTxId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 neo-badge bg-background hover:bg-secondary transition-colors"
            >
              View on Explorer <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        )}

        {!claimTxId && (
          <>
            {/* Intro */}
            <div>
              <span className="neo-badge bg-accent-orange mb-4 inline-block">Heir Portal</span>
              <h2 className="text-4xl md:text-5xl font-black leading-[0.9]">
                Claim your{" "}
                <span className="bg-accent-orange px-2 inline-block rotate-[-1deg]">inheritance.</span>
              </h2>
              <p className="text-lg font-medium text-muted-foreground mt-4 max-w-xl">
                Enter the vault owner's Stacks address to look up your allocation and claim your share.
              </p>
            </div>

            {/* Lookup */}
            <div className="neo-card-static">
              <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground block mb-3">
                Vault Owner Address
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={ownerAddress}
                  onChange={(e) => setOwnerAddress(e.target.value)}
                  maxLength={128}
                  className="flex-1 neo-border rounded-lg px-4 py-3 bg-background font-medium text-sm font-mono neo-shadow-sm focus:bg-accent-orange/20 focus:outline-none transition-colors"
                  placeholder="SP... or ST..."
                />
                <Button
                  variant="orange"
                  onClick={lookupVault}
                  disabled={loading || !ownerAddress.trim() || !isConnected}
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <><Search className="h-5 w-5" /> Lookup</>
                  )}
                </Button>
              </div>
              {!isConnected && (
                <p className="text-sm font-bold text-accent-red mt-2">Connect your wallet first to look up your heir status.</p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="neo-card-static bg-accent-red/10 border-accent-red">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 shrink-0" strokeWidth={2.5} />
                  <p className="font-bold">{error}</p>
                </div>
              </div>
            )}

            {/* Vault info */}
            {vaultInfo && (
              <div className="space-y-6">
                <div className={`neo-border-thick rounded-2xl p-6 neo-shadow-lg ${
                  vaultInfo.state === "claimable" ? "bg-accent-red/20" :
                  vaultInfo.state === "active" ? "bg-accent-lime/20" :
                  vaultInfo.state === "grace" ? "bg-accent-yellow/20" :
                  "bg-secondary"
                }`}>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Vault Status</p>
                      <p className="text-3xl font-black uppercase">{vaultInfo.state}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">sBTC Balance</p>
                      <p className="text-3xl font-black">{(vaultInfo.sbtcBalance / 1e8).toFixed(8)}</p>
                    </div>
                    {vaultInfo.usdcxBalance > 0 && (
                      <div className="text-right">
                        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">USDCx Balance</p>
                        <p className="text-3xl font-black">${(vaultInfo.usdcxBalance / 1e6).toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Heir allocation */}
                {heirInfo && (
                  <div className="neo-card-static">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Your Allocation</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div>
                        <p className="text-sm font-bold text-muted-foreground">Share</p>
                        <p className="text-4xl font-black">{(heirInfo.splitBps / 100).toFixed(0)}%</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-muted-foreground">sBTC Amount</p>
                        <div className="flex items-center gap-2">
                          <Bitcoin className="h-6 w-6" />
                          <p className="text-4xl font-black">{(heirInfo.sbtcShare / 1e8).toFixed(8)}</p>
                        </div>
                      </div>
                      {heirInfo.usdcxShare > 0 && (
                        <div>
                          <p className="text-sm font-bold text-muted-foreground">USDCx Amount</p>
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-6 w-6" />
                            <p className="text-4xl font-black">${(heirInfo.usdcxShare / 1e6).toFixed(2)}</p>
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-muted-foreground">Status</p>
                        <p className="text-4xl font-black">
                          {heirInfo.hasClaimed ? (
                            <span className="text-accent-lime">Claimed</span>
                          ) : (
                            <span className="text-foreground">Pending</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t-4 border-foreground">
                      <Button
                        variant="lime"
                        size="xl"
                        className="w-full"
                        onClick={handleClaim}
                        disabled={!canClaim || claiming}
                      >
                        {claiming ? (
                          <><Loader2 className="h-5 w-5 animate-spin" /> Claiming...</>
                        ) : heirInfo.hasClaimed ? (
                          <><CheckCircle className="h-5 w-5" /> Already Claimed</>
                        ) : vaultInfo.state !== "claimable" ? (
                          <>Vault Not Yet Claimable</>
                        ) : (
                          <>Claim Inheritance</>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ClaimPage;
