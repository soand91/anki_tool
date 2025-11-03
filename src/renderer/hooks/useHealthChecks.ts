import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HealthStatus } from "../../shared/health/types";

export type HealthRow = {
  id: string;
  label: string;
  status: HealthStatus;
  detail?: string;
};

type ApiHealthEvent = 
  | { type: "BEGIN"; at: number } 
  | { type: "ROW"; row: HealthRow }
  | { type: "END"; at: number; overall: HealthStatus };