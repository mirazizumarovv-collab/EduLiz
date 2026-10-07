// Unique ids for records created in the browser.
//
// A time stamp alone is NOT unique: two records made in the same millisecond
// (approving a request creates a student and a guardian in one go), or any
// number of them while a test holds the clock still, would share an id. A
// counter and a random suffix make collisions not just unlikely but
// impossible within one tab.
let counter = 0;
export function createId(prefix) {
  counter = (counter + 1) % 1679616; // 36^4 — wraps long before it could repeat within a millisecond
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
