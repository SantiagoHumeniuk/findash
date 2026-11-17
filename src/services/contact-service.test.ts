import { beforeEach, describe, expect, it, vi } from 'vitest';
import { contactService } from './contact-service';

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}));

describe('contactService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('surfaces errors when loading contact messages', async () => {
    const error = new Error('Database unavailable');
    const query = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error }),
    };
    mockFrom.mockReturnValue(query);

    await expect(contactService.getAllMessages()).rejects.toBe(error);
  });

  it('deletes a contact message by id', async () => {
    const query = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockFrom.mockReturnValue(query);

    await expect(contactService.deleteMessage('message-id')).resolves.toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('contact_messages');
    expect(query.eq).toHaveBeenCalledWith('id', 'message-id');
  });
});
