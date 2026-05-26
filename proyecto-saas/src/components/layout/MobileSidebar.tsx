"use client";

import { useUiStore } from "@/store/ui.store";
import { Sidebar } from "./Sidebar";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

interface MobileSidebarProps {
  pendingApprovals: number;
}

export function MobileSidebar({ pendingApprovals }: MobileSidebarProps) {
  const { mobileMenuOpen, setMobileMenuOpen } = useUiStore();
  const pathname = usePathname();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname, setMobileMenuOpen]);

  if (!mobileMenuOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden flex">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={() => setMobileMenuOpen(false)}
      />
      
      {/* Drawer */}
      <div className="relative flex w-4/5 max-w-sm flex-col bg-background shadow-xl animate-in slide-in-from-left duration-200">
        <Sidebar pendingApprovals={pendingApprovals} isMobile={true} />
      </div>
    </div>
  );
}
