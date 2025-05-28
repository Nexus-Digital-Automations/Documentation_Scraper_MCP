# Architecture: Documentation Scraper MCP Server

**Author:** Jeremy Parker  
**Creation Date:** May 27, 2025  
**Last Updated:** May 27, 2025

## System Overview

The Documentation Scraper MCP Server is a comprehensive FastMCP TypeScript implementation that preserves **ALL** functionality from two original Python modules while adding powerful MCP integration capabilities. This server provides intelligent website crawling, content extraction, and documentation scraping through a modern, type-safe TypeScript architecture.

### High-Level Architecture Diagram

```
Claude Desktop
    ↓ (MCP Protocol)
FastMCP Server (index.ts)
    ↓
Engine Layer
├── UrlDiscoveryEngine (Make URL File functionality)
└── ContentScrapingEngine (Scrape URL File functionality)
    ↓
Utility Layer
├── BrowserManager (Puppeteer management)
├── ContentExtractor (Text/PDF extraction)
├── UrlUtils (URL processing)
├── Logger (Comprehensive logging)
└── VpnManager (Optional VPN rotation)
    ↓
Configuration Layer
└── ScrapingConfig (Centralized settings)
```

### Key Components and Relationships

The system follows a layered architecture where:
- **MCP Layer**: Handles FastMCP protocol and Claude Desktop integration
- **Engine Layer**: Implements core business logic for URL discovery and content scraping  
- **Utility Layer**: Provides shared services for browser management, content processing, and logging
- **Configuration Layer**: Manages all system settings and validation

## Component Design

### 1. MCP Server Layer (src/index.ts)

**Status**: [In Progress] - Main structure exists, needs completion

**Purpose**: FastMCP server entry point providing MCP tools to Claude Desktop

**Key Functions**:
- `discover-urls`: Complete Make URL File functionality
- `scrape-urls`: Complete Scrape URL File functionality  
- `get-config`: View current configuration
- `update-config`: Modify settings dynamically
- `validate-config`: Check configuration validity
- `get-status`: System health monitoring
- `list-failed-urls`: View and manage failed operations

**Dependencies**: All engine and utility components

### 2. Engine Layer

#### UrlDiscoveryEngine (src/engines/urlDiscovery.ts)

**Status**: [In Progress] - Core structure exists, needs completion

**Purpose**: Implements complete "Make URL File" functionality with recursive website crawling

**Key Methods**:
- `discoverUrls()`: Main discovery orchestration
- `processUrl()`: Individual page processing with content extraction
- `autoScrollPage()`: Dynamic content loading via scrolling
- `clickToggleButtons()`: Expand collapsed content sections
- `generateUserAgent()`: User agent rotation for stealth browsing
- `shouldIncludeUrl()`: URL filtering and validation

**Features Preserved**:
- Recursive link discovery with configurable depth limits
- Smart URL normalization and deduplication
- Auto-scrolling for dynamic content loading
- Toggle button clicking for expanded content
- Language filtering with configurable confidence thresholds
- User agent rotation for stealth browsing
- Comprehensive logging with colored output
- Browser resource management and cleanup
- Concurrent processing with configurable limits
- Pattern-based URL filtering
- Text file output with organized directory structure

#### ContentScrapingEngine (src/engines/contentScraping.ts)

**Status**: [To Do] - Referenced but not implemented

**Purpose**: Implements complete "Scrape URL File" functionality for batch content processing

**Key Methods**:
- `scrapeUrls()`: Main scraping orchestration
- `processUrlBatch()`: Batch processing with concurrency control
- `extractContent()`: Content extraction using CSS selectors
- `generatePdf()`: PDF generation with custom options
- `saveTextContent()`: Text file creation and organization
- `trackFailedUrls()`: Failed URL tracking and reporting
- `rotateVpnConnection()`: Optional VPN rotation
- `waitRandomInterval()`: Anti-detection delay management

**Features To Preserve**:
- Batch processing URLs from files or arrays
- PDF generation with customizable options
- Text content extraction and organized saving
- Failed URL tracking and comprehensive reporting
- Auto-scrolling and toggle button clicking
- VPN utilities integration (preserved as optional)
- Concurrent processing with p-limit
- Random wait times between requests for stealth
- Comprehensive content selector coverage
- Multiple output format support (text, PDF)
- Organized directory structure (texts/, pdfs/)
- Detailed per-URL processing logs
- Browser page management and cleanup
- Network error handling with retry mechanisms

### 3. Utility Layer

#### BrowserManager (src/utils/browserManager.ts)

**Status**: [To Do] - Referenced but not implemented

**Purpose**: Centralized Puppeteer browser lifecycle management

**Key Methods**:
- `launchBrowser()`: Browser initialization with stealth configuration
- `createPage()`: Page creation with default settings
- `closePage()`: Safe page cleanup
- `closeBrowser()`: Safe browser cleanup
- `configurePageDefaults()`: Default page configuration
- `handleBrowserMemoryCleanup()`: Resource monitoring and cleanup

#### ContentExtractor (src/utils/contentExtractor.ts)

**Status**: [To Do] - Referenced but not implemented

**Purpose**: Content extraction and output generation

**Key Methods**:
- `extractAndSaveText()`: Text content extraction and file saving
- `generatePdfFromPage()`: PDF generation with custom options
- `extractUsingSelectors()`: CSS selector-based content extraction
- `cleanExtractedContent()`: Content sanitization and formatting
- `organizeOutputFiles()`: Directory structure management

#### VpnManager (src/utils/vpnManager.ts)

**Status**: [To Do] - Optional utility for VPN rotation

**Purpose**: Optional VPN connection management for enhanced anonymity

**Key Methods**:
- `rotateVpnConnection()`: VPN server rotation
- `validateVpnConnection()`: Connection verification
- `getAvailableVpnServers()`: Server list management

### 4. Configuration Layer

#### ScrapingConfig (src/config.ts)

**Status**: [Created] - Comprehensive configuration with validation

**Key Features**:
- Complete configuration interfaces for all components
- Default settings preserving original module behavior
- Configuration validation with detailed error reporting
- Environment-specific overrides
- Type-safe configuration management

**Current Issues**:
- Duplicate interface definitions need cleanup
- Configuration export structure needs refinement

## Script Structure

### Current Implementation Status

| Script File | Status | Purpose |
|-------------|--------|---------|
| `src/index.ts` | [In Progress] | FastMCP server main entry point |
| `src/config.ts` | [Created] | Configuration management and validation |
| `src/engines/urlDiscovery.ts` | [In Progress] | URL discovery engine implementation |
| `src/engines/contentScraping.ts` | [To Do] | Content scraping engine implementation |
| `src/utils/logger.ts` | [Created] | Comprehensive logging utility |
| `src/utils/urlUtils.ts` | [Created] | URL processing and validation utilities |
| `src/utils/browserManager.ts` | [To Do] | Puppeteer browser lifecycle management |
| `src/utils/contentExtractor.ts` | [To Do] | Content extraction and output generation |
| `src/utils/vpnManager.ts` | [To Do] | Optional VPN rotation management |

### Directory Structure

```
Documentation_Scraper_MCP/
├── src/
│   ├── index.ts                 # [In Progress] FastMCP server entry point
│   ├── config.ts                # [Created] Configuration management
│   ├── engines/
│   │   ├── urlDiscovery.ts      # [In Progress] Make URL File functionality
│   │   └── contentScraping.ts   # [To Do] Scrape URL File functionality
│   └── utils/
│       ├── logger.ts            # [Created] Logging system
│       ├── urlUtils.ts          # [Created] URL processing
│       ├── browserManager.ts    # [To Do] Browser lifecycle
│       ├── contentExtractor.ts  # [To Do] Content extraction
│       └── vpnManager.ts        # [To Do] VPN management (optional)
├── build/                       # [Generated] TypeScript compilation output
├── package.json                 # [Created] Dependencies and scripts
├── tsconfig.json               # [Created] TypeScript configuration
├── README.md                   # [Created] Project documentation
├── ARCHITECTURE.md             # [Created] System design documentation
├── TODO.md                     # [To Do] Implementation task list
├── CLAUDE.md                   # [Created] Claude integration reference
├── FASTMCP_TYPESCRIPT.md       # [Created] FastMCP TypeScript reference
└── [Additional documentation files] # [Created] Status and preservation guides
```

## Technology Choices

### Core Technologies

**FastMCP TypeScript Framework**
- **Rationale**: Modern, type-safe MCP server development with excellent Claude Desktop integration
- **Benefits**: Type safety, modern JavaScript features, excellent tooling, native MCP protocol support

**Puppeteer with Stealth Plugin**
- **Rationale**: Preserves original browser automation capabilities with enhanced stealth features
- **Benefits**: Comprehensive browser control, anti-detection capabilities, stable page interaction

**p-limit for Concurrency Control**
- **Rationale**: Maintains original concurrent processing approach with better resource management
- **Benefits**: Memory-efficient concurrent processing, configurable limits, error isolation

**Zod for Parameter Validation**
- **Rationale**: Type-safe runtime validation for MCP tool parameters
- **Benefits**: Runtime type safety, detailed error messages, schema validation

### Architecture Patterns

**Layered Architecture**
- **Engine Layer**: Business logic isolation
- **Utility Layer**: Shared service components
- **Configuration Layer**: Centralized settings management

**Dependency Injection**
- Configuration passed to all components
- Enables testing and flexibility
- Maintains separation of concerns

**Factory Pattern**
- Browser and page creation
- Content extractor instantiation
- Logger configuration

## Security Considerations

### Browser Security
- Stealth plugin integration for anti-detection
- User agent rotation to avoid fingerprinting
- Configurable browser security flags
- Resource monitoring to prevent memory exhaustion

### Data Protection
- Configurable output directory restrictions
- Content filtering and sanitization
- Secure cleanup of temporary files
- Memory-safe content processing

### Network Security
- Optional VPN integration for IP rotation
- Configurable request delays for rate limiting
- Network error handling with exponential backoff
- Domain and URL pattern filtering

## Scalability and Performance

### Performance Optimizations
- Concurrent page processing with configurable limits
- Memory monitoring and automatic cleanup
- Browser resource pooling and reuse
- Efficient content extraction with targeted selectors

### Scalability Strategies
- Configurable concurrency limits based on system resources
- Batch processing for large URL sets
- Progressive cleanup to prevent memory accumulation
- Modular architecture for feature extension

### Resource Management
- Browser lifecycle management
- Page cleanup after processing
- Memory threshold monitoring
- Automatic garbage collection triggers

## Testing Strategy

### Unit Testing
- Configuration validation testing
- URL utility function testing
- Content extraction logic testing
- Error handling pathway testing

### Integration Testing
- Browser manager integration testing
- Engine component interaction testing
- File output validation testing
- MCP tool execution testing

### End-to-End Testing
- Complete workflow testing with real websites
- Performance testing with large URL sets
- Error recovery testing with network failures
- Resource usage testing under load

## Future Considerations

### Planned Enhancements
- Machine learning-based content extraction
- Advanced anti-detection capabilities
- Distributed processing support
- Enhanced PDF generation options

### Extension Points
- Additional output formats (Markdown, JSON)
- Custom content selectors per domain
- Advanced VPN provider integration
- Monitoring and alerting capabilities

## Developer Notes

### Critical Implementation Details
- All original functionality from both Python modules must be preserved
- Browser stealth configuration is essential for reliable operation
- Memory management is crucial for processing large URL sets
- Configuration validation prevents runtime errors
- Comprehensive logging is essential for debugging and monitoring

### Common Pitfalls
- Browser resource leaks if pages/browsers aren't properly closed
- Memory accumulation during large crawling operations
- Network timeouts on slow or unreliable connections
- Content extraction failures on dynamic or complex websites
- VPN connection stability during long-running operations
