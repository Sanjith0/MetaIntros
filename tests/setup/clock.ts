import { beforeAll, beforeEach } from "vitest";
import { setClockOffsetMs } from "@/lib/server/clock";

// The global clock persists across reseeds by design; give every test file (its beforeAll runs
// after this one) and every test a clean, real-time clock.
const realTime = () => setClockOffsetMs(0);
beforeAll(realTime);
beforeEach(realTime);
