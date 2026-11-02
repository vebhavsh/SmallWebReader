import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DashboardView } from '../components/views/DashboardView';
import { recordArticleRead } from '../utils/storage';

describe('DashboardView', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders initial dashboard metrics', async () => {
    render(<DashboardView />);
    await waitFor(() => expect(screen.getByText('Personal Analytics')).toBeInTheDocument());
    expect(screen.getByText('Reading Dashboard')).toBeInTheDocument();
    expect(screen.getByText("Today's Goal Progress")).toBeInTheDocument();
  });

  it('updates metrics when readings are recorded', async () => {
    recordArticleRead(1500, 8);
    render(<DashboardView />);

    await waitFor(() => expect(screen.getByText('1.5k')).toBeInTheDocument()); // 1500 words
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });
});
