#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import { App } from './ui/App.js';

const program = new Command();

program
  .name('lens')
  .description('Lens - AI Augmented Shell Wrapper')
  .version('1.0.0');

program.action(() => {
  // Enter alternate screen buffer for full-screen UI
  process.stdout.write('\x1b[?1049h');
  
  const { waitUntilExit } = render(React.createElement(App));
  
  waitUntilExit().then(() => {
    // Leave alternate screen buffer on exit
    process.stdout.write('\x1b[?1049l');
    process.exit(0);
  });
});

program.parse(process.argv);
