import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { FriendsCountVisibility, BanSource } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: { findUnique: jest.Mock };
    friendship: { findUnique: jest.Mock; count: jest.Mock };
  };

  const liteRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'target',
    username: 'target',
    avatar: 'a.png',
    bannedUntil: null,
    banSource: BanSource.NONE,
    friendsCountVisibility: FriendsCountVisibility.EVERYONE,
    showFriendsInProfile: true,
    isProfileClosed: false,
    ...overrides,
  });

  const fullUserRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'target',
    username: 'target',
    avatar: 'a.png',
    bio: null,
    age: null,
    interests: [] as string[],
    isActive: true,
    createdAt: new Date(),
    rating: 0,
    totalAttended: 0,
    organizerRating: 0,
    organizerRatingCount: 0,
    events: [],
    eventParticipants: [],
    receivedOrgRatings: [],
    attendances: [],
    friendsCountVisibility: FriendsCountVisibility.EVERYONE,
    showFriendsInProfile: true,
    isProfileClosed: false,
    bannedUntil: null,
    banSource: BanSource.NONE,
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      friendship: { findUnique: jest.fn(), count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('returns minimal payload when profile is closed and viewer is not a friend', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(
        liteRow({ isProfileClosed: true }),
      );
      prisma.friendship.findUnique.mockResolvedValue(null);

      const result = await service.findById('target', 'viewer');

      expect(result).toEqual({
        id: 'target',
        username: 'target',
        avatar: 'a.png',
        fullProfileVisibleToViewer: false,
        friendsListVisibleToViewer: false,
        friendsCount: null,
        isProfileClosed: true,
      });
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    });

    it('returns full profile for stranger when profile is open; friendsList follows showFriendsInProfile', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(
          liteRow({ isProfileClosed: false, showFriendsInProfile: false }),
        )
        .mockResolvedValueOnce(
          fullUserRow({ showFriendsInProfile: false, isProfileClosed: false }),
        );
      prisma.friendship.findUnique.mockResolvedValue(null);
      prisma.friendship.count.mockResolvedValue(3);

      const result = (await service.findById(
        'target',
        'viewer',
      )) as Record<string, unknown>;

      expect(result.fullProfileVisibleToViewer).toBe(true);
      expect(result.friendsListVisibleToViewer).toBe(false);
      expect(result.showFriendsInProfile).toBeUndefined();
      expect(result.friendsCount).toBe(3);
      expect(result.createdEvents).toEqual([]);
    });

    it('hides friends list for a friend when showFriendsInProfile is false', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(
          liteRow({ isProfileClosed: true, showFriendsInProfile: false }),
        )
        .mockResolvedValueOnce(
          fullUserRow({
            isProfileClosed: true,
            showFriendsInProfile: false,
          }),
        );
      prisma.friendship.findUnique.mockResolvedValue({ id: 'edge' });
      prisma.friendship.count.mockResolvedValue(2);

      const result = (await service.findById(
        'target',
        'viewer',
      )) as Record<string, unknown>;

      expect(result.fullProfileVisibleToViewer).toBe(true);
      expect(result.friendsListVisibleToViewer).toBe(false);
    });

    it('includes privacy toggles when viewer is the profile owner', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(
          liteRow({
            id: 'me',
            isProfileClosed: true,
            showFriendsInProfile: false,
          }),
        )
        .mockResolvedValueOnce(
          fullUserRow({
            id: 'me',
            isProfileClosed: true,
            showFriendsInProfile: false,
          }),
        );
      prisma.friendship.count.mockResolvedValue(1);

      const result = (await service.findById('me', 'me')) as Record<
        string,
        unknown
      >;

      expect(result.showFriendsInProfile).toBe(false);
      expect(result.isProfileClosed).toBe(true);
      expect(result.fullProfileVisibleToViewer).toBe(true);
      expect(result.friendsListVisibleToViewer).toBe(true);
    });

    it('throws when user is missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('nope', 'viewer')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
