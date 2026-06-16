import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { SearchPalette } from "./SearchPalette";

function isTextInputFocused(): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  return active.tagName === "INPUT" || active.tagName === "TEXTAREA";
}

export function SearchHotkey() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (location.pathname === "/login") return;

      const isSlash = event.key === "/";
      const isCommandK =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!isSlash && !isCommandK) return;
      if (isSlash && isTextInputFocused()) return;

      event.preventDefault();
      setOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [location.pathname]);

  return <SearchPalette open={open} onClose={() => setOpen(false)} />;
}
