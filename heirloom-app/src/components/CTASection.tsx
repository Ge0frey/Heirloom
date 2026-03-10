import { Button } from "@/components/ui/button";

const CTASection = () => {
  return (
    <section className="neo-section-yellow py-16 px-6 md:py-24 lg:py-32 border-y-8 border-foreground">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-4xl md:text-6xl lg:text-7xl font-black leading-[0.9] mb-8">
          Don't let your Bitcoin{" "}
          <span className="bg-accent-red text-background px-3 inline-block rotate-[-2deg]">
            die
          </span>{" "}
          with you.
        </h2>
        <p className="text-xl md:text-2xl font-medium mb-10 max-w-2xl mx-auto">
          Set up your inheritance vault in minutes. 
          Your heirs will thank you — even if they never have to use it.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button variant="default" size="xl">
            Create Your Vault
          </Button>
          <Button variant="outline" size="xl">
            View Demo
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CTASection;