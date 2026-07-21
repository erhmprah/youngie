import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

const scaleRatio = SCREEN_WIDTH / BASE_WIDTH;
const verticalScaleRatio = SCREEN_HEIGHT / BASE_HEIGHT;
const fontScale = PixelRatio.getFontScale();

const MAX_SCALE = 1.15;
const MAX_VERTICAL_SCALE = 1.2;
const MIN_SCALE = 0.85;
const MIN_VERTICAL_SCALE = 0.85;

function clampRange(value: number, max: number, min: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

export function scale(size: number): number {
  return clampRange(size * scaleRatio, size * MAX_SCALE, size * MIN_SCALE);
}

export function verticalScale(size: number): number {
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
  const scaled = moderateScale(size, factor);
  return scaled * clampRange(fontScale, 1.15, 1);
}

export function borderScale(size: number): number {
  return Math.max(scale(size), 1);
}

export function hairlineWidth(): number {
  return 1 / PixelRatio.get();
}

export const screen = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  scaleRatio,
  verticalScaleRatio,
  fontScale,
};
