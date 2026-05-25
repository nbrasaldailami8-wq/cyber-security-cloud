"use client";

export default function AnimationsProvider({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-fade-in">
      {children}
    </div>
  );
}
