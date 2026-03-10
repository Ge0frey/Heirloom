const states = [
  { name: "CREATED", description: "Vault exists, no assets yet", color: "bg-secondary" },
  { name: "ACTIVE", description: "Heartbeat timer is running", color: "bg-accent-lime" },
  { name: "GRACE", description: "Missed heartbeat, grace countdown", color: "bg-accent-yellow" },
  { name: "CLAIMABLE", description: "Heirs can claim their share", color: "bg-accent-orange" },
  { name: "DISTRIBUTED", description: "All assets claimed, vault closed", color: "bg-accent-pink" },
];

const VaultLifecycleSection = () => {
  return (
    <section className="py-16 px-6 md:py-24 lg:py-32">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16">
          <span className="neo-badge bg-accent-orange mb-6 inline-block">Vault Lifecycle</span>
          <h2 className="text-4xl md:text-6xl font-black leading-[0.9]">
            From heartbeat to{" "}
            <span className="bg-accent-cyan px-3 inline-block rotate-[1deg]">
              inheritance.
            </span>
          </h2>
        </div>

        {/* State flow */}
        <div className="flex flex-col gap-6">
          {states.map((state, i) => (
            <div key={state.name} className="flex items-stretch gap-4 md:gap-6">
              {/* Number */}
              <div className={`${state.color} neo-border rounded-2xl w-16 h-16 md:w-20 md:h-20 flex items-center justify-center shrink-0 font-black text-2xl md:text-3xl`}>
                {i + 1}
              </div>
              
              {/* Content */}
              <div className="neo-card-static flex-1 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-xl md:text-2xl font-black">{state.name}</h3>
                  <p className="text-base font-medium text-muted-foreground">{state.description}</p>
                </div>
                <div className={`${state.color} neo-border rounded-full px-4 py-1 text-sm font-bold uppercase tracking-widest shrink-0`}>
                  State {i + 1}
                </div>
              </div>

              {/* Arrow (not on last) */}
            </div>
          ))}
        </div>

        {/* Emergency note */}
        <div className="mt-10 neo-card-static bg-accent-red/10 rotate-[-1deg]">
          <p className="text-lg font-bold">
            🚨 <span className="uppercase tracking-wide">Emergency Withdraw</span> — The owner can reclaim all assets at ANY point before distribution. Always in control.
          </p>
        </div>
      </div>
    </section>
  );
};

export default VaultLifecycleSection;