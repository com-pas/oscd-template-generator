# OSCD Template Generator

OpenSCD plugin for creating new Logical Node Types (LNodeType) for IEC 61850 SCL files.

## Overview

This project provides a web component and supporting dialogs for generating and managing Logical Node Types (`LNodeType`) in SCL files. It uses [OpenSCD Core](https://github.com/openenergytools/open-scd-core), [SCL-lib](https://github.com/openscd/scl-lib), and [Tree Grid](https://github.com/openenergytools/tree-grid) for SCL manipulation and UI.

## Features

- Create and insert new `LNodeType` elements into SCL documents
- Interactive tree-based selection of Data Objects and attributes for Logical Node Types
- Dialogs for adding Data Objects, editing descriptions, previewing changes, and settings

## Getting Started

### Installation

Clone the repository and install dependencies:

```sh
git clone https://github.com/com-pas/oscd-template-generator.git
cd oscd-template-generator
npm install
```

### Development

To start the development server with live reload on http://localhost:8000/:

```sh
npm start
```

To build the project for production:

```sh
npm run build
```

To run tests:

```sh
npm test
```

To lint and format code:

```sh
npm run lint
npm run format
```

## Usage

The main component is `oscd-template-generator`. It can be integrated into OpenSCD or used standalone in a web application. See `index.html` for a usage example.

## Scripts

- `start` - Start development server with live reload
- `build` - Build the app and output to `dist`
- `test` - Run test suite with coverage
- `lint` - Run linter and prettier checks
- `format` - Auto-format code
- `deploy` - Build and deploy to GitHub Pages

## Project Structure

- `oscd-template-generator.ts` - Main web component
- `components/` - Dialogs and UI components
- `foundation.ts` - Utility functions for tree and selection logic
- `constants.ts` - Shared constants
- `utils/` - Utility helpers
- `index.html` - Demo entry point
