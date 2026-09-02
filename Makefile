# --- BEGIN_HEADER ---
#
# Makefile - dual licensed source code file
# Copyright (C) 2025 - 2026  SCIENCE HPC Center at UCPH
#
# This file is part of MiGrid-UX.
#
# MiGrid-UX is free software: you can redistribute it and/or modify it under
# the terms of either
# the MIT License (LICENSES/LICENSE.MIT or https://opensource.org/licenses/MIT)
# OR
# the GNU General Public License version 2 (LICENSES/LICENSE.GPLv2 or
# https://opensource.org/license/gpl-2.0) or any later version
# at your option. The MiGrid-UX files may NOT be copied, modified, or
# distributed except according to those terms.
#
# --- END_HEADER ---

.PHONY: info
info:
	@echo "Welcome to MiGrid UX"
	@echo
	@echo "The following should help you get started:"
	@echo
	@echo "'make test'      - run the test suite"
	@echo "'make local'	- run the local development setup"
	@echo "                   accessible at http://localhost:8880/"

LOCAL_PYTHON_BIN = './envhelp/lpython'
NPM_BIN = './envhelp/npm'
NVM_VERSION = '0.40.5'

.PHONY: build
build: development
	./envhelp/venv/bin/python -m build -q

.PHONY: clean
clean:
	@rm -f ./envhelp/local.depends
	@rm -f ./envhelp/dev-requirements.depends
	@rm -f ./envhelp/test-requirements.depends
	@rm -rf ./envhelp/venv
	@rm -rf ./envhelp/nvm
	@rm -rf ./envhelp/output
	@rm -rf ./envhelp/staging
	@rm -rf ./public/build
	@rm -rf ./node_modules
	@rm -rf ./coverage
	@rm -rf ./migux.egg-info

.PHONY: coverage
coverage:
	$(NPM_BIN) run coverage
	@echo "coverage report written to ./coverage"

.PHONY: major
major:
	BUMP=major make dist

.PHONY: minor
minor:
	BUMP=minor make dist

.PHONY: patch
patch:
	BUMP=patch make dist

.PHONY: dist
dist: ./envhelp/local.depends
	$(eval VERSION = $(shell ./envhelp/lpython ./envhelp/scripts/dist_version.py $(BUMP)))
	@if [ -z "$(VERSION)" ]; then exit 1; fi
	make build
	git add .
	git commit -m "Release $(VERSION)"

.PHONY: test
test: ./envhelp/local.depends ./envhelp/test-requirements.depends
	$(NPM_BIN) test

.PHONY: build-css
build-css: ./envhelp/local.depends
	@mkdir -p ./public/build
	@echo "building stylesheets"
	@$(NPM_BIN) exec -- sass --quiet \
		./src/scss/reset.scss:./public/build/reset.css \
		./src/scss/main.scss:./public/build/main.css \
		./src/components:./public/components \
		./src/apps/peers.scss:./migux/public/apps/migux/peers.css

.PHONY: development
development: ./envhelp/local.depends build-css

./envhelp/local.depends: ./envhelp/venv/pyvenv.cfg ./envhelp/nvm/nvm.sh
	@echo "installing development dependencies"
	@./envhelp/venv/bin/pip install -q -r requirements/local-requirements.txt
	@make ./node_modules/
	@touch ./envhelp/local.depends

./envhelp/dev-requirements.depends:
	@echo "installing development dependencies"
	@./envhelp/venv/bin/pip install -q -r requirements/dev-requirements.txt
	@touch ./envhelp/dev-requirements.depends

./envhelp/test-requirements.depends:
	@echo "installing test dependencies"
	@./envhelp/venv/bin/pip install -q -r requirements/test-requirements.txt
	@touch ./envhelp/test-requirements.depends

./envhelp/venv/pyvenv.cfg:
	@echo "provisioning environment"
	python3 -m venv ./envhelp/venv

./envhelp/nvm/nvm.sh: ./envhelp/venv/pyvenv.cfg
	@./envhelp/lpython ./envhelp/scripts/provision_npm.py $(NVM_VERSION)

./node_modules/:
	@echo "installing npm packages"
	@$(NPM_BIN) install

.PHONY: fmt
fmt: ./envhelp/local.depends
	make fmt-js
	make fmt-py

.PHONY: fmt-js
fmt-js:
	$(NPM_BIN) run fmt

.PHONY: fmt-py
fmt-py: ./envhelp/dev-requirements.depends
	@$(LOCAL_PYTHON_BIN) -m black .
	@$(LOCAL_PYTHON_BIN) -m isort .

.PHONY: lint
lint: ./envhelp/local.depends
	make lint-js
	make lint-py

.PHONY: lint-js
lint-js: ./envhelp/local.depends
	$(NPM_BIN) run lint

.PHONY: lint-py
lint-py: ./envhelp/local.depends ./envhelp/dev-requirements.depends
	@$(LOCAL_PYTHON_BIN) -m black . --check
	@$(LOCAL_PYTHON_BIN) -m isort . --check-only
	@$(LOCAL_PYTHON_BIN) -m pylint `find ./migux ./devserver -name '*.py'`

.PHONY: local__bail
local__bail:
	@echo "The GNU parallel utility was not detected therefore this"
	@echo "combination target cannot proceed. You can either install"
	@echo "the tool and retry, or run each of the following:"
	@echo "  make local-frontend"
	@echo "  make local-backend"
	@echo
	@echo "The result will be accessible at http://localhost:8880"
	@echo
	@exit 1

.PHONY: local
local: development
	@echo
	@which parallel 1>/dev/null || make local__bail
	@echo "Proceeding to start local frontend, dev backend and watching"
	@echo "the CSS source files for change."
	@echo
	@echo "The result will be accessible at http://localhost:8880"
	@parallel make ::: local-frontend local-backend watch-css

.PHONY: local-backend
local-backend: ./envhelp/local.depends
	./envhelp/venv/bin/python -m flask --app ./devserver/devserver.py run --port 8881

.PHONY: local-frontend
local-frontend: ./envhelp/local.depends
	./envhelp/lpython ./envhelp/scripts/serve_http.py

.PHONY: watch-css
watch-css: ./envhelp/local.depends
	@$(NPM_BIN) exec -- sass --watch \
		./src/scss/reset.scss:./public/build/reset.css \
		./src/scss/main.scss:./public/build/main.css \
		./src/components:./public/components \
		./src/apps/peers.scss:./migux/public/apps/migux/peers.css
