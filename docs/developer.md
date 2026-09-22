# Developer guide

This guide covers setting up a local development environment for migrid-ux,
the main Make targets, the repository layout, and an overview of the
continuous integration setup.

## Prerequisites

- Python 3.9 or later (This is dictated by the underlying docker-migrid/migrid-sync that utilizes this package)
- GNU `parallel` (required by `make local`)

## Bringup

A basic bringup is handled by the Makefile:

```sh
$ make local
```

This installs the necessary dependencies for local development, provisions a
virtual environment, and starts a local web server and a fake backend
intended to support rapid iteration. The application is then accessible at
`http://localhost:8880`

## Make targets

The Makefile contains a number of targets to support development.
These include the following:

| Target | Description |
| --- | --- |
| `test` | Run the test suite |
| `lint` | Run all linters (JavaScript and Python) |
| `lint-js` | Lint the JavaScript sources |
| `lint-py` | Lint the Python sources (black, isort, pylint) |
| `fmt` | Format all sources (JavaScript and Python) |
| `build` | Build the distributable package |
| `dist` | Build and commit a release |
| `patch,minor,major` | uses `dist` to release patch/minor/major versions |
| `coverage` | Run the test suite with coverage reporting |

## Project layout

- `migux/` — the Flask applications and their packaged public assets
- `devserver/` — the fake backend used for local development
- `lib/` — the browser runtime: `observable.js`, `binding.js`, `state.js`,
  `app.js`
- `public/` — static assets served by the local web server
- `src/` — SCSS sources and shared components
- `envhelp/` — the provisioned toolchain (virtual environment, node, scripts)

## Continuous integration

The CI workflow (`.github/workflows/ci.yml`) runs the following jobs on every
push and pull request:

- **Lint JavaScript** — npm-based linting of the JavaScript sources
- **Lint Python** — black, isort and pylint over the Python sources
- **Test on latest node** — the JavaScript test suite
- **Build docs** — builds the Sphinx documentation
