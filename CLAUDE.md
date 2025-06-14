# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static website built using the Metronic "Acidus" HTML template, a responsive corporate/business theme based on Bootstrap 3.3.4. The site is hosted on GitHub Pages with a custom domain (logicleaptechnologies.com).

## Development Commands

### Build System
The project uses Gulp for build automation. All build tools are located in the `dev-tools/` directory:

- `cd dev-tools && npm install` - Install build dependencies
- `cd dev-tools && gulp` - Run default build task (compiles Sass, minifies CSS/JS, validates HTML, watches for changes)
- `cd dev-tools && gulp sass` - Compile Sass files to CSS
- `cd dev-tools && gulp minify-css` - Minify CSS files
- `cd dev-tools && gulp rtlcss` - Generate RTL (right-to-left) CSS
- `cd dev-tools && gulp uglify` - Minify JavaScript files
- `cd dev-tools && gulp htmlhint` - Validate HTML files

### Live Development
- `cd dev-tools && gulp watch` - Watch for file changes and auto-build

## Architecture

### File Structure
- **HTML files**: Main pages (`index.html`, `about.html`, `work.html`, `contact.html`) in root directory
- **Sass source**: `/sass/` directory with modular SCSS architecture
- **CSS output**: `/css/` directory (generated from Sass)
- **JavaScript**: `/js/` directory with components and layout files
- **Images**: `/img/` directory with organized size-based subdirectories
- **Vendor libraries**: `/vendor/` directory for third-party dependencies
- **Build tools**: `/dev-tools/` directory containing Gulp configuration

### Sass Architecture
The Sass is organized in a modular structure:
- `_variables.scss` and `_mixins.scss` for global definitions
- `base/` - Base styles and resets
- `components/` - Reusable UI components (buttons, blockquotes)
- `layout/` - Header and footer styles
- `pages/` - Page-specific styles
- `plugins/` - Third-party plugin styles
- `utils/` - Utility classes and helpers
- `gui/` - Custom GUI components

### JavaScript Components
- Masonry grid layout for portfolio items
- Swiper.js for carousels and testimonials
- WOW.js for scroll animations
- Custom layout and component scripts

## Template Features
- Responsive Bootstrap 3.3.4 based layout
- Masonry grid portfolio layout
- Swiper carousels for clients and testimonials
- Smooth scroll and back-to-top functionality
- CSS animations with WOW.js
- RTL language support

## Deployment
The site is configured for GitHub Pages deployment with CNAME file pointing to logicleaptechnologies.com.