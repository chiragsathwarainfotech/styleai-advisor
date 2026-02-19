import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen gradient-hero flex flex-col items-center justify-center px-6">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-20 right-10 w-40 h-40 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-24 h-24 rounded-full bg-primary/5 blur-2xl" />
      </div>

      <div className="relative z-10 text-center max-w-2xl mx-auto">
        {/* Logo/Icon */}
        <div 
          className="inline-flex items-center justify-center w-20 h-20 rounded-full gradient-primary shadow-glow mb-8 animate-scale-in"
        >
          <Sparkles className="w-10 h-10 text-primary-foreground" />
        </div>

        {/* Main heading */}
        <h1 
          className="font-display text-5xl md:text-7xl font-semibold text-foreground mb-6 animate-slide-up"
          style={{ animationDelay: "0.1s" }}
        >
          Styloren
        </h1>

        {/* Tagline */}
        <p 
          className="font-body text-lg md:text-xl text-muted-foreground mb-12 leading-relaxed animate-slide-up"
          style={{ animationDelay: "0.2s" }}
        >
          Your personal AI fashion advisor
        </p>

        {/* CTA Button */}
        <div 
          className="animate-slide-up"
          style={{ animationDelay: "0.3s" }}
        >
          <Button
            onClick={() => navigate("/auth")}
            size="lg"
            className="font-body text-lg px-10 py-6 gradient-primary border-0 shadow-elevated hover:shadow-glow transition-all duration-300 hover:scale-105"
          >
            Get Started
          </Button>
        </div>

        {/* Subtle tagline */}
        <p 
          className="mt-8 text-sm text-muted-foreground/70 animate-fade-in"
          style={{ animationDelay: "0.5s" }}
        >
          Elevate your style with AI-powered insights
        </p>
      </div>
    </div>
  );
};

export default Index;
