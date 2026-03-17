import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { Menu, X, ChevronDown, LayoutDashboard, Gift, LogOut } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useNavigate } from "react-router-dom";
import WalletConnectDialog from "@/components/WalletConnectDialog";
import { useTokenBalances } from "@/hooks/useTokenBalances";

const NavBar = () => {
  const [open, setOpen] = useState(false);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { isConnected, stxAddress, disconnectWallet } = useWallet();
  const navigate = useNavigate();
  const { sbtc, usdcx, loading: balancesLoading } = useTokenBalances(isConnected ? stxAddress : null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLaunch = () => {
    if (isConnected) {
      navigate("/create-vault");
    } else {
      setWalletDialogOpen(true);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  return (
    <>
      <nav className="border-b-8 border-foreground bg-background sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-20">
          <a href="/" className="text-2xl md:text-3xl font-black tracking-tight">
            Heirloom
          </a>

          <div className="hidden md:flex items-center gap-6">
            {isConnected ? (
              <>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="flex items-center gap-2 text-sm font-black uppercase tracking-wide hover:bg-secondary rounded-lg px-4 py-2 transition-colors"
                >
                  <LayoutDashboard className="h-5 w-5" />
                  Dashboard
                </button>
                <button
                  onClick={() => navigate("/claim")}
                  className="flex items-center gap-2 text-sm font-black uppercase tracking-wide hover:bg-secondary rounded-lg px-4 py-2 transition-colors"
                >
                  <Gift className="h-5 w-5" />
                  Claim Inheritance
                </button>
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 border-3 border-foreground rounded-lg px-3 py-2 bg-accent-lime font-bold text-sm transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] shadow-[2px_2px_0px_0px_hsl(var(--foreground))] hover:shadow-[4px_4px_0px_0px_hsl(var(--foreground))] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-green-600 animate-pulse" />
                    {stxAddress?.slice(0, 6)}...{stxAddress?.slice(-4)}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-72 border-4 border-foreground rounded-xl bg-background p-4 space-y-3 shadow-[6px_6px_0px_0px_hsl(var(--foreground))] z-50">
                      {/* Token Balances */}
                      <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          Wallet Balances
                        </p>
                        <div className="flex items-center justify-between border-2 border-foreground rounded-lg px-3 py-2 bg-accent-yellow/20">
                          <span className="text-sm font-bold">sBTC</span>
                          <span className="text-sm font-black tabular-nums">
                            {balancesLoading ? "..." : sbtc.toFixed(8)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-2 border-foreground rounded-lg px-3 py-2 bg-accent-cyan/20">
                          <span className="text-sm font-bold">USDCx</span>
                          <span className="text-sm font-black tabular-nums">
                            {balancesLoading ? "..." : usdcx.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="border-t-2 border-foreground" />

                      <button
                        onClick={() => { setDropdownOpen(false); disconnectWallet(); }}
                        className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors text-left"
                      >
                        <LogOut className="h-4 w-4" />
                        Disconnect
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Button variant="lime" size="sm" onClick={handleLaunch}>
                Launch App
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden neo-border rounded-lg p-2 transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px]"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        <div
          className={`md:hidden border-t-4 border-foreground bg-accent-lime overflow-hidden transition-all duration-300 ease-out ${
            open ? "max-h-[700px] opacity-100" : "max-h-0 opacity-0 border-t-0"
          }`}
        >
          <div className="p-6 space-y-4">
            {isConnected ? (
              <>
                {/* Mobile wallet balances */}
                <div className="neo-border rounded-lg p-4 bg-background space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-center">
                    {stxAddress?.slice(0, 6)}...{stxAddress?.slice(-4)}
                  </p>
                  <div className="flex gap-3">
                    <div className="flex-1 neo-border rounded-lg px-3 py-2 bg-accent-yellow/20 text-center">
                      <p className="text-xs font-bold text-muted-foreground">sBTC</p>
                      <p className="text-sm font-black">{balancesLoading ? "..." : sbtc.toFixed(8)}</p>
                    </div>
                    <div className="flex-1 neo-border rounded-lg px-3 py-2 bg-accent-cyan/20 text-center">
                      <p className="text-xs font-bold text-muted-foreground">USDCx</p>
                      <p className="text-sm font-black">{balancesLoading ? "..." : usdcx.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                <Button
                  variant="default"
                  size="lg"
                  className="w-full"
                  onClick={() => { setOpen(false); navigate("/dashboard"); }}
                >
                  Dashboard
                </Button>
                <Button
                  variant="orange"
                  size="lg"
                  className="w-full"
                  onClick={() => { setOpen(false); navigate("/claim"); }}
                >
                  Claim Inheritance
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  className="w-full"
                  onClick={() => { setOpen(false); disconnectWallet(); }}
                >
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                variant="default"
                size="lg"
                className="w-full"
                onClick={() => { setOpen(false); handleLaunch(); }}
              >
                Launch App
              </Button>
            )}
          </div>
        </div>
      </nav>

      <WalletConnectDialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen} />
    </>
  );
};

export default NavBar;
