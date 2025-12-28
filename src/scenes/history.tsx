import { makeScene2D } from '@motion-canvas/2d';
import { waitFor, waitUntil, all } from '@motion-canvas/core/lib/flow';
import { createRef } from '@motion-canvas/core';

import { ImageStream } from '../components/ImageStream'
import { ImageDock } from '../components/ImageDock'
import { HighlightMarker } from '../components/HighlightMarker'

// Image from Article https://doi.org/10.1109/SBAC-PAD.2011.10
import memoryAccessVsCPUSpeedPng from '../../assets/images/memoryAccessVsCPUSpeed.png'

// Journal Article https://doi.org/10.1109/PGEC.1965.264263
import slaveMemPaperPage1 from '../../assets/images/slaveMemPaperPage1.jpg';
import slaveMemPaperPage2 from '../../assets/images/slaveMemPaperPage2.jpg';

export default makeScene2D(function* (view) {
  const stream = createRef<ImageStream>();
  view.add(
    <ImageStream
      ref={stream}
      images={[memoryAccessVsCPUSpeedPng]}
      flyDuration={2.4}
      interval={0.16}
      scale={2}
      rectFill={'#F5F1ED'}
      borderColor={'#F5F1ED'}
    />
  );

  yield* stream().flyIn();
  yield* stream().flyOut();

  const ArticleImages = [
    slaveMemPaperPage2,
    slaveMemPaperPage1,
  ];

  const dockerRef = createRef<ImageDock>();

  view.add(<ImageDock ref={dockerRef} images={ArticleImages} />);

  yield* dockerRef().intro();

  yield* dockerRef().focus(1);

  // Create ref list, the index order perfectly matches the playback order
  const markerRefList = Array.from({length: 14}, (_) => createRef<HighlightMarker>());

  // ==========================================================
  // 1. Hierarchy - Orange
  // ==========================================================
  view.add(
    <HighlightMarker
      fill={'#FF6B35'}
      opacity={0.7}
      compositeOperation={'multiply'}
      ref={markerRefList[0]}
      radius={4}
      points={[[-742.5, -354.75], [-412.5, -321.75]]}
      progress={0}
    />
  );

  // ==========================================================
  // 2. Map Strategy - Blue
  // ==========================================================
  view.add(
    <HighlightMarker
      fill={'#357DED'}
      opacity={0.7}
      compositeOperation={'multiply'}
      ref={markerRefList[1]}
      radius={4}
      points={[[49.5, -1039.5], [874.5, -1006.5]]}
      progress={0}
    />
  );
  view.add(
    <HighlightMarker
      fill={'#357DED'}
      opacity={0.7}
      compositeOperation={'multiply'}
      ref={markerRefList[2]}
      radius={4}
      points={[[8.25, -998.25], [874.5, -973.5]]}
      progress={0}
    />
  );
  view.add(
    <HighlightMarker
      fill={'#357DED'}
      opacity={0.7}
      compositeOperation={'multiply'}
      ref={markerRefList[3]}
      radius={4}
      points={[[8.25, -965.25], [742.5, -940.5]]}
      progress={0}
    />
  );

  // ==========================================================
  // 3. Replace Strategy - Green
  // ==========================================================
  view.add(
    <HighlightMarker
      fill={'#31D843'}
      opacity={0.7}
      compositeOperation={'multiply'}
      ref={markerRefList[4]}
      radius={4}
      points={[[-866.25, 107.25], [-24.75, 132]]}
      progress={0}
    />
  );
  view.add(
    <HighlightMarker
      fill={'#31D843'}
      opacity={0.7}
      compositeOperation={'multiply'}
      ref={markerRefList[5]}
      radius={4}
      points={[[-866.25, 140.25], [-24.75, 165]]}
      progress={0}
    />
  );
  view.add(
    <HighlightMarker
      fill={'#31D843'}
      opacity={0.7}
      compositeOperation={'multiply'}
      ref={markerRefList[6]}
      radius={4}
      points={[[-866.25, 173.25], [-24.75, 198]]}
      progress={0}
    />
  );
  view.add(
    <HighlightMarker
      fill={'#31D843'}
      opacity={0.7}
      compositeOperation={'multiply'}
      ref={markerRefList[7]}
      radius={4}
      points={[[-866.25, 206.25], [-709.5, 231]]}
      progress={0}
    />
  );

  // ==========================================================
  // 4. Allocation Strategy - Purple
  // ==========================================================
  view.add(
    <HighlightMarker
      fill={'#E2ADF2'}
      opacity={0.7}
      compositeOperation={'multiply'}
      ref={markerRefList[8]}
      radius={4}
      points={[[445.5, -867.9], [866.25, -841.5]]}
      progress={0}
    />
  );
  view.add(
    <HighlightMarker
      fill={'#E2ADF2'}
      opacity={0.7}
      compositeOperation={'multiply'}
      ref={markerRefList[9]}
      radius={4}
      points={[[8.25, -833.25], [519.75, -808.5]]}
      progress={0}
    />
  );

  // ==========================================================
  // 5. Cache Coherence - Red (Moved to LAST)
  // ==========================================================
  view.add(
    <HighlightMarker
      fill={'#EA526F'}
      opacity={0.7}
      compositeOperation={'multiply'}
      ref={markerRefList[10]}
      radius={4}
      points={[[156.75, -775.5], [874.5, -750.75]]}
      progress={0}
    />
  );
  view.add(
    <HighlightMarker
      fill={'#EA526F'}
      opacity={0.7}
      compositeOperation={'multiply'}
      ref={markerRefList[11]}
      radius={4}
      points={[[8.25, -742.5], [874.5, -717.75]]}
      progress={0}
    />
  );
  view.add(
    <HighlightMarker
      fill={'#EA526F'}
      opacity={0.7}
      compositeOperation={'multiply'}
      ref={markerRefList[12]}
      radius={4}
      points={[[8.25, -709.5], [874.5, -684.75]]}
      progress={0}
    />
  );
  view.add(
    <HighlightMarker
      fill={'#EA526F'}
      opacity={0.7}
      compositeOperation={'multiply'}
      ref={markerRefList[13]}
      radius={4}
      points={[[8.25, -676.5], [528, -651.75]]}
      progress={0}
    />
  );

  // ==========================================================
  // Animation Execution Sequence (Order: 0 -> 13)
  // ==========================================================

  // 1. Hierarchy (Orange)
  yield* markerRefList[0]().progress(1, 1.0);
  yield* waitUntil("Intro hierarchic done");

  // 2. Map (Blue)
  yield* markerRefList[1]().progress(1, 1.5 / 3);
  yield* markerRefList[2]().progress(1, 1.5 / 3);
  yield* markerRefList[3]().progress(1, 1.5 / 3);
  yield* waitUntil("Intro map strategy done");

  // 3. Replace (Green)
  yield* markerRefList[4]().progress(1, 2.0 / 4);
  yield* markerRefList[5]().progress(1, 2.0 / 4);
  yield* markerRefList[6]().progress(1, 2.0 / 4);
  yield* markerRefList[7]().progress(1, 2.0 / 4);
  yield* waitUntil("Intro replace strategy done");

  // 4. Allocation (Purple)
  yield* markerRefList[8]().progress(1, 1.0 / 2);
  yield* markerRefList[9]().progress(1, 1.0 / 2);
  yield* waitUntil("Intro allocation strategy done");

  // 5. Cache Coherence (Red) - NOW LAST
  yield* markerRefList[10]().progress(1, 2.0 / 4);
  yield* markerRefList[11]().progress(1, 2.0 / 4);
  yield* markerRefList[12]().progress(1, 2.0 / 4);
  yield* markerRefList[13]().progress(1, 2.0 / 4);
  yield* waitUntil("Intro cache coherence done");


  // End: Fade out all
  yield* all(...markerRefList.map((item) => item().progress(0, 1.0)))

  yield* dockerRef().unfocus();

  yield* dockerRef().exit();
});