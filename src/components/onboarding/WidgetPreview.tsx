import React from 'react';
import { View } from 'react-native';

import { MediumWidget, useWidgetModel, WIDGET_SIZES } from '../../widgets';

const PREVIEW_W = 260;
const SCALE = PREVIEW_W / WIDGET_SIZES.medium.width;

/**
 * Widget-introduction preview: the actual in-app Medium widget (src/widgets) at thumbnail scale with live data, so
 * the preview is literally what the Home Screen widget looks like and cannot drift from it.
 */
export function WidgetPreview() {
  const model = useWidgetModel();
  if (!model) return <View style={{ width: PREVIEW_W, height: WIDGET_SIZES.medium.height * SCALE, alignSelf: 'center' }} />;
  return (
    <View style={{ alignSelf: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <MediumWidget model={model} scale={SCALE} />
    </View>
  );
}
