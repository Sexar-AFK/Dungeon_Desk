import { CampaignInvitationMailer } from './campaign-invitation-mail.js';

describe('CampaignInvitationMailer', () => {
  it('reports file mode when SMTP is not configured', async () => {
    const mailer = { send: vi.fn().mockResolvedValue(undefined) };
    const config = {
      get: vi.fn((key: string) =>
        key === 'APP_PUBLIC_URL' ? 'http://localhost:5173' : undefined,
      ),
    };
    const service = new CampaignInvitationMailer(
      mailer as never,
      config as never,
    );

    await expect(
      service.send(
        'player@example.test',
        'Campaign',
        'dm@example.test',
        'one-time-token',
      ),
    ).resolves.toBe('file');
    expect(mailer.send).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        to: 'player@example.test',
        data: expect.objectContaining({
          url: 'http://localhost:5173/accept-invitation?token=one-time-token',
        }),
      }),
    );
  });

  it('reports SMTP mode when SMTP is configured', async () => {
    const mailer = { send: vi.fn().mockResolvedValue(undefined) };
    const config = {
      get: vi.fn((key: string) =>
        key === 'APP_PUBLIC_URL'
          ? 'https://dungeon.example.test'
          : key === 'SMTP_URL'
            ? 'smtps://configured'
            : undefined,
      ),
    };
    const service = new CampaignInvitationMailer(
      mailer as never,
      config as never,
    );

    await expect(
      service.send(
        'player@example.test',
        'Campaign',
        'dm@example.test',
        'one-time-token',
      ),
    ).resolves.toBe('smtp');
    expect(mailer.send).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ to: 'player@example.test' }),
    );
  });
});
