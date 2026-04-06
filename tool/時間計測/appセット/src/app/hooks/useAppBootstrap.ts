import { useEffect } from "react";
import { useAppStore } from "../store/appStore";

export function useAppBootstrap() {
  const hydrate = useAppStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);
}
