import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useNavigate } from "react-router-dom";
import WalletConnectDialog from "@/components/WalletConnectDialog";

const NavBar = () => {
  const [open, setOpen] = useState(false);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const { isConnected, stxAddress, disconnectWallet } = useWallet();
  const navigate = useNavigate();

  const handleLaunch = () => {
    if (isConnected) {
      navigate("/create-vault");
    } else {
      setWalletDialogOpen(true);
    }
  };

  return (
    <>
      <nav className="border-b-8 border-foreground bg-background sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-20">
          <a href="/" className="text-2xl md:text-3xl font-black tracking-tight">
            Heirloom
          </a>

          <div className="hidden md:flex items-center gap-8">
            {["How It Works", "Vault Lifecycle", "Why Stacks", "Compare"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s/g, "-")}`}
                className="text-sm font-bold uppercase tracking-widest hover:underline underline-offset-4"
              >
                {item}
              </a>
            ))}
            {isConnected ? (
              <div className="flex items-center gap-3">
                <span className="neo-badge bg-accent-lime text-xs">
                  {stxAddress?.slice(0, 6)}...{stxAddress?.slice(-4)}
                </span>
                <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
                  Dashboard
                </Button>
                <Button variant="orange" size="sm" onClick={() => navigate("/claim")}>
                  Claim
                </Button>
                <Button variant="ghost" size="sm" onClick={disconnectWallet}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button variant="lime" size="sm" onClick={handleLaunch}>
                Launch App
              </Button>
            )}
          </div>

          <button
            className="md:hidden neo-border rounded-lg p-2 transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px]"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        <div
          className={`md:hidden border-t-4 border-foreground bg-accent-lime overflow-hidden transition-all duration-300 ease-out ${
            open ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 border-t-0"
          }`}
        >
          <div className="p-6 space-y-4">
            {["How It Works", "Vault Lifecycle", "Why Stacks", "Compare"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s/g, "-")}`}
                className="block text-xl font-black uppercase neo-border rounded-lg p-4 bg-background text-center transition-all duration-150 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none neo-shadow-sm"
                onClick={() => setOpen(false)}
              >
                {item}
              </a>
            ))}
            {isConnected ? (
              <>
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
