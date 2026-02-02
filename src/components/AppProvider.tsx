


import { Toaster } from "@/components/ui/sonner";
import React, { useEffect } from "react";
import { useTheme } from "@/hooks/use-theme";

interface Props {
  children: React.ReactNode;
}

/**
 * A provider wrapping the whole app.
 *
 * You can add multiple providers here by nesting them,
 * and they will all be applied to the app.
 *
 * Note: ThemeProvider is already included in AppWrapper.tsx and does not need to be added here.
 */
export const AppProvider = ({ children }: Props) => {
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme("system");
  }, [setTheme]);

  // Add Plausible Analytics script
  useEffect(() => {
    const script = document.createElement("script");
    script.defer = true;
    script.setAttribute("data-domain", "betamobility.com");
    script.src =
      "https://plausible.io/js/script.hash.outbound-links.pageview-props.tagged-events.js";
    document.head.appendChild(script);

    // Optional: Add a cleanup function to remove the script when the component unmounts
    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return (
    <>
      {children}
      {/* Global toaster for notifications */}
      <Toaster />
    </>
  );
};
