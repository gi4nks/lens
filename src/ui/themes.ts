export interface Theme {
  name: string;
  primary: string;      // Prompt, highlights
  secondary: string;    // AI response indicators
  accent: string;       // CWD, special tags
  success: string;      // Done status
  warning: string;      // Warnings, System info
  error: string;        // Errors
  dim: string;          // Inactive text
  bg: string;           // Background for prompt/highlights
}

export const THEMES: Record<string, Theme> = {
  dark: {
    name: 'Dark Classic',
    primary: 'cyan',
    secondary: 'magenta',
    accent: 'blue',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    dim: 'gray',
    bg: '#444444', // Lighter grey to contrast with black
  },
  sunset: {
    name: 'Sunset (Gradient)',
    primary: 'orange',
    secondary: 'magenta',
    accent: 'yellow',
    success: 'green',
    warning: 'red',
    error: 'red',
    dim: 'gray',
    bg: '#3d2b2b', // Dark warm tone
  },
  ocean: {
    name: 'Deep Ocean',
    primary: 'blue',
    secondary: 'cyan',
    accent: 'white',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    dim: 'gray',
    bg: '#1a2b3c', // Midnight blue
  },
  forest: {
    name: 'Forest',
    primary: 'green',
    secondary: 'yellow',
    accent: 'white',
    success: 'cyan',
    warning: 'yellow',
    error: 'red',
    dim: 'gray',
    bg: '#1b2b1b', // Dark forest green
  },
  mono: {
    name: 'Monochrome',
    primary: 'white',
    secondary: 'white',
    accent: 'gray',
    success: 'white',
    warning: 'white',
    error: 'white',
    dim: 'gray',
    bg: '#333333',
  },
};

export const THEME_NAMES = Object.keys(THEMES);
