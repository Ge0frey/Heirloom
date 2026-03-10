import { Shield, Clock, Bitcoin, Lock, FileCode, Layers } from "lucide-react";

const reasons = [
  {
    icon: Clock,
    title: "block-time (Clarity 4)",
    description: "Accurate on-chain timestamps for heartbeat intervals and expiry calculations.",
    badge: "NEW",
    badgeColor: "bg-accent-lime",
  },
  {
    icon: Lock,
    title: "restrict-assets?",
    description: "In-contract post-conditions ensure transfers are exactly what was specified.",
    badge: "SAFE",
    badgeColor: "bg-accent-cyan",
  },
  {
    icon: Bitcoin,
    title: "sBTC (SIP-010)",
    description: "Real Bitcoin-backed value. $545M+ TVL. Inheritance of sBTC = inheritance of Bitcoin.",
    badge: "BTC",
    badgeColor: "bg-accent-yellow",
  },
  {
    icon: Layers,
    title: "USDCx (SIP-010)",
    description: "Stable-value bequests. Not every heir wants volatile BTC.",
    badge: "STABLE",
    badgeColor: "bg-accent-pink",
  },
  {
    icon: Shield,
    title: "Bitcoin Finality",
    description: "Every claim is as irreversible as a Bitcoin transaction. Finality = certainty.",
    badge: "FINAL",
    badgeColor: "bg-accent-orange",
  },
  {
    icon: FileCode,
    title: "Clarity Safety",
    description: "Interpreted, decidable, no reentrancy. What you see is what executes.",
    badge: "AUDITABLE",
    badgeColor: "bg-accent-purple",
  },
];

const WhyStacksSection = () => {
  return (
    <section className="neo-section-cyan py-16 px-6 md:py-24 lg:py-32 border-y-8 border-foreground">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16 text-center">
          <span className="neo-badge bg-background mb-6 inline-block">Why Stacks</span>
          <h2 className="text-4xl md:text-6xl font-black leading-[0.9]">
            Built where Bitcoin{" "}
            <span className="bg-foreground text-accent-cyan px-3 inline-block rotate-[1deg]">
              lives.
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {reasons.map((r) => (
            <div key={r.title} className="neo-card relative">
              {/* Badge sticker */}
              <span className={`absolute -top-3 -right-3 neo-badge ${r.badgeColor} rotate-[6deg] text-xs`}>
                {r.badge}
              </span>
              <div className="mb-4">
                <r.icon className="h-10 w-10" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black mb-2">{r.title}</h3>
              <p className="text-base font-medium leading-relaxed">{r.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyStacksSection;
