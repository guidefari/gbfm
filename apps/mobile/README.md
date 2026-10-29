# gbfm mobile

Expo SDK 58, React Native 0.88, and NativeWind 5.

## iOS simulator

Install workspace dependencies with `bun install` from the repository root. Use Xcode 27 for the iOS 27 simulator.

From `apps/mobile`:

```sh
bun run ios --port 8082
```

This builds and installs the native development client, starts Metro, and opens the simulator. `expo start` alone cannot install a missing native build. Keep one Metro process per port.

The API comes from `EXPO_PUBLIC_API_URL` in the mobile environment. The simulator can reach the host through `127.0.0.1`.

## Disposable local smoke tests

Start the fixture API from `apps/server`:

```sh
bun run dev:e2e
```

Then start the app from `apps/mobile`:

```sh
EXPO_PUBLIC_API_URL=http://127.0.0.1:3003 EXPO_NO_DEV_MENU=1 bun run ios --port 8082
```

The fixture API uses a disposable database, test accounts, and a 30-second silent audio file with byte-range support for native playback. It does not use production data. `EXPO_NO_DEV_MENU=1` keeps Expo's floating tools button from covering app controls during checks.

## Standalone iPhone build

Use the Expo account `guidefari` and the Apple Developer account `apple@guidefari.com`. Apple signing uses the GUIDE TENDAI FARI team, not the iCloud personal team or the work account.

From `apps/mobile`:

```sh
EXPO_APPLE_ID=apple@guidefari.com bunx eas-cli build --platform ios --profile preview
```

The preview profile creates an internally distributed Release build with the production API at `https://api.goosebumps.fm`. It does not require Metro. EAS handles signing and device registration; only registered devices can install this build.

The app identifier is `fm.goosebumps.gbfm`, and the signing team is `78328YPS5M`.

## SDK maintenance

```sh
bunx expo install --check
bunx expo-doctor
bun run test
```

Run `bun precommit` from the repository root before committing.

NativeWind uses its Babel preset with `globalClassNamePolyfill: false` in Metro. The global wrapper does not forward every React Native 0.88 export, which can break Expo native views and font loading.

The app icon is `assets/icon.png`, rendered from `assets/icon.svg`. It is an opaque 1024-pixel square; iOS applies the corner mask.
