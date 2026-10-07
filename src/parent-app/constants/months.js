// The parent app reads the SAME clock and month constants as the rest of the
// app. This file used to be a hand-maintained duplicate of
// src/constants/months.js (changing one without the other would have made
// dates drift between the staff screens and the Parent screens), so it now
// simply re-exports it.
export * from "../../constants/months.js";
