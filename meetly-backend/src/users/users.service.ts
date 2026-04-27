import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EventStatus,
  FriendsCountVisibility,
  ReportStatus,
} from '@prisma/client';
import { suspensionMessageForViewer } from '../auth/ban-payload';

// ─── Shared select fragments ──────────────────────────────────────────────────

const EVENT_PROFILE_SELECT = {
  id: true,
  eventName: true,
  description: true,
  category: true,
  photoUrl: true,
  date: true,
  isAllDay: true,
  startTime: true,
  endTime: true,
  locationName: true,
  locationAddress: true,
  locationLatitude: true,
  locationLongitude: true,
  visibility: true,
  maxParticipants: true,
  isActive: true,
  createdAt: true,
  _count: { select: { participants: true } },
} as const;

const EVENT_WITH_CREATOR_SELECT = {
  ...EVENT_PROFILE_SELECT,
  creatorId: true,
} as const;

const EVENT_MINIMAL_SELECT = {
  id: true,
  eventName: true,
  date: true,
  photoUrl: true,
} as const;

const EVENT_MINIMAL_WITH_STATUS_SELECT = {
  ...EVENT_MINIMAL_SELECT,
  status: true,
} as const;

// ─── Response shape types ──────────────────────────────────────────────────────

type EventRow = {
  _count: { participants: number };
  [key: string]: unknown;
};

type ParticipantRow = {
  joinedAt: Date;
  event: EventRow & { isActive: boolean; creatorId: string };
};

type UserWithEvents = {
  events: EventRow[];
  eventParticipants: ParticipantRow[];
  receivedOrgRatings?: Array<{
    eventId: string;
    score: number;
    createdAt: Date;
    event: {
      id: string;
      eventName: string;
      date: Date;
      photoUrl: string | null;
    };
  }>;
  attendances?: Array<{
    eventId: string;
    status: string;
    createdAt: Date;
    event: {
      id: string;
      eventName: string;
      date: Date;
      status: EventStatus;
      photoUrl: string | null;
    };
  }>;
  [key: string]: unknown;
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public profile with events. `viewerId` — текущий пользователь (JWT); влияет на friendsCount по приватности. */
  async findById(userId: string, viewerId: string) {
    const lite = await this.prisma.user.findUnique({
      where: { id: userId, isActive: true },
      select: {
        id: true,
        username: true,
        avatar: true,
        bannedUntil: true,
        banSource: true,
        friendsCountVisibility: true,
        showFriendsInProfile: true,
        isProfileClosed: true,
      },
    });

    if (!lite) throw new NotFoundException('User not found');

    const now = new Date();
    if (lite.bannedUntil && lite.bannedUntil > now) {
      return {
        id: userId,
        accountSuspended: true,
        banSource: lite.banSource,
        suspensionMessage: suspensionMessageForViewer(lite.banSource),
      };
    }

    const isFriendWithViewer =
      userId === viewerId || (await this.areFriends(viewerId, userId));

    if (
      viewerId !== userId &&
      lite.isProfileClosed &&
      !isFriendWithViewer
    ) {
      return {
        id: lite.id,
        username: lite.username,
        avatar: lite.avatar,
        fullProfileVisibleToViewer: false,
        friendsListVisibleToViewer: false,
        friendsCount: null,
        isProfileClosed: true,
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId, isActive: true },
      select: {
        ...this.buildUserSelect(),
        friendsCountVisibility: true,
        showFriendsInProfile: true,
        isProfileClosed: true,
        bannedUntil: true,
        banSource: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const {
      bannedUntil: _bu,
      banSource: _bs,
      friendsCountVisibility,
      showFriendsInProfile,
      isProfileClosed,
      ...profile
    } = user;
    void _bu;
    void _bs;

    const formatted = this.formatProfileWithEvents(
      profile as UserWithEvents,
      userId,
    );

    const [friendCount, isFriendForCount] = await Promise.all([
      this.prisma.friendship.count({ where: { userId } }),
      userId === viewerId
        ? Promise.resolve(true)
        : this.areFriends(viewerId, userId),
    ]);

    const friendsCount = this.resolveFriendsCountForViewer(
      friendsCountVisibility,
      friendCount,
      userId,
      viewerId,
      isFriendForCount,
    );

    const fullProfileVisibleToViewer = true;
    const friendsListVisibleToViewer =
      viewerId === userId ||
      (fullProfileVisibleToViewer && showFriendsInProfile);

    const selfViewExtras =
      viewerId === userId ? { showFriendsInProfile, isProfileClosed } : {};

    return {
      ...formatted,
      friendsCount,
      friendsListVisibleToViewer,
      fullProfileVisibleToViewer,
      ...selfViewExtras,
    };
  }

  /** Own profile (includes updatedAt, phoneNumber, friendsCount, friendsCountVisibility, showFriendsInProfile, isProfileClosed) */
  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...this.buildUserSelect(),
        friendsCountVisibility: true,
        showFriendsInProfile: true,
        isProfileClosed: true,
        updatedAt: true,
        phoneNumber: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const { friendsCountVisibility, showFriendsInProfile, isProfileClosed, ...rest } =
      user;
    const formatted = this.formatProfileWithEvents(rest as UserWithEvents, userId);
    const friendsCount = await this.prisma.friendship.count({
      where: { userId },
    });

    return {
      ...formatted,
      friendsCount,
      friendsCountVisibility,
      showFriendsInProfile,
      isProfileClosed,
    };
  }

  /** Search users by username */
  async searchByUsername(query: string, limit = 10) {
    const now = new Date();
    return this.prisma.user.findMany({
      where: {
        username: { contains: query, mode: 'insensitive' },
        isActive: true,
        OR: [{ bannedUntil: null }, { bannedUntil: { lte: now } }],
      },
      select: { id: true, username: true, avatar: true },
      take: limit,
    });
  }

  /** Full user row for admin panel (any user id, including inactive / banned). */
  async getAdminUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...this.buildUserSelect(),
        updatedAt: true,
        phoneNumber: true,
        bannedUntil: true,
        banSource: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const now = new Date();
    const { phoneNumber, bannedUntil, banSource, updatedAt, ...profileCore } =
      user;

    const profile = this.formatProfileWithEvents(
      profileCore as UserWithEvents,
      userId,
    );

    const [reportsAgainst, pendingCount, resolvedCount, dismissedCount] =
      await Promise.all([
        this.prisma.report.findMany({
          where: { targetUserId: userId },
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: {
            id: true,
            status: true,
            reason: true,
            description: true,
            createdAt: true,
            reporter: { select: { id: true, username: true } },
            event: { select: { id: true, eventName: true } },
          },
        }),
        this.prisma.report.count({
          where: {
            targetUserId: userId,
            status: ReportStatus.PENDING,
          },
        }),
        this.prisma.report.count({
          where: {
            targetUserId: userId,
            status: ReportStatus.RESOLVED,
          },
        }),
        this.prisma.report.count({
          where: {
            targetUserId: userId,
            status: ReportStatus.DISMISSED,
          },
        }),
      ]);

    return {
      ...profile,
      phoneNumber,
      bannedUntil,
      banSource,
      isBannedNow: !!(bannedUntil && bannedUntil > now),
      updatedAt,
      reportsAgainstUser: {
        items: reportsAgainst,
        summary: {
          pending: pendingCount,
          resolved: resolvedCount,
          dismissed: dismissedCount,
          total: pendingCount + resolvedCount + dismissedCount,
        },
      },
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /** Число друзей на чужом профиле: `null`, если владелец скрыл счётчик для этого зрителя. */
  private resolveFriendsCountForViewer(
    visibility: FriendsCountVisibility,
    count: number,
    profileUserId: string,
    viewerId: string,
    viewerIsFriend: boolean,
  ): number | null {
    if (profileUserId === viewerId) {
      return count;
    }
    switch (visibility) {
      case FriendsCountVisibility.EVERYONE:
        return count;
      case FriendsCountVisibility.FRIENDS_ONLY:
        return viewerIsFriend ? count : null;
      case FriendsCountVisibility.NOONE:
        return null;
      default:
        return null;
    }
  }

  private async areFriends(a: string, b: string): Promise<boolean> {
    const edge = await this.prisma.friendship.findUnique({
      where: { userId_friendId: { userId: a, friendId: b } },
    });
    return !!edge;
  }

  private buildUserSelect() {
    return {
      id: true,
      username: true,
      avatar: true,
      bio: true,
      age: true,
      interests: true,
      isActive: true,
      createdAt: true,
      rating: true,
      totalAttended: true,
      organizerRating: true,
      organizerRatingCount: true,
      events: {
        where: { isActive: true },
        select: EVENT_PROFILE_SELECT,
        orderBy: { date: 'desc' as const },
      },
      eventParticipants: {
        select: {
          joinedAt: true,
          event: { select: EVENT_WITH_CREATOR_SELECT },
        },
        orderBy: { joinedAt: 'desc' as const },
      },
      receivedOrgRatings: {
        select: {
          eventId: true,
          score: true,
          createdAt: true,
          event: { select: EVENT_MINIMAL_SELECT },
        },
        orderBy: { createdAt: 'desc' as const },
      },
      attendances: {
        select: {
          eventId: true,
          status: true,
          createdAt: true,
          event: { select: EVENT_MINIMAL_WITH_STATUS_SELECT },
        },
        orderBy: { createdAt: 'desc' as const },
      },
    };
  }

  /**
   * Splits raw DB data into `createdEvents` and `participatingEvents`,
   * deduplicating events where the creator is also a participant.
   * Adds organizerRatingsReceived and attendanceHistory for karma display.
   */
  private formatProfileWithEvents(user: UserWithEvents, userId: string) {
    const {
      events,
      eventParticipants,
      receivedOrgRatings = [],
      attendances = [],
      ...profile
    } = user;

    const createdEvents = events.map(({ _count, ...rest }) => ({
      ...rest,
      participantsCount: _count.participants,
    }));

    const participatingEvents = eventParticipants
      .filter((ep) => ep.event.isActive && ep.event.creatorId !== userId)
      .map(({ joinedAt, event }) => {
        // creatorId excluded from response
        const { creatorId: _cid, _count, ...eventData } = event;
        void _cid;
        return {
          ...eventData,
          participantsCount: _count.participants,
          joinedAt,
        };
      });

    const organizerRatingsReceived = receivedOrgRatings.map((r) => ({
      eventId: r.eventId,
      eventName: r.event.eventName,
      date: r.event.date,
      photoUrl: r.event.photoUrl,
      score: r.score,
      createdAt: r.createdAt,
    }));

    const attendanceHistory = attendances.map((a) => {
      let outcome: 'attended' | 'no_show' | 'left' | 'pending' = 'pending';
      if (a.status === 'LEFT') outcome = 'left';
      else if (a.status === 'CONFIRMED') outcome = 'attended';
      else if (
        a.status === 'JOINED' &&
        a.event.status === EventStatus.FINALIZED
      )
        outcome = 'no_show';
      else if (a.status === 'JOINED') outcome = 'pending';

      return {
        eventId: a.eventId,
        eventName: a.event.eventName,
        date: a.event.date,
        photoUrl: a.event.photoUrl,
        status: a.status,
        outcome,
        createdAt: a.createdAt,
      };
    });

    return {
      ...profile,
      createdEvents,
      participatingEvents,
      createdEventsCount: createdEvents.length,
      participatingEventsCount: participatingEvents.length,
      organizerRatingsReceived,
      attendanceHistory,
    };
  }
}
