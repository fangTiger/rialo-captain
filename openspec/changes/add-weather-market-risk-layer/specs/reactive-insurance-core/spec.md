## ADDED Requirements
### Requirement: Weather and market signals do not alter settlement

Weather risk and prediction market odds SHALL remain contextual signals in the MVP. They MUST NOT alter policy creation semantics, claim trigger thresholds, payout calculations, user balances, evidence integrity, or ClaimEngine settlement decisions.

#### Scenario: Weather overlay does not trigger claim settlement
- **GIVEN** a user enables or disables the weather layer
- **WHEN** the selected flight is below the configured delay threshold
- **THEN** no claim is created because of weather visibility or weather pressure alone
- **AND** the policy remains governed by the existing delay condition

#### Scenario: Prediction odds do not create market trades
- **GIVEN** prediction market odds are displayed for a flight
- **WHEN** the user views the odds HUD
- **THEN** no trade, order, market position, policy, claim, or balance mutation is created
- **AND** the UI labels the values as read-only market signal

#### Scenario: Evidence timeline remains factual
- **GIVEN** a policy later settles from an actual delay
- **WHEN** the user opens the evidence timeline
- **THEN** weather and market data may be presented only as contextual explanation if implemented
- **AND** settlement evidence remains based on observed flight delay and contract condition events
