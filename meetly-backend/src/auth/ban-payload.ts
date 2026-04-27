import { BanSource } from '@prisma/client';

export const ACCOUNT_BANNED_CODE = 'ACCOUNT_BANNED' as const;

export function suspensionMessageForViewer(banSource: BanSource): string {
  if (banSource === BanSource.ADMIN) {
    return 'Аккаунт временно заблокирован администрацией Meetly.';
  }
  if (banSource === BanSource.REPORTS) {
    return 'Аккаунт временно заблокирован за нарушение правил (модерация).';
  }
  return 'Аккаунт временно заблокирован.';
}

export function buildAccountBannedPayload(
  banSource: BanSource,
  bannedUntil: Date,
): {
  message: string;
  code: typeof ACCOUNT_BANNED_CODE;
  banSource: BanSource;
  bannedUntil: string;
} {
  return {
    message: suspensionMessageForViewer(banSource),
    code: ACCOUNT_BANNED_CODE,
    banSource,
    bannedUntil: bannedUntil.toISOString(),
  };
}

export function isAccountBannedUnauthorized(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const ex = err as {
    getResponse?: () => unknown;
    response?: unknown;
  };
  const body =
    typeof ex.getResponse === 'function' ? ex.getResponse() : ex.response;
  return (
    typeof body === 'object' &&
    body !== null &&
    'code' in body &&
    (body as { code: string }).code === ACCOUNT_BANNED_CODE
  );
}
