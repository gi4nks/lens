import type { Theme } from './themes.js';

/**
 * Returns an Ink-compatible color string for a filename based on its type/extension.
 * @param filename  The file name (may end with '/' for directories, may start with '.' for hidden).
 * @param theme     The active theme.
 */
export function getFileColor(filename: string, theme: Theme): string {
  if (filename.endsWith('/')) return theme.primary;          // directory
  if (filename.startsWith('.')) return theme.dim;            // hidden file

  const ext = filename.includes('.')
    ? filename.split('.').pop()!.toLowerCase()
    : '';

  switch (ext) {
    // ── Source code ──────────────────────────────────────────────
    case 'ts': case 'tsx': case 'js': case 'jsx': case 'mjs': case 'cjs':
    case 'py': case 'pyw': case 'pyi':
    case 'rs': case 'go':
    case 'java': case 'kt': case 'kts': case 'scala':
    case 'c': case 'cpp': case 'cc': case 'cxx': case 'h': case 'hpp':
    case 'cs': case 'swift': case 'rb': case 'php': case 'lua':
    case 'r': case 'jl': case 'hs': case 'ml': case 'mli': case 'ex': case 'exs':
    case 'clj': case 'cljs': case 'dart': case 'zig':
      return theme.warning;   // yellow

    // ── Web / markup ─────────────────────────────────────────────
    case 'html': case 'htm': case 'xhtml':
    case 'css': case 'scss': case 'less': case 'sass': case 'styl':
    case 'vue': case 'svelte': case 'astro':
      return theme.accent;    // blue

    // ── Config / data ────────────────────────────────────────────
    case 'json': case 'jsonc': case 'json5':
    case 'yaml': case 'yml':
    case 'toml': case 'ini': case 'cfg': case 'conf': case 'config':
    case 'env': case 'xml': case 'csv': case 'tsv':
    case 'prisma': case 'graphql': case 'gql': case 'proto':
      return theme.success;   // green

    // ── Shell / scripts ──────────────────────────────────────────
    case 'sh': case 'zsh': case 'bash': case 'fish': case 'ps1': case 'bat': case 'cmd':
      return theme.success;   // green

    // ── Images ───────────────────────────────────────────────────
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'webp':
    case 'svg': case 'ico': case 'bmp': case 'tiff': case 'tif':
    case 'heic': case 'heif': case 'avif': case 'raw':
      return theme.secondary; // magenta

    // ── Audio / video ────────────────────────────────────────────
    case 'mp3': case 'mp4': case 'mov': case 'avi': case 'mkv':
    case 'wav': case 'flac': case 'ogg': case 'webm': case 'm4a':
    case 'aac': case 'wmv': case 'm4v': case 'opus': case 'mid': case 'midi':
      return theme.secondary; // magenta

    // ── Archives ─────────────────────────────────────────────────
    case 'zip': case 'tar': case 'gz': case 'tgz': case 'bz2':
    case 'xz': case '7z': case 'rar': case 'zst':
    case 'dmg': case 'iso': case 'img': case 'deb': case 'rpm':
      return theme.error;     // red

    // ── Documents ────────────────────────────────────────────────
    case 'md': case 'mdx': case 'markdown':
    case 'txt': case 'rst': case 'adoc': case 'org':
    case 'pdf': case 'doc': case 'docx': case 'odt': case 'rtf':
    case 'epub': case 'tex':
      return 'white';

    // ── Lock / generated ─────────────────────────────────────────
    case 'lock': case 'map': case 'snap': case 'patch':
      return theme.dim;

    default: {
      if (!ext) {
        // No extension – check well-known names
        const lower = filename.toLowerCase();
        if (['makefile', 'dockerfile', 'containerfile', 'vagrantfile', 'procfile', 'brewfile', 'gemfile', 'rakefile'].includes(lower)) {
          return theme.success;
        }
        if (['license', 'licence', 'readme', 'changelog', 'authors', 'contributors', 'notice', 'copying'].includes(lower)) {
          return 'white';
        }
      }
      return theme.dim;
    }
  }
}
