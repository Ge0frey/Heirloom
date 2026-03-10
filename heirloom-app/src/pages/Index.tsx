import NavBar from "@/components/NavBar";
import HeroSection from "@/components/HeroSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import VaultLifecycleSection from "@/components/VaultLifecycleSection";
import WhyStacksSection from "@/components/WhyStacksSection";
import ComparisonSection from "@/components/ComparisonSection";
import CTASection from "@/components/CTASection";
import FooterSection from "@/components/FooterSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <HeroSection />
      <div id="how-it-works">
        <HowItWorksSection />
      </div>
      <div id="vault-lifecycle">
        <VaultLifecycleSection />
      </div>
      <div id="why-stacks">
        <WhyStacksSection />
      </div>
      <div id="compare">
        <ComparisonSection />
      </div>
      <CTASection />
      <FooterSection />
    </div>
  );
};

export default Index;
