# Delta for access-lock

Gating of protected content by the local access PIN: nothing behind the lock is rendered until a PIN is verified, and the unlocked state lasts only as long as the current page session. This is a casual-access barrier, not protection against a user with developer tools.

## ADDED Requirements

### Requirement: Lock-gated startup

The app MUST render protected content only after a successful PIN verification when a PIN credential is configured. When no credential is configured, the app MUST open without asking for one.

#### Scenario: Configured PIN gates protected content at startup

- GIVEN a PIN credential is configured on this device
- WHEN the app loads
- THEN the lock screen is displayed instead of protected content
- AND no financial data is rendered until verification succeeds

#### Scenario: Successful verification reveals protected content

- GIVEN the lock screen is displayed and the correct PIN is known
- WHEN the user submits the correct PIN
- THEN protected content is rendered
- AND the lock screen is no longer displayed

#### Scenario: No credential configured opens normally

- GIVEN no PIN credential is configured on this device
- WHEN the app loads
- THEN protected content is rendered directly
- AND no lock screen is displayed

### Requirement: Unlock state does not outlive the page session

An unlocked state MUST NOT survive a reload, MUST NOT be readable or writable from any storage the page can reach, and MUST NOT be granted by pre-existing stored values.

#### Scenario: Reload locks the app again

- GIVEN the user unlocked the app earlier in this session
- WHEN the page reloads
- THEN the lock screen is displayed again
- AND protected content is not rendered before verification

#### Scenario: Pre-seeded stored flags do not unlock

- GIVEN a PIN credential is configured
- WHEN the page loads with stored values that appear to mark the app as already unlocked
- THEN the lock screen is still displayed
- AND protected content is not rendered

### Requirement: Fail closed without storage

When persistent storage is unavailable or unusable, the app MUST NOT render protected content; it MUST present the lock screen instead.

#### Scenario: Unavailable storage shows the lock screen

- GIVEN persistent storage is unavailable or unusable
- WHEN the app loads
- THEN the lock screen is displayed
- AND protected content is not rendered

#### Scenario: A failed verification keeps protected content hidden

- GIVEN the lock screen is displayed
- WHEN verification does not complete successfully
- THEN protected content remains hidden
- AND the lock screen stays available
