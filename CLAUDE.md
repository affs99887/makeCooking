# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WeChat Mini Program (微信小程序) called "makeCooking". WeChat Mini Programs use a proprietary framework developed by Tencent with file extensions `.wxml` (markup), `.wxss` (styles), `.js` (logic), and `.json` (configuration).

**App ID**: `wx729732b767a20c3b`

## Architecture

### Framework
- **Component Framework**: `glass-easel` - WeChat's component system
- **Code Loading**: Lazy loading enabled with `requiredComponents` strategy
- **Compilation**: ES6 enabled, minification enabled for production builds

### Project Structure
```
app.js              # App entry point with lifecycle hooks and global data
app.json            # Global configuration (pages, window, navigation)
app.wxss            # Global styles
pages/              # Page components
  index/            # Home page (user profile)
  logs/             # Logs page (view history)
utils/              # Shared utilities
  util.js           # Common functions (formatTime, formatNumber)
```

### Page Architecture
Each page in WeChat Mini Programs consists of 4 files:
- `.wxml` - UI template (similar to HTML but uses WeChat-specific tags like `<view>`, `<scroll-view>`)
- `.wxss` - Styles (similar to CSS)
- `.js` - Page logic using `Page()` constructor with lifecycle methods and event handlers
- `.json` - Page-specific configuration

### Key Patterns

**App Lifecycle** (app.js):
- `onLaunch()` - Runs when mini program initializes
- Uses `wx.getStorageSync()`/`wx.setStorageSync()` for local storage
- `globalData` object for app-wide state

**Page Lifecycle** (pages/*/\*.js):
- `onLoad()` - Runs when page loads
- `data` object for page state
- `setData()` method for updating UI (triggers re-render)

**WeChat APIs** - All start with `wx.`:
- `wx.login()` - User authentication
- `wx.getUserProfile()` - Get user info with authorization
- `wx.navigateTo()` - Page navigation
- `wx.getStorageSync()`/`wx.setStorageSync()` - Local storage
- `wx.canIUse()` - Feature detection for API availability

**Data Binding in WXML**:
- `{{variable}}` - Interpolation
- `wx:if`/`wx:elif`/`wx:else` - Conditional rendering
- `bind:event` or `bindtap` - Event binding to JS methods

## Development

### Testing/Running
This project must be run in **WeChat Developer Tools** (微信开发者工具). There are no npm scripts or command-line build tools - the IDE handles compilation, preview, and debugging.

### Configuration Files
- `project.config.json` - IDE and build settings (ES6, minification, babel config)
- `project.private.config.json` - Local/private settings (not usually committed)
- `app.json` - Pages registration and global UI config
- `sitemap.json` - Search indexing rules for WeChat's mini program search

### Key Settings
- ES6 to ES5 compilation: Enabled
- Code minification: Enabled (JS, WXSS, WXML)
- Source maps: Uploaded with builds
- Library version: `trial` (using trial/preview features)
