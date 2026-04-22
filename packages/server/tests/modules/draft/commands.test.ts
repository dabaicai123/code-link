// packages/server/tests/ai-commands.test.ts

import { describe, it, expect } from 'vitest';
import { parseAICommand, isAICommand } from '../../../src/modules/draft/lib/commands.ts';

describe('AI Commands', () => {
  describe('parseAICommand', () => {
    it('should parse generate command', () => {
      const content = '@AI generate a function to sort array';
      const command = parseAICommand(content);
      expect(command).not.toBeNull();
      expect(command?.type).toBe('generate');
      expect(command?.target).toBe('a function to sort array');
    });

    it('should parse analyze command', () => {
      const content = '@AI analyze the performance issues in this code';
      const command = parseAICommand(content);
      expect(command).not.toBeNull();
      expect(command?.type).toBe('analyze');
      expect(command?.target).toBe('the performance issues in this code');
    });

    it('should parse command with parameters', () => {
      const content = '@AI generate a component --language TypeScript --style CSS';
      const command = parseAICommand(content);
      expect(command).not.toBeNull();
      expect(command?.type).toBe('generate');
      expect(command?.params?.language).toBe('TypeScript');
      expect(command?.params?.style).toBe('CSS');
    });

    it('should return null for invalid command', () => {
      const content = '@AI invalid command type';
      const command = parseAICommand(content);
      expect(command).toBeNull();
    });

    it('should return null for non-AI message', () => {
      const content = 'This is a regular message';
      const command = parseAICommand(content);
      expect(command).toBeNull();
    });

    it('should parse suggest command', () => {
      const content = '@AI suggest improvements for this code';
      const command = parseAICommand(content);
      expect(command).not.toBeNull();
      expect(command?.type).toBe('suggest');
      expect(command?.target).toBe('improvements for this code');
    });

    it('should parse explain command', () => {
      const content = '@AI explain how async/await works';
      const command = parseAICommand(content);
      expect(command).not.toBeNull();
      expect(command?.type).toBe('explain');
      expect(command?.target).toBe('how async/await works');
    });

    it('should parse review command', () => {
      const content = '@AI review the changes in file.ts';
      const command = parseAICommand(content);
      expect(command).not.toBeNull();
      expect(command?.type).toBe('review');
      expect(command?.target).toBe('the changes in file.ts');
    });

    it('should parse refactor command', () => {
      const content = '@AI refactor this function';
      const command = parseAICommand(content);
      expect(command).not.toBeNull();
      expect(command?.type).toBe('refactor');
      expect(command?.target).toBe('this function');
    });

    it('should parse test command', () => {
      const content = '@AI test cases for this component';
      const command = parseAICommand(content);
      expect(command).not.toBeNull();
      expect(command?.type).toBe('test');
      expect(command?.target).toBe('cases for this component');
    });

    it('should include rawContent in parsed command', () => {
      const content = '@AI generate some code';
      const command = parseAICommand(content);
      expect(command?.rawContent).toBe(content);
    });

    it('should handle case-insensitive command', () => {
      const content = '@AI GENERATE something';
      const command = parseAICommand(content);
      expect(command).not.toBeNull();
      expect(command?.type).toBe('generate');
    });
  });

  describe('isAICommand', () => {
    it('should return true for AI command', () => {
      expect(isAICommand('@AI generate something')).toBe(true);
      expect(isAICommand('  @AI analyze code')).toBe(true);
    });

    it('should return false for regular message', () => {
      expect(isAICommand('Hello world')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isAICommand('')).toBe(false);
    });

    it('should return false for message containing @AI in middle', () => {
      expect(isAICommand('Hello @AI generate something')).toBe(false);
    });

    it('should handle whitespace-only input', () => {
      expect(isAICommand('   ')).toBe(false);
    });
  });

});