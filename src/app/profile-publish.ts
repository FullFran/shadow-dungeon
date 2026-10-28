import type { AccountApi, ProfileFields } from '../adapters/account-api';
import { isPublicNickname } from '../net/nickname';

/**
 * The account's public profile (`profiles`, odd/tasks/sima-global-ranking.md
 * T4): the online nickname from Settings and the species played, so the Sima
 * global ranking can name the player. Written only while signed in and only
 * with a nickname the server accepts (an empty or unclean one writes
 * nothing). Idempotent and cheap: it remembers what it last wrote for which
 * account and only calls the server when that changes; one call runs at a
 * time. Best effort: a failure is forgotten and retried on the next sync,
 * and nothing here ever throws or blocks play or sync.
 */
export interface ProfilePublisher {
  /** The account synced with the cloud (null: signed out). */
  synced(session: { token: string; userId: string } | null): void;
  /** The nickname or species may have changed (Settings). */
  changed(): void;
}

/** The server's `avatarSpecies` pattern; anything else goes as none. */
const AVATAR = /^[a-z0-9-]{1,32}$/;

export function profilePublisher(deps: { api: Pick<AccountApi, 'getProfile' | 'createProfile' | 'updateProfile'>; nickname(): string; species(): string }): ProfilePublisher {
  let session: { token: string; userId: string } | null = null;
  /** What is on the server for `userId`, as far as this tab knows. */
  let known: { userId: string; id: string; fields: ProfileFields } | null = null;
  let busy = false;
  let again = false;

  const wanted = (): ProfileFields | null => {
    const nickname = deps.nickname();
    if (!isPublicNickname(nickname)) return null;
    const species = deps.species();
    return { nickname, avatarSpecies: AVATAR.test(species) ? species : '' };
  };
  const same = (a: ProfileFields, b: ProfileFields) => a.nickname === b.nickname && a.avatarSpecies === b.avatarSpecies;

  async function write(s: { token: string; userId: string }, fields: ProfileFields): Promise<void> {
    let current = known && known.userId === s.userId ? known : null;
    if (!current) {
      const found = await deps.api.getProfile(s.token, s.userId);
      if (!found.ok) return;
      if (found.value) current = { userId: s.userId, id: found.value.id, fields: { nickname: found.value.nickname, avatarSpecies: found.value.avatarSpecies } };
    }
    if (current && same(current.fields, fields)) {
      known = current;
      return;
    }
    const result = current ? await deps.api.updateProfile(s.token, current.id, fields) : await deps.api.createProfile(s.token, s.userId, fields);
    // A failure leaves `known` unset for this account, so the next sync looks again.
    known = result.ok ? { userId: s.userId, id: result.value.id, fields } : null;
  }

  function publish(): void {
    const s = session;
    if (!s) return;
    let fields: ProfileFields | null;
    try {
      fields = wanted();
    } catch {
      return;
    }
    if (!fields || (known && known.userId === s.userId && same(known.fields, fields))) return;
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    let pending: Promise<void>;
    try {
      pending = write(s, fields);
    } catch {
      pending = Promise.resolve();
    }
    pending
      .catch(() => {
        known = null;
      })
      .finally(() => {
        busy = false;
        if (again) {
          again = false;
          publish();
        }
      });
  }

  return {
    synced(next) {
      session = next;
      publish();
    },
    changed: publish,
  };
}
