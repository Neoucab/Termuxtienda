# ci-pipeline Specification

## Purpose

CI gating on push to `main` and pull requests: install, typecheck, full test suite, and production build, in order, on pinned Node 22; a failing gate turns the run red.

## Requirements

### Requirement: Push and pull request gating

Every push to `main` and every pull request MUST run `npm ci`, typecheck, test, and build in that order. A failed gate MUST fail the run; later gates MUST NOT execute.

#### Scenario: Push to main runs the chain

- GIVEN a commit is pushed to `main`
- WHEN the push is processed
- THEN all four gates run in order
- AND it ends green when every gate passes

#### Scenario: Pull request runs the same chain

- GIVEN a pull request opens or gains a commit
- WHEN its run executes
- THEN the same four gates run on the PR
- AND a failed gate shows as a failed PR check

#### Scenario: Failed gate stops the chain

- GIVEN a push whose test gate fails
- WHEN the run executes
- THEN the run ends red with the build gate skipped

### Requirement: Pinned toolchain with npm cache

Runs MUST execute on GitHub-hosted Ubuntu runners under Node 22, reusing the npm cache across runs; installation MUST come from the committed lockfile.

#### Scenario: Runs report Node 22

- GIVEN a run executes
- WHEN its toolchain setup completes
- THEN the run log reports Node 22.x

#### Scenario: Cache warms on later runs

- GIVEN no npm cache exists yet
- WHEN the first run executes
- THEN install completes cold from the lockfile
- AND a later run's log records the cache restore

### Requirement: Superseded-run cancellation

A run superseded by a newer run for the same ref MUST be cancelled; runs for different refs MUST NOT cancel each other.

#### Scenario: Superseded run is cancelled

- GIVEN a run is in progress for a ref
- WHEN a newer run starts for the same ref
- THEN the earlier run shows as cancelled

#### Scenario: Other refs unaffected

- GIVEN runs are in progress for `main` and for a pull request
- WHEN both execute
- THEN neither run cancels the other

### Requirement: Workflow-only footprint with zero dependencies

The change MUST add or modify only `.github/workflows/ci.yml`; `package.json`, `src/`, and `convex/` MUST remain byte-unchanged, with no dependency or lockfile change.

#### Scenario: Diff touches only the workflow file

- GIVEN the change is applied
- WHEN the diff against its parent commit is inspected
- THEN the only added or modified path is `.github/workflows/ci.yml`
- AND `package.json`, `src/`, and `convex/` show no byte-level change

#### Scenario: No lockfile drift

- GIVEN the change is applied
- WHEN `npm ci` runs against the committed lockfile
- THEN it completes without modifying `package.json` or `package-lock.json`

### Requirement: Proven gates: green at HEAD, red on broken typecheck

The gates MUST be proven both ways: a run at clean `main` HEAD MUST pass every gate, and a throwaway PR branch with a deliberate type error MUST go red at typecheck. The proof branch MUST be reverted or closed without reaching `main`.

#### Scenario: Green run at clean HEAD

- GIVEN the change commit is `HEAD` of `main`
- WHEN its run completes
- THEN the run is green with all four gates passed

#### Scenario: Broken typecheck turns a run red

- GIVEN a throwaway branch whose only change is a type error
- WHEN its PR run executes
- THEN the typecheck gate fails and the run ends red
- AND test and build do not pass

#### Scenario: Proof never reaches main

- GIVEN the red run is captured
- WHEN the proof branch is reverted and its PR closed
- THEN `main` holds no commit from the proof branch
- AND a fresh run at `main` is green
