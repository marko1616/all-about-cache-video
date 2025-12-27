import {makeProject} from '@motion-canvas/core';

import history from './scenes/history?scene';
import hierarchy from './scenes/hierarchy?scene';

export default makeProject({
  scenes: [history, hierarchy],
});
