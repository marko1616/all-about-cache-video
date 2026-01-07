import { makeScene2D } from "@motion-canvas/2d";
import { createRef, createRefArray, all } from "@motion-canvas/core";

import { overlayTransition } from "../transitions/OverlayTransition";
import { ImageDock } from "../components/ImageDock";
import { HighlightMarker } from "../components/HighlightMarker";

// Journal Article https://doi.org/10.1145/356887.356892
import smithCacheMemoriesPage01Png from "../../assets/images/smithCacheMemoriesPage01.png";
import smithCacheMemoriesPage14Png from "../../assets/images/smithCacheMemoriesPage14.png";
import smithCacheMemoriesPage15Png from "../../assets/images/smithCacheMemoriesPage15.png";

export default makeScene2D(function* (view) {
  const articleImages = [
    smithCacheMemoriesPage01Png,
    smithCacheMemoriesPage14Png,
    smithCacheMemoriesPage15Png,
  ];
  const dockRef = createRef<ImageDock>();
  const markerRefList = createRefArray<HighlightMarker>();

  view.add(
    <ImageDock ref={dockRef} images={articleImages} rangeScale={0.05} />,
  );

  // ==========================================================
  // 1. Direct Mapped - Orange
  // ==========================================================
  view.add(
    <HighlightMarker
      fill={"#FF6B35"}
      opacity={0.7}
      compositeOperation={"multiply"}
      ref={markerRefList}
      radius={4}
      points={[
        [-355, -390],
        [-155, -370],
      ]}
      progress={0}
    />,
  );

  // ==========================================================
  // 2. Fully Associative - Blue
  // ==========================================================
  view.add(
    <HighlightMarker
      fill={"#357DED"}
      opacity={0.7}
      compositeOperation={"multiply"}
      ref={markerRefList}
      radius={4}
      points={[
        [420, 690],
        [545, 715],
      ]}
      progress={0}
    />,
  );
  view.add(
    <HighlightMarker
      fill={"#357DED"}
      opacity={0.7}
      compositeOperation={"multiply"}
      ref={markerRefList}
      radius={4}
      points={[
        [15, 720],
        [100, 745],
      ]}
      progress={0}
    />,
  );

  // ==========================================================
  // 3. Set Associative - Green
  // ==========================================================
  view.add(
    <HighlightMarker
      fill={"#31D843"}
      opacity={0.7}
      compositeOperation={"multiply"}
      ref={markerRefList}
      radius={4}
      points={[
        [370, 450],
        [550, 475],
      ]}
      progress={0}
    />,
  );

  yield* overlayTransition("Chapter Four - Mapping strategy");

  yield* dockRef().intro();

  yield* dockRef().focus(2);

  yield* markerRefList[0].progress(1, 1.0);
  yield* markerRefList[0].progress(0, 1.0);

  yield* dockRef().unfocus();
  yield* dockRef().focus(1);

  yield* markerRefList[1].progress(1, 1.0);
  yield* markerRefList[2].progress(1, 1.0);

  yield* markerRefList[3].progress(1, 1.0);

  yield* all(
    markerRefList[1].progress(0, 1.0),
    markerRefList[2].progress(0, 1.0),

    markerRefList[3].progress(0, 1.0),
  );
});
