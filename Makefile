BINARY_NAME=lens

all: build

dev:
	npm run dev

build:
	npm run build


start:
	node dist/cli.js

install: build
	npm install -g .

clean:
	rm -rf dist

release-patch:
	npm run release:patch

release-minor:
	npm run release:minor

release-major:
	npm run release:major

.PHONY: all dev build start install clean release-patch release-minor release-major
