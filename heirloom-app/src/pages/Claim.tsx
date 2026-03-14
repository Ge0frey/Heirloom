import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { explorerTxUrl } from "@/config/constants";
import {
  claimInheritance,
  findVaultsForHeir,
  lookupSingleVault,
  InheritanceInfo,
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
  Gift,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const ClaimPage = () => {
  const { stxAddress, isConnected } = useWallet();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Auto-discovery state
  const [searching, setSearching] = useState(false);
  const [inheritances, setInheritances] = useState<InheritanceInfo[]>([]);
  const [searchDone, setSearchDone] = useState(false);

  // Claim state
  const [claimingOwner, setClaimingOwner] = useState<string | null>(null);
  const [claimTxIds, setClaimTxIds] = useState<Record<string, string>>({});

  // Manual lookup state
  const [showManual, setShowManual] = useState(false);
  const [manualAddress, setManualAddress] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Auto-search for inheritances on wallet connect
  useEffect(() => {
    if (!stxAddress || !isConnected) return;

    const search = async () => {
      setSearching(true);
      try {
        const results = await findVaultsForHeir(stxAddress);

        // Also check ?owner= param if present
        const ownerParam = searchParams.get("owner");
        if (ownerParam && !results.some((r) => r.ownerAddress === ownerParam)) {
          const additional = await lookupSingleVault(ownerParam, stxAddress);
          if (additional) results.push(additional);
        }

        setInheritances(results);
      } catch {
        // Silently fail - user can use manual lookup
      } finally {
        setSearching(false);
        setSearchDone(true);
      }
    };

    search();
  }, [stxAddress, isConnected]);

  // Manual lookup handler
  const handleManualLookup = async () => {
    if (!manualAddress.trim() || !stxAddress) return;
    setManualLoading(true);
    setManualError(null);

    const result = await lookupSingleVault(manualAddress.trim(), stxAddress);
    if (result) {
      setInheritances((prev) => {
        const exists = prev.some((i) => i.ownerAddress === result.ownerAddress);
        return exists
          ? prev.map((i) =>
              i.ownerAddress === result.ownerAddress ? result : i
            )
          : [...prev, result];
      });
      setShowManual(false);
      setManualAddress("");
    } else {
      setManualError(
        "Vault not found or you are not a registered heir for this vault."
      );
    }

    setManualLoading(false);
  };

  // Handle claim
  const handleClaim = async (ownerAddress: string) => {
    setClaimingOwner(ownerAddress);
    try {
      const result = await claimInheritance(ownerAddress);
      const txId = result?.txid || result?.txId || "";
      setClaimTxIds((prev) => ({ ...prev, [ownerAddress]: txId }));
      toast({
        title: "Claim Submitted!",
        description: "Your share is being transferred to your wallet.",
      });
    } catch (err: any) {
      toast({
        title: "Claim Failed",
        description: err?.message || "Transaction rejected",
        variant: "destructive",
      });
    } finally {
      setClaimingOwner(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b-8 border-foreground bg-background sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between h-20">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-lg font-black hover:underline"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={3} />
            Back
          </button>
          <span className="text-2xl font-black">Claim Inheritance</span>
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {stxAddress
              ? `${stxAddress.slice(0, 6)}...${stxAddress.slice(-4)}`
              : "Not connected"}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        {/* Not connected */}
        {!isConnected && (
          <div className="neo-card-static text-center">
            <AlertTriangle
              className="h-12 w-12 mx-auto mb-4"
              strokeWidth={2.5}
            />
            <h2 className="text-2xl font-black mb-3">Wallet Not Connected</h2>
            <p className="text-muted-foreground font-medium">
              Connect your wallet to check for available inheritances.
            </p>
          </div>
        )}

        {isConnected && (
          <>
            {/* Intro */}
            <div>
              <span className="neo-badge bg-accent-orange mb-4 inline-block">
                Heir Portal
              </span>
              <h2 className="text-4xl md:text-5xl font-black leading-[0.9]">
                Your inheritance{" "}
                <span className="bg-accent-orange px-2 inline-block rotate-[-1deg]">
                  is waiting.
                </span>
              </h2>
              <p className="text-lg font-medium text-muted-foreground mt-4 max-w-xl">
                We automatically search for any vaults where you are named as an
                heir.
              </p>
            </div>

            {/* Searching state */}
            {searching && (
              <div className="neo-card-static text-center">
                <Loader2
                  className="h-10 w-10 mx-auto mb-4 animate-spin"
                  strokeWidth={2.5}
                />
                <h3 className="text-xl font-black mb-2">
                  Searching for inheritances...
                </h3>
                <p className="text-muted-foreground font-medium">
                  Scanning vaults on the blockchain
                </p>
              </div>
            )}

            {/* No results */}
            {searchDone && !searching && inheritances.length === 0 && (
              <div className="neo-card-static text-center">
                <Gift
                  className="h-12 w-12 mx-auto mb-4 text-muted-foreground"
                  strokeWidth={2.5}
                />
                <h3 className="text-xl font-black mb-2">
                  No Inheritances Found
                </h3>
                <p className="text-muted-foreground font-medium mb-4">
                  No vaults currently list your wallet as an heir.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setShowManual(true)}
                >
                  Look up by vault owner address
                </Button>
              </div>
            )}

            {/* Inheritance cards */}
            {inheritances.length > 0 && (
              <div className="space-y-6">
                {inheritances.map((inh) => {
                  const txId = claimTxIds[inh.ownerAddress];
                  const isClaiming = claimingOwner === inh.ownerAddress;
                  const canClaim =
                    inh.vaultState === "claimable" && !inh.hasClaimed;

                  return (
                    <div
                      key={inh.ownerAddress}
                      className="neo-card-static space-y-6"
                    >
                      {/* Vault header */}
                      <div
                        className={`neo-border-thick rounded-2xl p-6 ${
                          inh.vaultState === "claimable"
                            ? "bg-accent-red/20"
                            : inh.vaultState === "active"
                            ? "bg-accent-lime/20"
                            : inh.vaultState === "grace"
                            ? "bg-accent-yellow/20"
                            : "bg-secondary"
                        }`}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div>
                            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                              Vault from
                            </p>
                            <p className="font-mono text-sm font-bold mt-1">
                              {inh.ownerAddress.slice(0, 12)}...
                              {inh.ownerAddress.slice(-6)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                              Status
                            </p>
                            <p className="text-2xl font-black uppercase">
                              {inh.vaultState}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Allocation */}
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
                          {inh.vaultState === "claimable" && !inh.hasClaimed
                            ? "You have an inheritance available"
                            : "Your Allocation"}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          <div>
                            <p className="text-sm font-bold text-muted-foreground">
                              Share
                            </p>
                            <p className="text-4xl font-black">
                              {(inh.splitBps / 100).toFixed(0)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-muted-foreground">
                              sBTC Amount
                            </p>
                            <div className="flex items-center gap-2">
                              <Bitcoin className="h-6 w-6" />
                              <p className="text-4xl font-black">
                                {(inh.sbtcShare / 1e8).toFixed(8)}
                              </p>
                            </div>
                          </div>
                          {inh.usdcxShare > 0 && (
                            <div>
                              <p className="text-sm font-bold text-muted-foreground">
                                USDCx Amount
                              </p>
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-6 w-6" />
                                <p className="text-4xl font-black">
                                  ${(inh.usdcxShare / 1e6).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-bold text-muted-foreground">
                              Status
                            </p>
                            <p className="text-4xl font-black">
                              {inh.hasClaimed ? (
                                <span className="text-accent-lime">
                                  Claimed
                                </span>
                              ) : (
                                <span className="text-foreground">Pending</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Claim button / tx link */}
                      <div className="pt-4 border-t-4 border-foreground">
                        {txId ? (
                          <div className="text-center">
                            <CheckCircle
                              className="h-8 w-8 mx-auto mb-2 text-accent-lime"
                              strokeWidth={2.5}
                            />
                            <p className="font-black mb-2">Claim Submitted!</p>
                            <a
                              href={explorerTxUrl(txId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 neo-badge bg-background hover:bg-secondary transition-colors"
                            >
                              View on Explorer{" "}
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        ) : (
                          <Button
                            variant="lime"
                            size="xl"
                            className="w-full"
                            onClick={() => handleClaim(inh.ownerAddress)}
                            disabled={!canClaim || isClaiming}
                          >
                            {isClaiming ? (
                              <>
                                <Loader2 className="h-5 w-5 animate-spin" />{" "}
                                Claiming...
                              </>
                            ) : inh.hasClaimed ? (
                              <>
                                <CheckCircle className="h-5 w-5" /> Already
                                Claimed
                              </>
                            ) : inh.vaultState !== "claimable" ? (
                              <>
                                Vault Not Yet Claimable ({inh.vaultState})
                              </>
                            ) : (
                              <>Claim Inheritance</>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Manual lookup (collapsible) */}
            {searchDone && (
              <div className="neo-card-static">
                <button
                  onClick={() => setShowManual(!showManual)}
                  className="flex items-center justify-between w-full"
                >
                  <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                    {inheritances.length > 0
                      ? "Look up another vault"
                      : "Manual vault lookup"}
                  </span>
                  {showManual ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>
                {showManual && (
                  <div className="mt-4 space-y-3">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={manualAddress}
                        onChange={(e) => setManualAddress(e.target.value)}
                        maxLength={128}
                        className="flex-1 neo-border rounded-lg px-4 py-3 bg-background font-medium text-sm font-mono neo-shadow-sm focus:bg-accent-orange/20 focus:outline-none transition-colors"
                        placeholder="Enter vault owner address (SP... or ST...)"
                      />
                      <Button
                        variant="orange"
                        onClick={handleManualLookup}
                        disabled={manualLoading || !manualAddress.trim()}
                      >
                        {manualLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            <Search className="h-5 w-5" /> Lookup
                          </>
                        )}
                      </Button>
                    </div>
                    {manualError && (
                      <div className="flex items-center gap-2 text-sm font-bold text-accent-red">
                        <AlertTriangle className="h-4 w-4" />
                        {manualError}
                      </div>
                    )}
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
