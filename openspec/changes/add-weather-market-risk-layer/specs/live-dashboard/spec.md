## ADDED Requirements
### Requirement: Tower weather layer visibility switch

The Tower homepage SHALL provide a user-visible control that toggles the weather risk layer on and off without leaving `/`, remounting the cinema provider, opening the buy drawer, or changing the selected guided demo subject.

#### Scenario: Weather layer is visible by default
- **GIVEN** a logged-in user opens the Tower homepage
- **WHEN** the Tower renders live flight radar
- **THEN** the weather switch is visible in the Tower HUD
- **AND** the weather layer is visible by default
- **AND** the switch indicates the visible state

#### Scenario: User hides weather layer
- **GIVEN** the weather layer is visible on the Tower homepage
- **WHEN** the user toggles the weather switch off
- **THEN** the storm cells, pressure rings, and weather corridor are hidden
- **AND** the GlobeMap remains mounted
- **AND** the CinemaProvider remains mounted
- **AND** no policy purchase, claim, Copilot ask, or route navigation is triggered

#### Scenario: User shows weather layer again
- **GIVEN** the weather layer is hidden
- **WHEN** the user toggles the weather switch on
- **THEN** the weather layer returns over the existing globe viewport
- **AND** the current selected or protagonist flight remains highlighted

### Requirement: Cinematic weather risk overlay

The Tower globe SHALL render weather context as a global aviation weather forecast overlay when weather is enabled. The overlay SHALL cover the full world map with radar-like storm systems, frontal bands, and wind or pressure fields. A highlighted weather corridor MAY be added for the active Tower subject, but the base weather layer MUST remain global and visible across multiple regions regardless of which flight is focused.

#### Scenario: Global weather fields render across the world map
- **GIVEN** weather is enabled and at least one live flight is available
- **WHEN** GlobeMap renders
- **THEN** weather forecast systems render across multiple world regions
- **AND** the layer includes low, elevated, and severe pressure levels
- **AND** the layer includes broad forecast bands or fronts in addition to local cells
- **AND** the global weather fields do not depend on the active flight's longitude or latitude
- **AND** weather shapes do not intercept pointer events for flight dots or map gestures

#### Scenario: Weather layer remains global when active focus changes
- **GIVEN** weather is enabled
- **AND** the Tower active subject changes from one flight to another
- **WHEN** GlobeMap receives the updated risk signal
- **THEN** the base global weather systems keep stable ids and positions
- **AND** only the active weather corridor and market subject update for the newly focused flight

#### Scenario: Active flight receives a risk corridor
- **GIVEN** weather is enabled
- **AND** the Tower has a selected flight or protagonist highlight
- **WHEN** GlobeMap renders that active subject
- **THEN** a weather risk corridor is drawn for that flight
- **AND** the corridor visually distinguishes calm, elevated, and severe segments
- **AND** the selected flight remains clickable

#### Scenario: Reduced motion keeps the layer readable
- **GIVEN** the user prefers reduced motion
- **WHEN** the weather layer renders
- **THEN** motion effects are disabled or substantially reduced
- **AND** the layer remains visible through static shapes, opacity, and labels

### Requirement: Tower prediction market odds HUD

The Tower homepage SHALL display read-only prediction market odds for the active Tower subject. The HUD SHALL show market implied delay probability, market odds, Rialo/model probability, spread direction, and a concise insight.

#### Scenario: Market odds render for active subject
- **GIVEN** the Tower has a protagonist or selected flight
- **WHEN** the Tower risk HUD renders
- **THEN** it displays market odds such as `2.6x`
- **AND** it displays market implied delay probability
- **AND** it displays Rialo/model probability
- **AND** it displays a spread label comparing market and model views

#### Scenario: Market odds are read-only
- **GIVEN** the market odds HUD is visible
- **WHEN** the user clicks or toggles weather controls nearby
- **THEN** no order, trade, policy, claim, balance update, or backend mutation is created
- **AND** the HUD makes clear that odds are a market signal, not a settlement trigger

#### Scenario: No active subject uses overview odds
- **GIVEN** no selected flight or protagonist is available
- **WHEN** the Tower risk HUD renders
- **THEN** it displays overview market pressure for the current sky
- **AND** the UI remains stable without an empty or broken state

### Requirement: Risk signal provenance and forecast freshness

The Tower risk signal SHALL expose explicit provenance metadata for weather and prediction odds. When the MVP uses deterministic simulated data, the HUD SHALL label it as a simulated signal and show a forecast freshness window, model version, and confidence cue so users do not mistake the values for external market orders or settlement evidence.

#### Scenario: Simulated signal provenance is visible
- **GIVEN** the Tower risk HUD renders deterministic MVP data
- **WHEN** a user views the market odds panel
- **THEN** the panel labels the data source as simulated
- **AND** it displays the model version and a confidence cue
- **AND** it preserves the existing signal-only settlement boundary copy

#### Scenario: Forecast window keeps same-window weather stable
- **GIVEN** weather is enabled
- **WHEN** Tower risk signals are built multiple times inside the same forecast window
- **THEN** the base weather cells and forecast bands keep stable ids and positions
- **AND** the active corridor may update only when the active subject changes

#### Scenario: Forecast window advances weather context
- **GIVEN** weather is enabled
- **WHEN** the forecast window advances
- **THEN** the base weather cells or forecast bands drift deterministically
- **AND** the HUD exposes the new forecast window metadata

#### Scenario: Corridor pressure follows weather context
- **GIVEN** an active Tower subject has coordinates
- **WHEN** the weather risk corridor is generated
- **THEN** each corridor segment level is derived from nearby weather cells or forecast bands
- **AND** the corridor is not forced to always contain low, elevated, and severe segments
