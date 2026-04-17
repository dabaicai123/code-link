import { describe, it, expect } from 'vitest';
import { getTemplateConfig, TEMPLATE_TYPES, isValidTemplate } from '../src/docker/templates.ts';

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