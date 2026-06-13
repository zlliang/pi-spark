# Changelog

## [0.11.2](https://github.com/zlliang/pi-packages/compare/v0.10.2...v0.11.2) (2026-06-13)


### ⚠ BREAKING CHANGES

* fold pi-credits into pi-spark and revert to single package
* **models:** the model tool's "current" action is renamed to "active", and the scope/provider/model params are replaced by "query".

### Features

* add spark config and editor status events ([fcbeb86](https://github.com/zlliang/pi-packages/commit/fcbeb86f4582513c808baf41d1f87b811428d67f))
* add trust-all extension ([2784e47](https://github.com/zlliang/pi-packages/commit/2784e4719689280029864c45455bdac1d515669a))
* **codex-usage:** add Codex rate-limit usage status ([6778581](https://github.com/zlliang/pi-packages/commit/67785818e3cb2304b16b1feaf1dfb58520cb1542))
* **codex-usage:** refresh after usage events ([bc53364](https://github.com/zlliang/pi-packages/commit/bc533646d085966376278ec6672b7d51d11c3e2d))
* create editor and footer extensions ([c402407](https://github.com/zlliang/pi-packages/commit/c4024075fb164a3ae382ee43529e896d973a7ca8))
* **credits:** generalize codex-usage into multi-provider credits ([84ffc8e](https://github.com/zlliang/pi-packages/commit/84ffc8e25256619a6b82759095be554433de15d0))
* **editor:** add pulse spinner preset ([9033de9](https://github.com/zlliang/pi-packages/commit/9033de9552630b16481dcb37aa9556bd37ab1bc7))
* **editor:** allow disabling editor config ([168d310](https://github.com/zlliang/pi-packages/commit/168d310566302abd7093a26fbbc45451ac61f8a4))
* **editor:** show working status in border ([b72b127](https://github.com/zlliang/pi-packages/commit/b72b12738b209bb3016009c88e2efd1544d770f6))
* **footer:** add config flag ([a0a838a](https://github.com/zlliang/pi-packages/commit/a0a838a9be77d8d61717d0325adea10340186f8a))
* **footer:** include statuses in main line ([93a18de](https://github.com/zlliang/pi-packages/commit/93a18de6fbd53e7751dbecb01f9efa7b954d8bdf))
* **footer:** shorten cwd display ([8ae3525](https://github.com/zlliang/pi-packages/commit/8ae3525af6311de94c4b85f07e3f9c6df5369011))
* **footer:** split subscription and paid costs in usage stats ([28ddcb7](https://github.com/zlliang/pi-packages/commit/28ddcb7b46ad59aaf9645ef8c3cc7b9fde9e5fcd))
* **fullscreen:** add extension to clear screen and pin editor to bottom ([ab2d2ba](https://github.com/zlliang/pi-packages/commit/ab2d2bae18f4282da0ffe76232b3a671cd382203))
* **fullscreen:** clear session on exit ([b48b997](https://github.com/zlliang/pi-packages/commit/b48b9972365da5c24d2f90f36d1ba0e945d87e94))
* **models:** add model inspection tool ([4d2625e](https://github.com/zlliang/pi-packages/commit/4d2625e2e2bd2e5637c50e563efff7b271a5a21d))
* **models:** filter model lists with Liqe queries ([877479b](https://github.com/zlliang/pi-packages/commit/877479b51a715b7a5a05381b207ecd03837e433d))
* move credits extension to the dedicated pi-credits package ([2d1e868](https://github.com/zlliang/pi-packages/commit/2d1e868f2c541c3707c9564ccdedaf80f40a7be5))
* **presets:** add model presets extension ([a35a6c0](https://github.com/zlliang/pi-packages/commit/a35a6c0f0bc291aaeb6f9a8e935267f9f69390e2))
* **presets:** support preset CLI flag ([435c164](https://github.com/zlliang/pi-packages/commit/435c164b61ce231074fdbdee636d45af1845bebf))
* **recap:** add idle session recap extension ([47a66cc](https://github.com/zlliang/pi-packages/commit/47a66cccda1e5d752c79f61d77dcfc8613d345d3))
* **set-session-name:** add session naming tool ([bc60e90](https://github.com/zlliang/pi-packages/commit/bc60e9049e17e1b82fc0d936731235f2bd4e94dd))
* **tui:** add split line components ([c256cd5](https://github.com/zlliang/pi-packages/commit/c256cd5be7e322b3d2f452d7fc37f936681a1b10))


### Bug Fixes

* add npm package homepage metadata ([9ff2e39](https://github.com/zlliang/pi-packages/commit/9ff2e39d609c3c0a39c45a6c6b456bde964fbaa8))
* **ci:** disable pnpm supply-chain checks blocking install ([f9ecda9](https://github.com/zlliang/pi-packages/commit/f9ecda95e409d958491e37914150bede013f1faf))
* **codex-usage:** polish usage error message ([99edccf](https://github.com/zlliang/pi-packages/commit/99edccf6d19b3fdb334414b46f59a25d542bc03d))
* **codex-usage:** round status percentages ([a641329](https://github.com/zlliang/pi-packages/commit/a64132919bd99d67d2dd039206ab80a41cfab720))
* **config:** handle invalid spark config ([aade7a5](https://github.com/zlliang/pi-packages/commit/aade7a544b9ef4d70e4202b59409a9373a9a50df))
* **editor:** add inner padding to split line ([a035d2d](https://github.com/zlliang/pi-packages/commit/a035d2d29eadecd3d8a1ecfe88ed3e348d5e0c14))
* **editor:** add tildes spinner preset ([523f6fc](https://github.com/zlliang/pi-packages/commit/523f6fcd982455fbfe202982c5dfb7a62590b6dd))
* **editor:** clear tool status after executions ([780395f](https://github.com/zlliang/pi-packages/commit/780395f79e078dd7c4af596f5dd66b344ce3ef34))
* **editor:** track running tools by call id ([72fbe37](https://github.com/zlliang/pi-packages/commit/72fbe370995296988bcd3100d2c25721b08af62b))
* **fullscreen:** keep clearOnShrink enabled across reload ([e1adde0](https://github.com/zlliang/pi-packages/commit/e1adde0eca052319dd9231f6e22456ae33109289))
* **fullscreen:** style exit session label ([b7fcd80](https://github.com/zlliang/pi-packages/commit/b7fcd80113e52efd6c46bcd617c3c0520fcb2fb0))
* **models:** align action description order ([3de17c1](https://github.com/zlliang/pi-packages/commit/3de17c1d5f341eeb8673c70060a8dcb8febe8f5c))
* **models:** expose unavailable models by scope ([8df5053](https://github.com/zlliang/pi-packages/commit/8df5053b1b92aaa78a366088b9414e7f197c4072))
* **models:** keep unavailable model labels visible ([feab815](https://github.com/zlliang/pi-packages/commit/feab8159210033ad362a4951e835247e28325063))
* **models:** polish model tool prompt guideline ([eb01e6b](https://github.com/zlliang/pi-packages/commit/eb01e6b5a3b5dd180d32b9a9c8e06e4b90f42036))
* **models:** show expand hint in model tool call ([a7ac029](https://github.com/zlliang/pi-packages/commit/a7ac02943e0621e04093c5cc0a81a192fe440801))
* **pi-credits:** add missing typebox to lockfile ([07e1672](https://github.com/zlliang/pi-packages/commit/07e167237061be777d5e6e7e59cb519d55ae4d70))
* **pi-spark:** reassert clearOnShrink each render in fullscreen ([55604b5](https://github.com/zlliang/pi-packages/commit/55604b59742b5300ef80102f9fbc3fc1c7a798cd))
* **presets:** match active preset after applying model ([886d3fb](https://github.com/zlliang/pi-packages/commit/886d3fb20af4904db9f94be407b08e724574edc9))
* **recap:** avoid duplicate idle recaps ([bbf9149](https://github.com/zlliang/pi-packages/commit/bbf9149ee9bf4ee17b4f24775af625d9aa142280))
* **release:** bootstrap monorepo release history ([c029083](https://github.com/zlliang/pi-packages/commit/c029083e35e57841f9c13aa0654554d3770db3bc))
* **release:** publish from package directory ([c1e8704](https://github.com/zlliang/pi-packages/commit/c1e8704770a55183dd72b779d3f8788b63c1f688))
* **release:** run manual publish after skipped release job ([b0395df](https://github.com/zlliang/pi-packages/commit/b0395dff8d8248e623c392ea1b38d382a4dd323b))
* **release:** support manual pnpm publish retries ([63a8357](https://github.com/zlliang/pi-packages/commit/63a8357acd0d6511011f01ccc09213057b493ac6))
* simplify cost display ([4990a57](https://github.com/zlliang/pi-packages/commit/4990a57fd9688929e115d64121a009630988d93e))
* update model and name extension exports ([68b5191](https://github.com/zlliang/pi-packages/commit/68b51916c89717ac26ccafb863d420d16dd0423c))


### Documentation

* **pi-credits:** polish README and metadata ([8a7aef9](https://github.com/zlliang/pi-packages/commit/8a7aef91ebdac2bdbdd6d38a69d9e72a8a520e61))
* **pi-credits:** simplify description ([4e5fc7e](https://github.com/zlliang/pi-packages/commit/4e5fc7e7d27539212ad228ece09079fbef3b2614))
* **pi-spark:** polish README and metadata ([382de1a](https://github.com/zlliang/pi-packages/commit/382de1aeaa48de7d874d088cba60b6ff1e60d42d))
* **pi-spark:** simplify description ([ede2299](https://github.com/zlliang/pi-packages/commit/ede2299cee377401c066bd76d8e795c9f96d4f1d))


### Styles

* **name:** use complete sentences in tool prose ([3430899](https://github.com/zlliang/pi-packages/commit/343089946f685b70c1bcda0291cf511f536a0711))


### Miscellaneous Chores

* bump to 0.10.1 ([14a7b3d](https://github.com/zlliang/pi-packages/commit/14a7b3dc56d329095e478d0e0e1979a177bb1cfe))
* **pi-credits:** release 0.3.2 ([9442600](https://github.com/zlliang/pi-packages/commit/944260098df9cdb7dfa963f379516fc67dbce328))
* **pi-credits:** release 0.3.4 ([b9879b9](https://github.com/zlliang/pi-packages/commit/b9879b9b47323e2db045c579ebd2f71f9a924c33))
* **pi-credits:** release 0.4.0 ([979b3ef](https://github.com/zlliang/pi-packages/commit/979b3efeda83378d4e16c93d4b33def5c2c65556))
* **pi-spark:** release 0.10.3 ([c253364](https://github.com/zlliang/pi-packages/commit/c2533641a4c9fe3b91ad6d0a52077d65036a95f0))
* **pi-spark:** release 0.11.0 ([c5124d4](https://github.com/zlliang/pi-packages/commit/c5124d4070c7caa96e0e1fc37e0a23b45232e38c))
* release 0.2.1 ([d296d5d](https://github.com/zlliang/pi-packages/commit/d296d5de0eb890b1f9c10dd5edd7343224a58819))


### Code Refactoring

* adjust set-session-name reason handling ([6d1b0b8](https://github.com/zlliang/pi-packages/commit/6d1b0b8ba3859b0a8b991758f01582caf65d6c8c))
* **editor:** show preset name in bold without prefix ([79a5fe2](https://github.com/zlliang/pi-packages/commit/79a5fe2910647094503bca9ccbc69326c6ade12a))
* fold pi-credits into pi-spark and revert to single package ([3a1cbe3](https://github.com/zlliang/pi-packages/commit/3a1cbe360feeab02a1d8b8313eaf6b06b4f8d400))
* remove trust-all extension ([2a783f9](https://github.com/zlliang/pi-packages/commit/2a783f9d3aa3031f0c204b047546c8f5d1aa6728))
* rename session naming tool ([49f8502](https://github.com/zlliang/pi-packages/commit/49f850226a175e280b0337f96fbaa649276d1153))

## [0.11.2](https://github.com/zlliang/pi-spark/compare/v0.11.1...v0.11.2) (2026-06-13)


### Documentation

* **pi-spark:** simplify description ([ede2299](https://github.com/zlliang/pi-spark/commit/ede2299cee377401c066bd76d8e795c9f96d4f1d))

## [0.11.1](https://github.com/zlliang/pi-spark/compare/v0.11.0...v0.11.1) (2026-06-13)


### Documentation

* **pi-spark:** polish README and metadata ([382de1a](https://github.com/zlliang/pi-spark/commit/382de1aeaa48de7d874d088cba60b6ff1e60d42d))

## [0.11.0](https://github.com/zlliang/pi-spark/compare/v0.10.5...v0.11.0) (2026-06-13)


### Miscellaneous Chores

* **pi-spark:** release 0.11.0 ([c5124d4](https://github.com/zlliang/pi-spark/commit/c5124d4070c7caa96e0e1fc37e0a23b45232e38c))

## [0.10.5](https://github.com/zlliang/pi-spark/compare/v0.10.4...v0.10.5) (2026-06-13)


### Bug Fixes

* **pi-spark:** reassert clearOnShrink each render in fullscreen ([55604b5](https://github.com/zlliang/pi-spark/commit/55604b59742b5300ef80102f9fbc3fc1c7a798cd))

## [0.10.4](https://github.com/zlliang/pi-spark/compare/v0.10.3...v0.10.4) (2026-06-13)


### Bug Fixes

* add npm package homepage metadata ([9ff2e39](https://github.com/zlliang/pi-spark/commit/9ff2e39d609c3c0a39c45a6c6b456bde964fbaa8))

## [0.10.3](https://github.com/zlliang/pi-spark/compare/v0.10.2...v0.10.3) (2026-06-13)


### Miscellaneous Chores

* **pi-spark:** release 0.10.3 ([c253364](https://github.com/zlliang/pi-spark/commit/c2533641a4c9fe3b91ad6d0a52077d65036a95f0))

## [0.10.2](https://github.com/zlliang/pi-spark/compare/v0.10.1...v0.10.2) (2026-06-13)


### Bug Fixes

* simplify cost display ([4990a57](https://github.com/zlliang/pi-spark/commit/4990a57fd9688929e115d64121a009630988d93e))

## [0.10.1](https://github.com/zlliang/pi-spark/compare/v0.10.0...v0.10.1) (2026-06-13)


### Miscellaneous Chores

* bump to 0.10.1 ([14a7b3d](https://github.com/zlliang/pi-spark/commit/14a7b3dc56d329095e478d0e0e1979a177bb1cfe))

## [0.10.0](https://github.com/zlliang/pi-spark/compare/v0.9.5...v0.10.0) (2026-06-13)


### ⚠ BREAKING CHANGES

* **models:** the model tool's "current" action is renamed to "active", and the scope/provider/model params are replaced by "query".

### Features

* **models:** filter model lists with Liqe queries ([877479b](https://github.com/zlliang/pi-spark/commit/877479b51a715b7a5a05381b207ecd03837e433d))


### Styles

* **name:** use complete sentences in tool prose ([3430899](https://github.com/zlliang/pi-spark/commit/343089946f685b70c1bcda0291cf511f536a0711))

## [0.9.5](https://github.com/zlliang/pi-spark/compare/v0.9.4...v0.9.5) (2026-06-12)


### Bug Fixes

* **models:** keep unavailable model labels visible ([feab815](https://github.com/zlliang/pi-spark/commit/feab8159210033ad362a4951e835247e28325063))

## [0.9.4](https://github.com/zlliang/pi-spark/compare/v0.9.3...v0.9.4) (2026-06-12)


### Bug Fixes

* **models:** expose unavailable models by scope ([8df5053](https://github.com/zlliang/pi-spark/commit/8df5053b1b92aaa78a366088b9414e7f197c4072))

## [0.9.3](https://github.com/zlliang/pi-spark/compare/v0.9.2...v0.9.3) (2026-06-12)


### Bug Fixes

* **models:** align action description order ([3de17c1](https://github.com/zlliang/pi-spark/commit/3de17c1d5f341eeb8673c70060a8dcb8febe8f5c))
* update model and name extension exports ([68b5191](https://github.com/zlliang/pi-spark/commit/68b51916c89717ac26ccafb863d420d16dd0423c))

## [0.9.2](https://github.com/zlliang/pi-spark/compare/v0.9.1...v0.9.2) (2026-06-12)


### Bug Fixes

* **models:** show expand hint in model tool call ([a7ac029](https://github.com/zlliang/pi-spark/commit/a7ac02943e0621e04093c5cc0a81a192fe440801))

## [0.9.1](https://github.com/zlliang/pi-spark/compare/v0.9.0...v0.9.1) (2026-06-12)


### Bug Fixes

* **models:** polish model tool prompt guideline ([eb01e6b](https://github.com/zlliang/pi-spark/commit/eb01e6b5a3b5dd180d32b9a9c8e06e4b90f42036))

## [0.9.0](https://github.com/zlliang/pi-spark/compare/v0.8.0...v0.9.0) (2026-06-12)


### Features

* **models:** add model inspection tool ([4d2625e](https://github.com/zlliang/pi-spark/commit/4d2625e2e2bd2e5637c50e563efff7b271a5a21d))

## [0.8.0](https://github.com/zlliang/pi-spark/compare/v0.7.0...v0.8.0) (2026-06-10)


### Features

* **credits:** generalize codex-usage into multi-provider credits ([84ffc8e](https://github.com/zlliang/pi-spark/commit/84ffc8e25256619a6b82759095be554433de15d0))
* move credits extension to the dedicated pi-credits package ([2d1e868](https://github.com/zlliang/pi-spark/commit/2d1e868f2c541c3707c9564ccdedaf80f40a7be5))

## [0.7.0](https://github.com/zlliang/pi-spark/compare/v0.6.3...v0.7.0) (2026-06-10)


### Code Refactoring

* remove trust-all extension ([2a783f9](https://github.com/zlliang/pi-spark/commit/2a783f9d3aa3031f0c204b047546c8f5d1aa6728))

## [0.6.3](https://github.com/zlliang/pi-spark/compare/v0.6.2...v0.6.3) (2026-06-09)


### Code Refactoring

* rename session naming tool ([49f8502](https://github.com/zlliang/pi-spark/commit/49f850226a175e280b0337f96fbaa649276d1153))

## [0.6.2](https://github.com/zlliang/pi-spark/compare/v0.6.1...v0.6.2) (2026-06-09)


### Code Refactoring

* adjust set-session-name reason handling ([6d1b0b8](https://github.com/zlliang/pi-spark/commit/6d1b0b8ba3859b0a8b991758f01582caf65d6c8c))

## [0.6.1](https://github.com/zlliang/pi-spark/compare/v0.6.0...v0.6.1) (2026-06-09)


### Code Refactoring

* **editor:** show preset name in bold without prefix ([79a5fe2](https://github.com/zlliang/pi-spark/commit/79a5fe2910647094503bca9ccbc69326c6ade12a))

## [0.6.0](https://github.com/zlliang/pi-spark/compare/v0.5.2...v0.6.0) (2026-06-09)


### Features

* add trust-all extension ([2784e47](https://github.com/zlliang/pi-spark/commit/2784e4719689280029864c45455bdac1d515669a))
* **codex-usage:** refresh after usage events ([bc53364](https://github.com/zlliang/pi-spark/commit/bc533646d085966376278ec6672b7d51d11c3e2d))
* **editor:** add pulse spinner preset ([9033de9](https://github.com/zlliang/pi-spark/commit/9033de9552630b16481dcb37aa9556bd37ab1bc7))

## [0.5.2](https://github.com/zlliang/pi-spark/compare/v0.5.1...v0.5.2) (2026-06-08)


### Bug Fixes

* **codex-usage:** round status percentages ([a641329](https://github.com/zlliang/pi-spark/commit/a64132919bd99d67d2dd039206ab80a41cfab720))

## [0.5.1](https://github.com/zlliang/pi-spark/compare/v0.5.0...v0.5.1) (2026-06-08)


### Bug Fixes

* **codex-usage:** polish usage error message ([99edccf](https://github.com/zlliang/pi-spark/commit/99edccf6d19b3fdb334414b46f59a25d542bc03d))

## [0.5.0](https://github.com/zlliang/pi-spark/compare/v0.4.0...v0.5.0) (2026-06-08)


### Features

* **codex-usage:** add Codex rate-limit usage status ([6778581](https://github.com/zlliang/pi-spark/commit/67785818e3cb2304b16b1feaf1dfb58520cb1542))

## [0.4.0](https://github.com/zlliang/pi-spark/compare/v0.3.1...v0.4.0) (2026-06-08)


### Features

* **set-session-name:** add session naming tool ([bc60e90](https://github.com/zlliang/pi-spark/commit/bc60e9049e17e1b82fc0d936731235f2bd4e94dd))

## [0.3.1](https://github.com/zlliang/pi-spark/compare/v0.3.0...v0.3.1) (2026-06-08)


### Bug Fixes

* **fullscreen:** keep clearOnShrink enabled across reload ([e1adde0](https://github.com/zlliang/pi-spark/commit/e1adde0eca052319dd9231f6e22456ae33109289))

## [0.3.0](https://github.com/zlliang/pi-spark/compare/v0.2.1...v0.3.0) (2026-06-06)


### Features

* **footer:** shorten cwd display ([8ae3525](https://github.com/zlliang/pi-spark/commit/8ae3525af6311de94c4b85f07e3f9c6df5369011))
* **fullscreen:** clear session on exit ([b48b997](https://github.com/zlliang/pi-spark/commit/b48b9972365da5c24d2f90f36d1ba0e945d87e94))


### Bug Fixes

* **fullscreen:** style exit session label ([b7fcd80](https://github.com/zlliang/pi-spark/commit/b7fcd80113e52efd6c46bcd617c3c0520fcb2fb0))

## [0.2.1](https://github.com/zlliang/pi-spark/compare/v0.2.0...v0.2.1) (2026-06-04)


### Miscellaneous Chores

* release 0.2.1 ([d296d5d](https://github.com/zlliang/pi-spark/commit/d296d5de0eb890b1f9c10dd5edd7343224a58819))

## [0.2.0](https://github.com/zlliang/pi-spark/compare/v0.1.2...v0.2.0) (2026-06-04)


### Features

* **editor:** show working status in border ([b72b127](https://github.com/zlliang/pi-spark/commit/b72b12738b209bb3016009c88e2efd1544d770f6))
* **footer:** include statuses in main line ([93a18de](https://github.com/zlliang/pi-spark/commit/93a18de6fbd53e7751dbecb01f9efa7b954d8bdf))
* **presets:** support preset CLI flag ([435c164](https://github.com/zlliang/pi-spark/commit/435c164b61ce231074fdbdee636d45af1845bebf))


### Bug Fixes

* **editor:** clear tool status after executions ([780395f](https://github.com/zlliang/pi-spark/commit/780395f79e078dd7c4af596f5dd66b344ce3ef34))
* **editor:** track running tools by call id ([72fbe37](https://github.com/zlliang/pi-spark/commit/72fbe370995296988bcd3100d2c25721b08af62b))

## [0.1.2](https://github.com/zlliang/pi-spark/compare/v0.1.1...v0.1.2) (2026-06-03)


### Bug Fixes

* **editor:** add tildes spinner preset ([523f6fc](https://github.com/zlliang/pi-spark/commit/523f6fcd982455fbfe202982c5dfb7a62590b6dd))

## [0.1.1](https://github.com/zlliang/pi-spark/compare/v0.1.0...v0.1.1) (2026-06-02)


### Miscellaneous Chores

* release 0.1.1 ([09bfd96](https://github.com/zlliang/pi-spark/commit/09bfd96eec21dc9467bbbf10946bc5bb9cf858f7))

## [0.1.0](https://github.com/zlliang/pi-spark/releases/tag/v0.1.0) (2026-06-02)

Initial release of pi-spark, including the Editor, Footer, Fullscreen, Presets, and Recap extensions, plus shared TUI components and spark configuration support.
