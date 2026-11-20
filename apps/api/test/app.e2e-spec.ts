import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { CampaignInvitationMailer } from '../src/modules/campaigns/campaign-invitation-mail.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sentTokens: string[];

  beforeEach(async () => {
    sentTokens = [];
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CampaignInvitationMailer)
      .useValue({
        send: vi.fn(
          async (
            _email: string,
            _title: string,
            _inviter: string,
            token: string,
          ) => {
            sentTokens.push(token);
            return 'smtp';
          },
        ),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    await app.init();
    prisma = app.get(PrismaService);
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('protects campaign and invitation routes from unauthenticated requests', async () => {
    await request(app.getHttpServer()).get('/campaigns').expect(401);
    await request(app.getHttpServer())
      .post('/campaign-invitations/accept')
      .send({ token: 'a'.repeat(43) })
      .expect(401);
  });

  it('enforces membership roles through the authenticated campaign flows', async () => {
    const suffix = randomUUID();
    const password = 'test-password-with-12-chars';
    const passwordHash = await app.get(PasswordHasher).hash(password);
    const ipSeed = suffix.replaceAll('-', '');
    const ownerIp = `2001:db8::${ipSeed.slice(0, 8)}`;
    const playerIp = `2001:db8::${ipSeed.slice(8, 16)}`;
    const owner = await prisma.user.create({
      data: {
        email: `v05-owner-${suffix}@example.test`,
        emailVerified: true,
        passwordHash,
      },
    });
    const player = await prisma.user.create({
      data: {
        email: `v05-player-${suffix}@example.test`,
        emailVerified: true,
        passwordHash,
      },
    });
    let campaignId: string | undefined;
    const ownerAgent = request.agent(app.getHttpServer());
    const playerAgent = request.agent(app.getHttpServer());

    try {
      await ownerAgent
        .post('/auth/sign-in')
        .set('Origin', 'http://localhost:5173')
        .set('X-Forwarded-For', ownerIp)
        .send({ email: owner.email, password })
        .expect(200);
      await playerAgent
        .post('/auth/sign-in')
        .set('Origin', 'http://localhost:5173')
        .set('X-Forwarded-For', playerIp)
        .send({ email: player.email, password })
        .expect(200);

      const created = await ownerAgent
        .post('/campaigns')
        .send({ title: `Integration campaign ${suffix}` })
        .expect(201);
      campaignId = created.body.id as string;
      expect(created.body.ownerId).toBe(owner.id);

      await ownerAgent
        .post(`/campaigns/${campaignId}/invitations`)
        .set('X-Forwarded-For', ownerIp)
        .send({ email: 'not-an-email' })
        .expect(400);
      const invitation = await ownerAgent
        .post(`/campaigns/${campaignId}/invitations`)
        .set('X-Forwarded-For', ownerIp)
        .send({ email: player.email })
        .expect(201);
      expect(invitation.body).not.toHaveProperty('tokenHash');
      expect(invitation.body.delivery).toBe('smtp');
      expect(sentTokens).toHaveLength(1);
      const pendingInvitations = await ownerAgent
        .get(`/campaigns/${campaignId}/invitations`)
        .expect(200);
      expect(pendingInvitations.body).toHaveLength(1);

      const secondInvitation = await ownerAgent
        .post(`/campaigns/${campaignId}/invitations`)
        .set('X-Forwarded-For', ownerIp)
        .send({ email: `pending-${suffix}@example.test` })
        .expect(201);
      expect(sentTokens).toHaveLength(2);
      await ownerAgent
        .post(
          `/campaigns/${campaignId}/invitations/${secondInvitation.body.id}/revoke`,
        )
        .expect(201);
      expect(
        (
          await ownerAgent
            .get(`/campaigns/${campaignId}/invitations`)
            .expect(200)
        ).body,
      ).toHaveLength(1);
      await ownerAgent
        .post(`/campaigns/${campaignId}/invitations`)
        .set('X-Forwarded-For', ownerIp)
        .send({ email: player.email })
        .expect(409);

      const hiddenCampaigns = await playerAgent.get('/campaigns').expect(200);
      expect(hiddenCampaigns.body).toEqual([]);
      const accepted = await playerAgent
        .post('/campaign-invitations/accept')
        .send({ token: sentTokens[0] })
        .expect(200);
      expect(accepted.body).toEqual({ accepted: true, campaignId });
      expect(
        (await playerAgent.get('/campaigns').expect(200)).body,
      ).toHaveLength(1);
      expect(
        (await playerAgent.get(`/campaigns/${campaignId}/members`).expect(200))
          .body,
      ).toHaveLength(2);
      await playerAgent
        .post(`/campaigns/${campaignId}/invitations`)
        .set('X-Forwarded-For', playerIp)
        .send({ email: `unauthorized-${suffix}@example.test` })
        .expect(403);

      await playerAgent
        .patch(`/campaigns/${campaignId}`)
        .send({ title: 'Player cannot edit this yet' })
        .expect(403);
      await ownerAgent
        .patch(`/campaigns/${campaignId}/members/${player.id}`)
        .send({ role: 'DM' })
        .expect(200);
      await playerAgent
        .patch(`/campaigns/${campaignId}`)
        .send({ title: 'Promoted DM can edit' })
        .expect(200);
      await playerAgent
        .delete(`/campaigns/${campaignId}/members/${owner.id}`)
        .expect(400);

      await ownerAgent
        .patch(`/campaigns/${campaignId}/members/${player.id}`)
        .send({ role: 'PLAYER' })
        .expect(200);
      await playerAgent
        .patch(`/campaigns/${campaignId}`)
        .send({ title: 'Player access removed' })
        .expect(403);
      await ownerAgent
        .delete(`/campaigns/${campaignId}/members/${player.id}`)
        .expect(200);
      expect((await playerAgent.get('/campaigns').expect(200)).body).toEqual(
        [],
      );
      await playerAgent
        .post('/campaign-invitations/accept')
        .send({ token: sentTokens[0] })
        .expect(400);

      await ownerAgent
        .post(`/campaigns/${campaignId}/invitations`)
        .set('X-Forwarded-For', ownerIp)
        .send({ email: player.email })
        .expect(201);
      const rejected = await playerAgent
        .post('/campaign-invitations/reject')
        .send({ token: sentTokens[2] })
        .expect(200);
      expect(rejected.body).toEqual({ rejected: true });
      await playerAgent
        .post('/campaign-invitations/accept')
        .send({ token: sentTokens[2] })
        .expect(400);
    } finally {
      if (campaignId)
        await prisma.campaign.deleteMany({ where: { id: campaignId } });
      await prisma.user.deleteMany({
        where: { id: { in: [owner.id, player.id] } },
      });
    }
  });

  afterEach(async () => {
    await app.close();
  });
});
