# pin-credential Specification

## Purpose

Local access-PIN lifecycle: derived salted storage, legacy upgrade, throttling, backup containment.

## Requirements

### Requirement: Derived, salted, self-describing credential

A stored PIN credential MUST be a PBKDF2-SHA256 derivation of the PIN over a per-store random salt, and MUST record in the stored value the derivation algorithm and the iteration count together with the salt and the derived value. The PIN MUST NOT be stored in, or recoverable from, that value.

#### Scenario: Setting a PIN stores a derived, self-describing credential

- GIVEN no credential is configured
- WHEN the user sets a PIN
- THEN the stored value names the algorithm and iteration count and carries a salt
- AND the entered PIN does not appear in it

#### Scenario: Each store gets its own salt

- GIVEN the same PIN set on two independent stores
- WHEN the stored credentials are compared
- THEN the values differ
- AND each store verifies only its own PIN

#### Scenario: Verification accepts the right PIN only

- GIVEN a credential is configured
- WHEN the correct PIN is submitted
- THEN verification succeeds
- AND an incorrect PIN fails verification

### Requirement: Transparent legacy upgrade

A credential stored by an earlier non-derived scheme MUST stay verifiable, and MUST be re-stored in the derived format once it verifies successfully, with no extra user-visible step.

#### Scenario: Successful legacy verification upgrades the credential

- GIVEN a legacy-format credential stored for the current PIN
- WHEN the correct PIN is submitted
- THEN the unlock succeeds
- AND the stored credential is now in the derived format

#### Scenario: Failed legacy verification leaves it untouched

- GIVEN a legacy-format credential is stored
- WHEN an incorrect PIN is submitted
- THEN the unlock is denied
- AND the credential is unchanged

### Requirement: Throttled verification with visible countdown

After consecutive failed attempts the app MUST make the unlock action unavailable for an escalating delay, MUST show a visible Spanish countdown of the remaining wait, and MUST clear the penalty on success.

#### Scenario: Repeated failures escalate the wait with a Spanish countdown

- GIVEN one failed attempt is recorded
- WHEN further incorrect PINs are submitted
- THEN each failure lengthens the wait before the next attempt
- AND a Spanish countdown of the remaining seconds is visible

#### Scenario: Successful verification clears the penalty

- GIVEN a penalty has elapsed
- WHEN the correct PIN is submitted
- THEN the unlock succeeds
- AND the next failure starts at the shortest delay

### Requirement: Credential containment in backups

Exported backup data MUST contain neither the PIN credential nor its salt; imported backup data MUST NOT replace the receiving device's credential.

#### Scenario: Export omits credential material

- GIVEN a credential is configured
- WHEN a backup is exported
- THEN it holds no credential value and no salt
- AND the other exported settings are unchanged

#### Scenario: Import never replaces the local credential

- GIVEN an imported backup carries credential material
- WHEN the import completes
- THEN the device keeps its own credential
- AND only the device's own PIN unlocks

### Requirement: Derivation and lock flows verifiable in the existing test setup

The derivation path and lock flows MUST be reachable from component and unit tests through a documented seam in the code's structure, so both are exercisable in the existing vitest jsdom environment where the platform derivation primitive may be absent, without weakening the production path. Tests MUST be added without modifying `src/test/setup.ts` or `vite.config.ts`, and all 56 pre-existing tests MUST keep passing.

#### Scenario: Derivation is exercised in the jsdom environment

- GIVEN the jsdom setup, where the platform primitive may be absent
- WHEN a component or unit test exercises derivation and verification
- THEN both run through the documented seam and yield verifiable results
- AND production keeps using the real platform derivation

#### Scenario: Pre-existing suite stays green, configuration untouched

- GIVEN the 56 pre-existing tests and the current configuration
- WHEN the full suite runs after the change
- THEN the pre-existing and new tests all pass
- AND the shared setup and runner config are unmodified
