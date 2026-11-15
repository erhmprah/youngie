module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          lazyImports: {
            // Exclude iOS-only modules that don't exist on Android
            // These cause "Invariant Violation: new NativeEventEmitter() requires a non-null argument" on Android
            exclude: [
              'PushNotificationIOS',
              'ActionSheetIOS',
              'DatePickerIOS',
              'ProgressViewIOS',
              'InputAccessoryView',
            ],
          },
        },
      ],
    ],
  };
};