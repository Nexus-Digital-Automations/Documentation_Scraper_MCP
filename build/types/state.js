// ============================================================================
// MODULE: types/state.ts
//
// PURPOSE:
// Comprehensive state management interfaces for progress saving and resuming.
// Defines TypeScript interfaces for saving scraping progress during interruptions
// and resuming operations from saved state.
//
// DEPENDENCIES:
// - None (pure type definitions)
//
// EXPECTED INTERFACES:
// - Progress state interfaces for URL discovery and content scraping
// - Rate limiter and proxy manager state interfaces
// - State serialization and deserialization support
//
// DESIGN PATTERNS:
// - Interface segregation for different engine state types
// - Version-based state schema for future migrations
// - Serializable state design for JSON persistence
//
// SYSTEM INVARIANTS:
// - All state must be serializable to JSON
// - State versions must be tracked for schema migrations
// - State must include sufficient context for resumption
// ============================================================================
export {};
//# sourceMappingURL=state.js.map