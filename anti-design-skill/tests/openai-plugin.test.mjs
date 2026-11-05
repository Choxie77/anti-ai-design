import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { stageOpenAIPlugin } from '../scripts/lib/openai-plugin.js';
import { buildCodexPluginHooksManifest } from '../scripts/lib/transformers/hooks.js';

function write(root, rel, contents) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents);
}

describe('OpenAI plugin staging', () => {
  let root;
  let dist;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'anti-design-openai-plugin-'));
    dist = path.join(root, 'dist');

    write(root, '.claude-plugin/plugin.json', JSON.stringify({
      name: 'anti-design',
      version: '3.9.1',
      author: {
        name: 'Paul Bakaus',
        email: 'paul@example.com',
      },
      homepage: 'https://anti-design.example',
      repository: 'https://github.com/OWNER/anti-design',
    }));
    write(root, 'scripts/lib/assets/plugin-icon.png', 'icon');

    write(
      root,
      'dist/codex/.codex/skills/anti-design/SKILL.md',
      '---\nname: anti-design\n---\n\nUse $anti-design. Run .codex/skills/anti-design/scripts/context.mjs.\n',
    );
    write(
      root,
      'dist/codex/.codex/skills/anti-design/agents/openai.yaml',
      'interface:\n  display_name: Anti-Design\n',
    );
    write(
      root,
      'dist/codex/.codex/skills/anti-design/agents/anti_design_asset_producer.toml',
      'name = "anti_design_asset_producer"\n',
    );

    // A Claude payload exists too. The OpenAI stage must never read it.
    write(
      root,
      'dist/claude-code/.claude/skills/anti-design/SKILL.md',
      '---\nname: anti-design\n---\n\nUse /anti-design. Run .claude/skills/anti-design/scripts/context.mjs.\n',
    );
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('packages the Codex skill, agents, manifest, icon, and compatible hook', () => {
    const pluginRoot = stageOpenAIPlugin(root, dist);
    const skill = fs.readFileSync(path.join(pluginRoot, 'skills/anti-design/SKILL.md'), 'utf8');
    const manifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, '.codex-plugin/plugin.json'), 'utf8'));
    const hooks = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'hooks/hooks.json'), 'utf8'));

    assert.match(skill, /\$anti-design/);
    assert.match(skill, /\.codex\/skills\/anti-design/);
    assert.doesNotMatch(skill, /(?:^|[\s`(])\/anti-design\b/m);
    assert.doesNotMatch(skill, /\.claude\/skills\/anti-design/);

    assert.ok(fs.existsSync(path.join(pluginRoot, 'skills/anti-design/agents/openai.yaml')));
    assert.ok(fs.existsSync(path.join(
      pluginRoot,
      'skills/anti-design/agents/anti_design_asset_producer.toml',
    )));
    assert.ok(fs.existsSync(path.join(pluginRoot, 'assets/icon.png')));

    assert.equal(manifest.skills, './skills/');
    assert.deepEqual(manifest.author, {
      name: 'Renaissance Geek Inc',
      url: 'https://anti-design.example',
    });
    assert.equal('email' in manifest.author, false);
    assert.equal(manifest.interface.shortDescription, 'Design and refine interfaces');
    assert.equal(manifest.interface.category, 'Creativity');
    assert.deepEqual(hooks, buildCodexPluginHooksManifest());
    assert.match(hooks.hooks.PostToolUse[0].hooks[0].command, /\$\{PLUGIN_ROOT\}/);
    assert.doesNotMatch(hooks.hooks.PostToolUse[0].hooks[0].command, /CLAUDE_PLUGIN_ROOT/);
  });
});
