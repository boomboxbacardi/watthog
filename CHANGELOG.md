## [0.4.1](https://github.com/boomboxbacardi/watthog/compare/v0.4.0...v0.4.1) (2026-06-16)


### Bug Fixes

* **energy:** provide level and co2 range that cli.js already consumes ([e58273e](https://github.com/boomboxbacardi/watthog/commit/e58273e43a524b0ec289bfc2efa73eafbaa53f19))

# [0.4.0](https://github.com/boomboxbacardi/watthog/compare/v0.3.0...v0.4.0) (2026-06-16)


### Features

* **cli:** wire up interactive prompt, loader, and update check ([eff4773](https://github.com/boomboxbacardi/watthog/commit/eff4773cfc514c2e59f91ffc005cdf981b432c06))

# [0.3.0](https://github.com/boomboxbacardi/watthog/compare/v0.2.0...v0.3.0) (2026-06-16)


### Bug Fixes

* **cli:** compute submit week kWh from whPerDay7, not the range object ([b56140e](https://github.com/boomboxbacardi/watthog/commit/b56140efa1b0c6dede24da867273e7159094fe20))
* point submit and share URLs at watthog.vercel.app ([575c5d9](https://github.com/boomboxbacardi/watthog/commit/575c5d97a761176f9034f03a1582ad6ef56d06cd))


### Features

* **cli:** add submit command for opt-in leaderboard upload ([52f1d58](https://github.com/boomboxbacardi/watthog/commit/52f1d585f74846f0bf07e2ec053afa35914d9e2c))
* **cli:** print the shareable hog link after submit ([9743385](https://github.com/boomboxbacardi/watthog/commit/9743385f87e93781dcf4c1b8a21a56b10392f2d3))
* **report:** unify energy color on amber, honest 14-day axis, fold long model list ([9b93d93](https://github.com/boomboxbacardi/watthog/commit/9b93d93e1a9fca79b8c70d90cd00b833cf95bde8))
* **web:** back the leaderboard with Redis and add shareable hog pages ([b44944f](https://github.com/boomboxbacardi/watthog/commit/b44944f7a9088d438602c8455b73059dc1e8551a))
* **web:** give the hero a trough scene and turn Method into a chart ([503f974](https://github.com/boomboxbacardi/watthog/commit/503f97496c61748515d585f7344fcceecdd733cd))

# [0.2.0](https://github.com/boomboxbacardi/watthog/compare/v0.1.0...v0.2.0) (2026-06-11)


### Features

* **onboarding:** add connect/doctor commands and a SOURCES overview ([ae4f2e1](https://github.com/boomboxbacardi/watthog/commit/ae4f2e1676b95e914b0b836423acf2ed7bceeba6))
* **onboarding:** authorize Copilot billing via GitHub device flow ([9a18bc0](https://github.com/boomboxbacardi/watthog/commit/9a18bc0d05389809b4587298176177697f96f3bc))
* **report:** show source per model and count Copilot's local chat sessions ([6693c7f](https://github.com/boomboxbacardi/watthog/commit/6693c7f6a0ca8a0f542e76bbfa6a55661528f579))

# [0.1.0](https://github.com/boomboxbacardi/watthog/compare/v0.0.4...v0.1.0) (2026-06-11)


### Features

* **sources:** add GitHub Copilot via GitHub's premium-request billing report ([da4ec50](https://github.com/boomboxbacardi/watthog/commit/da4ec503412002b75e3c5331742241ca634b1e93))

## [0.0.4](https://github.com/boomboxbacardi/watthog/compare/v0.0.3...v0.0.4) (2026-06-11)


### Bug Fixes

* **sources:** fetch Cursor usage from its dashboard API ([197177d](https://github.com/boomboxbacardi/watthog/commit/197177db1221cc91a6d77ea88013840383bf10a6))
* **sources:** warn on Cursor API fallback and merge early local history ([a12ed10](https://github.com/boomboxbacardi/watthog/commit/a12ed10b8642d9db5bb94cd74234d671d481b923))

## [0.0.3](https://github.com/boomboxbacardi/watthog/compare/v0.0.2...v0.0.3) (2026-06-11)


### Performance Improvements

* **sources:** cache Cursor scan results until state.vscdb changes ([197fcb2](https://github.com/boomboxbacardi/watthog/commit/197fcb263ba765a58f92e67819038d3854b044c9))

## [0.0.2](https://github.com/boomboxbacardi/watthog/compare/v0.0.1...v0.0.2) (2026-06-11)


### Bug Fixes

* **release:** remove --first-release flag for subsequent releases ([ccf3d1a](https://github.com/boomboxbacardi/watthog/commit/ccf3d1a67ad8f04733984e3c8d32a6bde812b7ae))
