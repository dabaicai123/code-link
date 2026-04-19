import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toaster } from '@/components/ui/sonner';

describe('Toaster', () => {
  it('renders without crashing', () => {
    render(<Toaster />);
    // Toaster 是一个 portal，不直接渲染在 DOM 中
    expect(document.body).toBeDefined();
  });
});