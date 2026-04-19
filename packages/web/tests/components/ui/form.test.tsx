import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';

describe('Form Components', () => {
  it('Form renders with children', () => {
    const TestForm = () => {
      const form = useForm();
      return (
        <Form {...form}>
          <div>Test Content</div>
        </Form>
      );
    };
    render(<TestForm />);
    expect(screen.getByText('Test Content')).toBeDefined();
  });

  it('FormField renders with label and input', () => {
    const TestForm = () => {
      const form = useForm({
        defaultValues: {
          username: '',
        },
      });
      return (
        <Form {...form}>
          <form>
            <FormField
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <input type="text" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>
      );
    };
    render(<TestForm />);
    expect(screen.getByLabelText('Username')).toBeDefined();
  });

  it('FormMessage renders without error when no validation error', () => {
    const TestForm = () => {
      const form = useForm({
        defaultValues: {
          email: '',
        },
      });
      return (
        <Form {...form}>
          <form>
            <FormField
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      );
    };
    render(<TestForm />);
    // Verify the form renders correctly
    expect(screen.getByLabelText('Email')).toBeDefined();
  });
});
