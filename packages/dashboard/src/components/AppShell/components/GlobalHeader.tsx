"use client";

import Controls from "@/components/Controls";
import { GlobalSearch } from "@/components/GlobalSearch";

const GlobalHeader = () => {
  return (
    <div className="global-header">
      <Controls />
      <GlobalSearch />
    </div>
  );
};

export default GlobalHeader;
