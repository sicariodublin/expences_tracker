import { render, screen } from '@testing-library/react';
import App from './App';

test('shows sign-in form when not authenticated', () => {
  render(<App />);
  expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
});

test('shows link to create an account when not authenticated', () => {
  render(<App />);
  expect(screen.getByRole('button', { name: /create one/i })).toBeInTheDocument();
});
