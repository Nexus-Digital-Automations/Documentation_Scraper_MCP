# DOCUMENTATION SCRAPER MCP SERVER
## Complete Functionality Preservation & Enhancement

This MCP server preserves **ALL** functionality from both original modules and adds powerful keyword-based URL filtering for targeted crawling.

## ✅ PRESERVED FROM "Make URL File" MODULE + ENHANCED
- ✅ Website crawling starting from single URL  
- ✅ Recursive link discovery with configurable depth limits
- ✅ Smart duplicate URL detection and normalization
- ✅ Auto-scrolling pages to load dynamic content
- ✅ **MASSIVELY ENHANCED** clicking toggle buttons to expand collapsed content  
- ✅ Language filtering with confidence thresholds
- ✅ User agent rotation for stealth browsing
- ✅ Comprehensive logging with colored output
- ✅ Browser resource management and cleanup
- ✅ Configurable concurrent page processing
- ✅ URL filtering by patterns and file extensions
- ✅ Content extraction using CSS selectors
- ✅ Text file output with organized directory structure
- ✅ Error handling with retry mechanisms
- ✅ Progress tracking and status reporting
- 🆕 **Keyword inclusion filtering for targeted URL discovery**

### 🚀 **NEW: ADVANCED TOGGLE CLICKING SYSTEM**
- ✅ **Enhanced Selector Diversity**: 15+ comprehensive CSS selectors including ARIA, Bootstrap, and framework patterns
- ✅ **Configurable Custom Selectors**: Add site-specific toggle selectors via configuration
- ✅ **Smart State Detection**: Prevents re-clicking already expanded elements using unique element IDs
- ✅ **Intelligent Expansion Verification**: Replaces fixed timeouts with `page.waitForFunction` for real state change detection
- ✅ **Iterative Nested Expansion**: Automatically discovers and expands newly revealed toggle buttons (configurable iterations)
- ✅ **Multi-Method Verification**: Checks ARIA attributes, controlled elements, CSS classes, and native HTML states
- ✅ **Comprehensive Error Handling**: Graceful fallbacks with detailed logging for each expansion attempt
- ✅ **Performance Optimized**: Efficient element tracking and batched processing

### 🆕 **NEW: TEXT-BASED CLICK TARGETING**
- ✅ **Intelligent Content-Based Clicking**: Target elements based on their text content rather than just CSS selectors
- ✅ **Session-Specific Configuration**: Pass text-based click patterns per discovery session via MCP arguments
- ✅ **Global Configuration Support**: Configure common text-based patterns in the main configuration
- ✅ **Flexible Text Matching**: Support for case-sensitive/insensitive matching with 'any' or 'all' keyword matching
- ✅ **Nested Element Support**: Click target can be different from text source element (e.g., click button, check header text)
- ✅ **Comprehensive Logging**: Detailed logs show text matches and successful clicks for debugging

### 🆕 **NEW: SELECTOR-BASED EXCLUSION FEATURE**
- ✅ **Proactive Content Filtering**: Remove unwanted elements from DOM before text extraction
- ✅ **Comprehensive Default Patterns**: Pre-configured to exclude headers, footers, navbars, sidebars, cookie banners
- ✅ **ARIA and Framework Support**: Intelligent targeting of semantic elements and common frameworks
- ✅ **Configurable Exclusion Lists**: Customize excluded selectors per use case or globally
- ✅ **DOM Manipulation Before Extraction**: Elements are removed from page DOM before content processing
- ✅ **Comprehensive Error Handling**: Graceful fallbacks with detailed logging for debugging
- ✅ **Zero Performance Impact**: Efficient DOM manipulation with browser-context execution

#### Text-Based Click Target Examples:
```javascript
// Example 1: Click buttons containing "Show More" or "Load More"
{
  "clickTargetSelector": "button",
  "textIncludes": ["Show More", "Load More", "Read More"],
  "caseSensitive": false,
  "matchType": "any"
}

// Example 2: Click sections where header contains "Details"
{
  "clickTargetSelector": ".expandable-section",
  "textMatchSelector": "h3.section-title",
  "textIncludes": ["Details", "Additional Information"],
  "caseSensitive": false
}

// Example 3: Session-specific targeting for comments
// Pass in discover-urls sessionTextBasedClickTargets parameter:
{
  "clickTargetSelector": ".comment-toggle",
  "textIncludes": ["Show Replies", "View Comments"],
  "matchType": "any"
}
```

## ✅ PRESERVED FROM "Scrape URL File" MODULE
- ✅ Batch processing URLs from files or arrays
- ✅ PDF generation with customizable options
- ✅ Text content extraction and saving
- ✅ Failed URL tracking and reporting
- ✅ Auto-scrolling and toggle button clicking
- ✅ VPN utilities integration (preserved as optional)
- ✅ Concurrent processing with p-limit
- ✅ Random wait times between requests
- ✅ Comprehensive content selector coverage
- ✅ Multiple output format support
- ✅ Organized directory structure (texts/, pdfs/)
- ✅ Detailed logging for each processed URL
- ✅ Browser page management and cleanup
- ✅ Network error handling and retries

## 🆕 MCP ENHANCEMENTS
- Real-time progress reporting to Claude
- Parameter validation with Zod schemas  
- Session-based configuration management
- Enhanced error reporting with context
- Multiple input methods support
- Resource usage monitoring
- **Keyword-based URL filtering for targeted crawling**

## 🔧 MCP TOOLS
1. **discover-urls**: Complete Make URL File functionality + **Keyword filtering**
2. **scrape-urls**: Complete Scrape URL File functionality  
3. **get-config**: View current configuration
4. **update-config**: Modify settings dynamically
5. **validate-config**: Check configuration validity
6. **get-status**: System health monitoring
7. **list-failed-urls**: View and retry failed operations

## 🎯 NEW: KEYWORD FILTERING FEATURE

### What is Keyword Filtering?
The new keyword filtering feature allows you to specify keywords that URLs **must contain** to be included in the crawling process. This enables highly targeted crawling by focusing only on URLs that match your specific interests.

### How it Works:
- **Inclusion-based filtering**: URLs are only kept if they contain at least one specified keyword
- **Case-insensitive matching**: Keywords match regardless of capitalization  
- **Full URL and path matching**: Keywords are checked against both the complete URL and the path component
- **Multiple keyword support**: Specify multiple keywords - URLs matching ANY keyword will be included
- **Comprehensive logging**: Detailed logs show which keywords matched and why URLs were included/excluded

### Usage Examples:
```javascript
// Example 1: Find only documentation pages
{
  "startUrl": "https://example.com",
  "keywords": ["docs", "documentation", "guide", "tutorial"]
}

// Example 2: Focus on API-related content
{
  "startUrl": "https://developer.example.com", 
  "keywords": ["api", "endpoint", "reference"]
}

// Example 3: Combine with exclusion patterns
{
  "startUrl": "https://blog.example.com",
  "keywords": ["react", "javascript"],
  "excludePatterns": ["comment", "sidebar"]
}
```

### Benefits:
- **🎯 Targeted crawling**: Only discover URLs relevant to your specific needs
- **🔇 Reduced noise**: Eliminate irrelevant pages from your crawl results
- **⚡ Improved efficiency**: Spend less time processing unrelated content
- **💰 Better resource usage**: Focus computational resources on valuable content
- **🎪 Enhanced precision**: Get exactly the type of content you're looking for

## 🎯 SELECTOR-BASED EXCLUSION FEATURE

### What is Selector-Based Exclusion?
The selector-based exclusion feature proactively removes unwanted elements from the page's DOM **before** text extraction begins. This eliminates common boilerplate content like headers, footers, navigation bars, sidebars, and cookie consent banners from your extracted content.

### How it Works:
- **DOM Manipulation**: Elements are removed directly from the browser's DOM using `page.evaluate()`
- **Before Content Extraction**: Exclusion happens before any text extraction, ensuring clean content
- **Configurable Selectors**: Use default patterns or customize with your own CSS selectors
- **Error-Resilient**: Individual selector failures don't stop the entire process
- **Comprehensive Logging**: Detailed logs show which elements were removed and why

### Default Exclusion Patterns:
```javascript
// Semantic HTML Elements
"header", "footer", "nav", "aside"

// Common CSS Classes and IDs  
".sidebar", "#sidebar", ".cookie-banner", ".cookie-consent"

// ARIA Roles for Accessibility
"[role='banner']", "[role='contentinfo']", "[role='navigation']"
```

### Configuration Examples:

#### Custom Exclusions for Documentation Sites:
```javascript
{
  "contentExtraction": {
    "selectorsToExcludeFromText": [
      ".docs-sidebar", ".breadcrumb-nav", ".version-selector", "#table-of-contents"
    ]
  }
}
```

### Benefits:
- **✨ Cleaner Content**: Extract only meaningful content without navigation clutter
- **🔍 Better Text Quality**: Improved signal-to-noise ratio in extracted text
- **📊 Enhanced Analysis**: More accurate content analysis without boilerplate interference
- **🛡️ Privacy Focused**: Automatically removes cookie banners and consent forms
- **⚡ Performance Optimized**: Removes elements before processing, reducing computational overhead

## 🚀 USAGE
1. Install dependencies: `npm install`
2. Build server: `npm run build`
3. Add to Claude Desktop config
4. Use tools in Claude conversations

Every feature from both original modules is preserved and enhanced.