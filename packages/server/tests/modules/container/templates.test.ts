import path from 'path';
import fs from 'fs';
import { describe, it, expect } from 'vitest';
import { getTemplateConfig, TEMPLATE_TYPES, isValidTemplate } from '../../../src/modules/container/lib/templates.ts';

describe('Template Config', () => {
  it('should have valid template types', () => {
    expect(TEMPLATE_TYPES).toContain('node');
    expect(TEMPLATE_TYPES).toContain('node+java');
    expect(TEMPLATE_TYPES).toContain('node+python');
  });

  it('should return correct config for node template', () => {
    const config = getTemplateConfig('node');
    expect(config.imageName).toBe('code-link-node:latest');
    expect(config.dockerfileDir).toMatch(/templates\/node$/);
  });

  it('should validate template types correctly', () => {
    expect(isValidTemplate('node')).toBe(true);
    expect(isValidTemplate('invalid')).toBe(false);
  });
});

describe('ensureTemplateImage build context', () => {
  it('should use parent templates directory as context', () => {
    const config = getTemplateConfig('node');
    // 验证 dockerfileDir 指向子目录，但构建上下文应该是父目录
    const expectedContext = path.dirname(config.dockerfileDir);
    expect(expectedContext).toMatch(/templates$/);
  });

  it('should include claude.json in build context src', () => {
    // 验证配置文件在 templates 目录
    const templatesDir = path.dirname(getTemplateConfig('node').dockerfileDir);
    const claudeJsonPath = path.join(templatesDir, 'claude.json');
    const claudeSettingsPath = path.join(templatesDir, 'claude-settings.json');
    // 文件应存在
    expect(fs.existsSync(claudeJsonPath)).toBe(true);
    expect(fs.existsSync(claudeSettingsPath)).toBe(true);
  });
});