# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- `setVideoEncoderConfiguration()` sends numeric values of 0 (e.g. `quality`, `bitrateLimit`,
  `govLength`), which were left out of the request. Missing, `null` or empty values are still
  left out
- `setVideoEncoderConfiguration()` returns the request error on a network error or timeout,
  rather than throwing a `TypeError` (which left the promise unsettled), and returns a SOAP
  fault rather than reporting it as a wrong response

## [0.8.0-15] - 2026-10-30

### Changed
- The discovery tests are skipped unless `TEST_DISCOVERY` is set, as they probe the real
  network and fail if there are any ONVIF devices on it

### Fixed
- `getStatus()` always returns `utcTime` as a `Date`, or `undefined` if it can't be read.
  It should be an `xs:dateTime`, but some cameras send epoch seconds (or ms), which
  were returned as a number, and a dateTime with an offset was returned as a string

## [0.8.0-14] - 2026-09-16

### Fixed
- `getSystemDateAndTime()` now recalculates `timeShift` on every call instead of only
  the first. Previously, if the device's clock drifted, was NTP-corrected, or the
  device rebooted after the first calculation, `timeShift` stayed stale for the life
  of the `Cam` object and every subsequent WS-Security-authenticated request would
  keep failing (seen as persistent 400 errors) until a new `Cam` was created.

## [0.8.0-13] - 2026-08-30

### Fixed
- Media/OSD operations
    - Spelling of `videoSourceConfigurationToken`
    - Don't test for `options.fontColor.X` etc as 0 is a valid value

## [0.8.0-12] - 2026-06-21

### Added
- Add support for AddEventBroker()

## [0.8.0-11] - 2026-04-17

### Fixed
- Fix tests

## [0.8.0-10] - 2025-06-26

### Changed
- Remove some odd workarounds in the PTZ commands that don't work with our cameras

## [0.8.0-9] - 2025-06-09

### Fixed
- Support xs:duration string for PTZ Continuous Move

## [0.8.0-8] - 2025-06-06

### Fixed
- error handling in getAudio*() functions

## [0.8.0-7] - 2025-06-02

### Added
- PTZ getNode()
- PTZ getConfiguration()
- PTZ getCompatibleConfigurations()

### Fixed
- PTZ getConfigurationOptions() should take an options object and not just a token

## [0.8.0-6] - 2025-05-16

### Fixed
- Include error message text when reporting http errors


## [0.8.0-5] - 2025-05-16

### Added
- Explicit control to force use of media ver10 or ver20 rather that adapting to what the camera supports.  We need this as we only want ver10 data to present on the high side

## [0.8.0-4] - 2025-05-13

### Added
- getCompatibleAudioEncoderConfigurations()
- getCompatibleAudioOutputConfigurations()
- getCompatibleAudioSourceConfigurations()
- getCompatibleMetadataConfigurations()
- getCompatibleVideoSourceConfigurations()
- getCompatibleVideoEncoderConfigurations() 

## [0.8.0-3] - 2025-05-13

### Added
- getAudioOutputConfigurationOptions()
- 

## [0.8.0-2] - 2025-04-23

### Fixed
- Issue with configuration tokens in added methods 

## [0.8.0-1] - 2025-04-22

### Added
- Added missing functions needed to generate the data required for onboarding
    - getVideoSourceConfigurationOptions()
    - getAudioSourceConfigurationOptions()
    - getMetadataConfigurations()
    - getMetadataConfigurationOptions()

### Fixed
- getAudioEncoderConfigurationOptions() to take options rather that just a token

[Unreleased]: https://github.com/ConfiguredThings/sfjsComponents/compare/v0.8.0-15...HEAD
[0.8.0-15]: https://github.com/ConfiguredThings/sfjsComponents/compare/v0.8.0-14...v0.8.0-15
[0.8.0-14]: https://github.com/ConfiguredThings/sfjsComponents/compare/v0.8.0-13...v0.8.0-14
[0.8.0-13]: https://github.com/ConfiguredThings/sfjsComponents/compare/v0.8.0-12...v0.8.0-13
[0.8.0-12]: https://github.com/ConfiguredThings/sfjsComponents/compare/v0.8.0-11...v0.8.0-12
[0.8.0-11]: https://github.com/ConfiguredThings/sfjsComponents/compare/v0.8.0-10...v0.8.0-11
[0.8.0-10]: https://github.com/ConfiguredThings/sfjsComponents/compare/v0.8.0-9...v0.8.0-10
[0.8.0-9]: https://github.com/ConfiguredThings/sfjsComponents/compare/v0.8.0-8...v0.8.0-9
[0.8.0-8]: https://github.com/ConfiguredThings/sfjsComponents/compare/v0.8.0-7...v0.8.0-8
[0.8.0-7]: https://github.com/ConfiguredThings/sfjsComponents/compare/v0.8.0-6...v0.8.0-7
[0.8.0-6]: https://github.com/ConfiguredThings/sfjsComponents/compare/v0.8.0-5...v0.8.0-6
[0.8.0-5]: https://github.com/ConfiguredThings/sfjsComponents/compare/v0.8.0-4...v0.8.0-5
[0.8.0-4]: https://github.com/ConfiguredThings/sfjsComponents/compare/v0.8.0-3...v0.8.0-4
[0.8.0-3]: https://github.com/ConfiguredThings/sfjsComponents/compare/v0.8.0-2...v0.8.0-3
[0.8.0-2]: https://github.com/ConfiguredThings/sfjsComponents/compare/v0.8.0-1...v0.8.0-2
[0.8.0-1]: https://github.com/ConfiguredThings/sfjsComponents/compare/v0.8.0...v0.8.0-1


## [0.8.0] Upstream master
- 0.6.6 A lot of fixes (@RogerHardiman). Stable and tested, next step for new version
- 0.6.5 Add MEDIA2 support, Profile T and GetServices XAddrs support for H265 cameras. Add support for HTTPS. Add Discovery.on('error') to examples. 
     Add flag to only send Zoom, or only send Pan/Tilt for some broken cameras (Sony XP1 Xiongmai). Fix bug in GetServices. Improve setNTP command. 
     API changed on getNetworkInterfaces and other methods that could return an Array or a Single Item. We now return an Array in all cases. 
     Add example converting library so it uses Promises with Promisify. Enable 3702 Discovery on Windows for MockServer. Add MockServer test cases)
- 0.6.1 Workaround for cams that don't send date-time
- 0.6.0 Refactor modules for proper import in electron-based environment
- 0.5.5 Added ptz.`gotoHomePosition`, ptz.`setHomePosition`. Fixed exceptions in ptz.`getConfigurations` and utils.`parseSOAPString`. 
     Added tests for ptz.`setPreset`, ptz.`removePreset`, ptz.`gotoHomePosition`, and ptz.`setHomePosition`.
- 0.5.4 Bumped for NPM.
- 0.5.3 Some fixes. Tests
- 0.5.2 `preserveAddress` property for NAT devices, discovery with multiple network interfaces (@Climax777)
- 0.5.1 Critical bugfix in SOAP-auth for some cams
- 0.5.0 Profile G support (@RogerHardiman), proper SOAP auth, nodejs support >= 0.12
- 0.4.2 Bugfixes
- 0.4.1 Improved discovery (@sousandrei, @RogerHardiman)
- 0.4.0 Encoder support (@chriswiggins), Imaging service (@EastL)
- 0.3.1 EventEmitter-based events
- 0.3.0 Refactoring, documentation, event service basics
- 0.2.7 WS-Discovery
