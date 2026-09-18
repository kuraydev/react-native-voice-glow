/**
 * `react-native-audio-api` is an optional peer: `useMicrophone` loads it lazily
 * so an app driving the beam from its own audio source never has to install it.
 * This shim keeps the package type-checkable without it present.
 */
declare module 'react-native-audio-api' {
  const audioApi: any;
  export = audioApi;
}
