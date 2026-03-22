# [1.1.0](https://github.com/gi4nks/lens/compare/v1.0.1...v1.1.0) (2026-03-22)


### Features

* add /output command to browse command output from DB ([1ba0260](https://github.com/gi4nks/lens/commit/1ba0260cfd275ee0b3b15fc3695b537b1fb4690e))
* add SQLite persistence layer for command history ([91f088d](https://github.com/gi4nks/lens/commit/91f088d9521761aa39c203a346ac96397d387bf4))
* command-aware output renderer with file type colors ([69474a8](https://github.com/gi4nks/lens/commit/69474a8954c16db0b96eda0d61fb4dd0c24767f1))
* interactive shell improvements and OSC header bug fix ([695e878](https://github.com/gi4nks/lens/commit/695e878612bf9c55a078d4750ee5e8edf9f24313))

## [1.0.1](https://github.com/gi4nks/lens/compare/v1.0.0...v1.0.1) (2026-03-22)


### Bug Fixes

* use --force in Makefile install target to overwrite existing binary ([0e84f85](https://github.com/gi4nks/lens/commit/0e84f85216ede7a95f26a69ac427aab030726c13))

# 1.0.0 (2026-03-22)


### Bug Fixes

* add packages permission and build step to release workflow ([a34e136](https://github.com/gi4nks/lens/commit/a34e136c02a8ae618c3109cd327d3b4659890812))
* repair package.json syntax error ([5ee198b](https://github.com/gi4nks/lens/commit/5ee198b79e6859a4135cf8170fdf3af463ad2420))


### Features

* add quick tips section to README ([6069127](https://github.com/gi4nks/lens/commit/6069127d6a12d513e49232d53eed926851893ca7))
* initial commit with lens shell core, ignore tool-generated files, and remove ConfigMigrator ([61b73e9](https://github.com/gi4nks/lens/commit/61b73e974924b9fe2fd44b64e1d9d81fc7f99d31))

# [1.1.0](https://github.com/gi4nks/lens/compare/v1.0.0...v1.1.0) (2026-03-22)


### Bug Fixes

* add packages permission and build step to release workflow ([a34e136](https://github.com/gi4nks/lens/commit/a34e136c02a8ae618c3109cd327d3b4659890812))
* repair package.json syntax error ([5ee198b](https://github.com/gi4nks/lens/commit/5ee198b79e6859a4135cf8170fdf3af463ad2420))


### Features

* add quick tips section to README ([6069127](https://github.com/gi4nks/lens/commit/6069127d6a12d513e49232d53eed926851893ca7))

## [1.1.1](https://github.com/gi4nks/lens/compare/v1.1.0...v1.1.1) (2026-03-22)


### Bug Fixes

* add packages permission and build step to release workflow ([48123fc](https://github.com/gi4nks/lens/commit/48123fc629736bbfeca1cc2eef9585861d1e7dd3))

# [1.1.0](https://github.com/gi4nks/lens/compare/v1.0.0...v1.1.0) (2026-03-22)


### Bug Fixes

* repair package.json syntax error ([186e6ac](https://github.com/gi4nks/lens/commit/186e6aca7ba3fd2ba2a9c8285cfa9adad6f5c7d9))


### Features

* add quick tips section to README ([b1629f5](https://github.com/gi4nks/lens/commit/b1629f53e3f911500418af0739b7fc89f2a3cd14))

# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-21

### Added
- **Multi-Shell Support**: Full support for Bash and Fish (in addition to Zsh) for tracking CWD and exit codes.
- **Seamless Fix**: Automatic correction of failed commands using AI with quick key `F`.
- **New Theme System**: Dynamic themes (`Ocean`, `Forest`, `Sunset`) affecting the entire interface.
- **TUI Configurator**: Unified configuration dashboard on a single page for quick settings.
- **Slash Commands**: Quick commands `/model`, `/theme`, `/provider` for immediate configuration without menus.
- **Semantic Versioning**: Infrastructure for versioning and display in the header.

### Fixed
- **UI Bug (Tab Cycling)**: Fixed the issue that reset the suggestions selection during Tab completion.
- **Orchestration Engine Robustness**: Improved parsing of multi-step AI plans with JSON and Markdown support.

### Security
- **Safety Checker**: Advanced protection against dangerous commands (rm -rf, etc.) with confirmation prompt.
