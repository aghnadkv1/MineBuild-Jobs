import { ApiError } from "@/lib/api";
import type { JobSourceAdapter } from "@/lib/integrations/job-source-contract";

export const fiverrJobSource: JobSourceAdapter = {
  source: "fiverr",
  async discover() {
    throw new ApiError(
      501,
      "FIVERR_ADAPTER_NOT_CONFIGURED",
      "Adapter Fiverr menunggu dokumentasi API resmi; endpoint Fiverr belum dikonfigurasi.",
    );
  },
};
