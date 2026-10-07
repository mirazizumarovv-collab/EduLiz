// Plain unit check (no browser needed) for recentLateCount — confirms it
// spans multiple months instead of only the current one.
import { recentLateCount } from "../src/parent-app/utils/calculations.js";

const data = { Aug: [], Sep: [] };
for (let i = 0; i < 6; i++) data.Aug.push({ day: 10 + i, status: "L" });
for (let i = 0; i < 8; i++) data.Sep.push({ day: 1 + i, status: "L" });

const count = recentLateCount(data);
console.log("recentLateCount across Aug+Sep (14 total lates):", count, "expected 14");
if (count !== 14) { console.log("FAIL"); process.exit(1); }
console.log("PASS — spans the month boundary correctly");
