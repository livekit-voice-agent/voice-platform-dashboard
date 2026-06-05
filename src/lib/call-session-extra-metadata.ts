type SessionLike = {
  extra_metadata?: Record<string, unknown> | null;
  metadata?: string | null;
};

function isNonEmptyRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.keys(value).length > 0;
}

export function getCallSessionExtraMetadata(session: SessionLike): Record<string, unknown> | null {
  if (isNonEmptyRecord(session.extra_metadata)) {
    return session.extra_metadata;
  }

  if (!session.metadata) {
    return null;
  }

  try {
    const parsed = JSON.parse(session.metadata) as Record<string, unknown>;
    const candidates = [
      parsed.extra_metadata,
      (parsed.call_session as Record<string, unknown> | undefined)?.extra_metadata,
      (parsed.callSession as Record<string, unknown> | undefined)?.extra_metadata,
    ];

    return candidates.find(isNonEmptyRecord) ?? null;
  } catch {
    return null;
  }
}
