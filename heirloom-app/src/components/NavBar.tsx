import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useNavigate } from "react-router-dom";
import WalletConnectDialog from "@/components/WalletConnectDialog";

const NavBar = () => {
  const [open, setOpen] = useState(false);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const { isConnected, address, disconnect } = useWallet();
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
            ⚡ Heirloom
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
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
                <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
                  Dashboard
                </Button>
                <Button variant="ghost" size="sm" onClick={disconnect}>
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
            className="md:hidden neo-border rounded-lg p-2"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {open && (
          <div className="md:hidden border-t-4 border-foreground bg-accent-lime p-6 space-y-4">
            {["How It Works", "Vault Lifecycle", "Why Stacks", "Compare"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s/g, "-")}`}
                className="block text-xl font-black uppercase neo-border rounded-lg p-4 bg-background text-center"
                onClick={() => setOpen(false)}
              >
                {item}
              </a>
            ))}
            <Button
              variant="default"
              size="lg"
              className="w-full"
              onClick={() => {
                setOpen(false);
                handleLaunch();
              }}
            >
              {isConnected ? "Dashboard" : "Launch App"}
            </Button>
          </div>
        )}
      </nav>

      <WalletConnectDialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen} />
    </>
  );
};

export default NavBar;
