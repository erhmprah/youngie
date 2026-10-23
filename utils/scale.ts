import { Dimensions, PixelRatio } from 'react-native';

const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

const MAX_SCALE = 1.15;
const MAX_VERTICAL_SCALE = 1.2;
const MIN_SCALE = 0.85;
const MIN_VERTICAL_SCALE = 0.85;

function clampRange(value: number, max: number, min: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

export function scale(size: number): number {
  const { width } = Dimensions.get('window');
  const scaleRatio = width / BASE_WIDTH;
  return clampRange(size * scaleRatio, size * MAX_SCALE, size * MIN_SCALE);
}

export function verticalScale(size: number): number {
  const { height } = Dimensions.get('window');
  const verticalScaleRatio = height / BASE_HEIGHT;
  return clampRange(
    size * verticalScaleRatio,
    size * MAX_VERTICAL_SCALE,
    size * MIN_VERTICAL_SCALE
  );
}

export function moderateScale(size: number, factor: number = 0.5): number {
  const full = scale(size);
  return size + (full - size) * factor;
}

export function scaleFont(size: number, factor: number = 0.5): number {
  // React Native Text and TextInput apply the user's font scale automatically.
  // Scaling it here as well would make accessibility font sizes apply twice.
  return moderateScale(size, factor);
}

export function borderScale(size: number): number {
  return Math.max(scale(size), 1);
}

export function hairlineWidth(): number {
  return 1 / PixelRatio.get();
}

export const screen = {
  get width() {
    return Dimensions.get('window').width;
  },
  get height() {
    return Dimensions.get('window').height;
  },
  get scaleRatio() {
    return Dimensions.get('window').width / BASE_WIDTH;
  },
  get verticalScaleRatio() {
    return Dimensions.get('window').height / BASE_HEIGHT;
  },
  get fontScale() {
    return PixelRatio.getFontScale();
  },
};
