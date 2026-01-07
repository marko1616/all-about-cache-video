import { makeProject } from "@motion-canvas/core";

import history from "./scenes/history?scene";
import hierarchy from "./scenes/hierarchy?scene";
import concepts from "./scenes/concepts?scene";
import vanillaCache from "./scenes/vanillaCache?scene";
import mappingStrategy from "./scenes/mappingStrategy?scene";
import directMappedCache from "./scenes/directMappedCache?scene";
import fullyAssociativeCache from "./scenes/fullyAssociativeCache?scene";
import setAssociativeCache from "./scenes/setAssociativeCache?scene";

import "./global.css";

// - 0. History and Intro
// - 1. Memory hierarchy
// - 2. Basic concepts of cache
// - 3. Build a simple cache
// - 4. Mapping strategy
// - 5. Replace strategy
// - 6. Cache Coherence
// - 7. Deal with virtual address
// - 8. Hardware
// - 9. Software
export default makeProject({
  experimentalFeatures: true,
  scenes: [
    history,
    hierarchy,
    concepts,
    vanillaCache,
    mappingStrategy,
    directMappedCache,
    fullyAssociativeCache,
    setAssociativeCache,
  ],
});
