import fs from 'node:fs';
import path from 'node:path';

import { quoteLauncher, rewritePluginMarkdownTree } from './plugin-paths.js';

const PROJECT_SCRIPTS = '.github/skills/anti-design/scripts';
const PROJECT_FALLBACK =
  `That base directory resolves every \`${PROJECT_SCRIPTS}/anti-design <verb>\` command in this skill and its references, ` +
  `and \`${PROJECT_SCRIPTS}\` is the fallback only when the runtime reports no base directory.`;

// VS Code provides the loaded skill's URI, not Claude's substitution variables.
// Relative Markdown links resolve beside that file; shell commands still run
// from the user's project. Never fall back to another installed skill copy.
export function rewriteVSCodeMarkdown(content, { isSkillEntrypoint = false } = {}) {
  if (isSkillEntrypoint) {
    if (!content.includes(PROJECT_FALLBACK)) {
      throw new Error('VS Code skill path rewrite drift: Setup fallback changed.');
    }
    content = content.replace(PROJECT_FALLBACK,
      'Resolve the installed directory from this skill’s [launcher](scripts/anti-design). ' +
      'Replace `<skill-base-dir>` with that absolute directory before running commands; it is not a shell variable.');
  }
  return content.replaceAll(PROJECT_SCRIPTS, '<skill-base-dir>/scripts')
    .replace(/(?<!["\w/])<skill-base-dir>\/scripts\/anti-design(\.cmd)?(?=[\s`])/g,
      (_, cmd) => quoteLauncher('<skill-base-dir>', Boolean(cmd)));
}

/** Stage a declarative skill extension, independently of repo-install sidecars. */
export function stageVSCodeExtension(rootDir, distDir) {
  const source = path.join(distDir, 'github', '.github', 'skills', 'anti-design');
  const version = JSON.parse(fs.readFileSync(path.join(rootDir, '.claude-plugin/plugin.json'), 'utf8')).version;
  const extensionRoot = path.join(distDir, 'vscode');
  // Only this generated artifact is replaced. Never touch the user's editor.
  fs.rmSync(extensionRoot, { recursive: true, force: true });
  fs.mkdirSync(extensionRoot, { recursive: true });
  const skillDir = path.join(extensionRoot, 'skills', 'anti-design');
  fs.cpSync(source, skillDir, { recursive: true });
  rewritePluginMarkdownTree(skillDir, rewriteVSCodeMarkdown);

  const manifest = {
    name: 'anti-design',
    displayName: 'Anti-Design',
    description: 'Design skills for GitHub Copilot: build, critique, audit, and refine interfaces.',
    version,
    publisher: 'renaissance-geek',
    license: 'Apache-2.0',
    homepage: 'https://anti-design.example',
    repository: { type: 'git', url: 'https://github.com/OWNER/anti-design.git' },
    bugs: { url: 'https://github.com/OWNER/anti-design/issues' },
    icon: 'icon.png',
    categories: ['AI'],
    keywords: ['copilot', 'design', 'skills', 'frontend', 'accessibility'],
    engines: { vscode: '^1.109.3' },
    extensionKind: ['workspace'],
    extensionDependencies: ['GitHub.copilot-chat'],
    capabilities: { untrustedWorkspaces: { supported: false }, virtualWorkspaces: false },
    contributes: { chatSkills: [{ path: './skills/anti-design/SKILL.md' }] },
  };
  fs.writeFileSync(path.join(extensionRoot, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.copyFileSync(path.join(rootDir, 'scripts/lib/assets/plugin-icon.png'), path.join(extensionRoot, 'icon.png'));
  fs.copyFileSync(path.join(rootDir, 'LICENSE'), path.join(extensionRoot, 'LICENSE'));
  fs.copyFileSync(path.join(rootDir, 'vscode/README.md'), path.join(extensionRoot, 'README.md'));
  fs.copyFileSync(path.join(rootDir, 'vscode/.vscodeignore'), path.join(extensionRoot, '.vscodeignore'));
  return extensionRoot;
}
