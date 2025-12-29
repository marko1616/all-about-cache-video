import { makeProject } from "@motion-canvas/core";

import history from "./scenes/history?scene";
import hierarchy from "./scenes/hierarchy?scene";
import concepts from "./scenes/concepts?scene";

// - 0. History and Intro
// - 1. Memory hierarchy
// - 2. Basic concepts of cache
// - 3. Build a simple cache
// - 4. Alloc strategy，mapping strategy and replacement strategy
// - 5. Replace strategy
// - 6. Cache Coherence
// - 7. Deal with virtual address
// - 8. Hardware
// - 9. Software
export default makeProject({
  scenes: [history, hierarchy, concepts],
});
