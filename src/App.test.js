import { render, screen } from '@testing-library/react';
import App from './App';

test('renders app header and actions', () => {
  render(<App />);
  expect(screen.getByText(/Expense Tracker/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Add Expense/i })).toBeInTheDocument();
});
