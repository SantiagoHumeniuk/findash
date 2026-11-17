import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AdminContactMessagesSection } from './admin-contact-messages-section';

const { mockGetAllMessages } = vi.hoisted(() => ({
  mockGetAllMessages: vi.fn(),
}));

vi.mock('../../../../services/contact-service', () => ({
  contactService: {
    getAllMessages: mockGetAllMessages,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('AdminContactMessagesSection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetAllMessages.mockRejectedValue(new Error('Database unavailable'));
  });

  it('shows a retry action rather than an empty state when loading fails', async () => {
    render(<AdminContactMessagesSection />);

    expect(await screen.findByText('No se pudieron cargar los mensajes.')).toBeInTheDocument();
    expect(screen.queryByText('No hay mensajes de contacto aún')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(mockGetAllMessages).toHaveBeenCalledTimes(2);
  });
});
