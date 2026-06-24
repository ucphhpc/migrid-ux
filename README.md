# migrid-ux

This repository contains a basic browser runtime enabling the construction of
dynamic web applications as HTML that is bound to an observable-based state.

Heavy inspiration is taken from older solutions to this problem, in particular
Knockout, but client side templating is omitted in favour favour of the use of
server-side rendering of HTML fragments which are handled in a fashion similar
to the more recent htmx.

## Basic principles

Applications are structured around a clean separation between their state, and
a rendered representation which is derived from the data contained within it.
The "data" backing an application, which we refer to as their [state](#state),
is _bound_ (see [binding](#binding)) to a the on-screen HTML markup.

### Handling of state

The state is represented as a series of observed values which signal when they
are changed. Such values is commonly referred to as [observables](#observable).
These values are grouped into [namespaces](#namespace) of related values, each
of which can be individually serialised on demand.

### Binding to observables

The HTML of the application is annotated with a series of binding attributes
which are processed and e.g. any required event handlers attached. As a user
interacts with the web page the values within the observables change, and any
programmatic changes to observables are reflected within the browser.

## Supporting modules

### lib/binding.mjs

This is responsible for wiring HTML markup to observables present in the state.

### lib/observable.mjs

Provides the basic observed value primitives.

### lib/state.mjs

Exposes both a type and a number of construction functions which can generate
and manage the observable values for a particular application based upon the
delcarative definition of required values specified by a given application.

## Usage

The repository is arranged to be consistent with migrid-sync and as such the
main functions are exposed via a Makefile at the top level. A basic bringup
involves running:

```sh
$ make local
```

Running the above will have the effect of installing and necessary dependencies
for local development and provisioning a virtual environment to allow the use
of a fake backend intended to support rapid iteration ruding development. As
a final step a local web server and local backend will be started, with the
application then being accessible at: `http://localhost:8880`

## Glossary

### binding

The process of attaching DOM elements to their respective observables.

### namespace

A grouping of observable values which are considered to be related.

### observable

An embellished value able to signal interested parties when it is changed.

### state

The complete set of observed values that represent an active application.

## Licensing

The source code is licensed under MIT. License is available [here](/LICENSE).
