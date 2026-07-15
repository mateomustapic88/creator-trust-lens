import type { ScanMode } from "../analysis/types";

export type ScanModeConfig = {
  id: ScanMode;
  label: string;
  description: string;
  postLimit: number;
  commentLimit: number;
};

export const SCAN_MODES: Record<ScanMode, ScanModeConfig> = {
  quick: {
    id: "quick",
    label: "Quick",
    description: "Fast initial check",
    postLimit: 5,
    commentLimit: 50,
  },
  standard: {
    id: "standard",
    label: "Standard",
    description: "Balanced review",
    postLimit: 8,
    commentLimit: 150,
  },
  deep: {
    id: "deep",
    label: "Deep",
    description: "Strongest sample",
    postLimit: 12,
    commentLimit: 300,
  },
};

export const SCAN_MODE_ORDER: ScanMode[] = ["quick", "standard", "deep"];

export function getScanModeConfig(mode?: ScanMode): ScanModeConfig {
  return SCAN_MODES[mode ?? "standard"];
}
