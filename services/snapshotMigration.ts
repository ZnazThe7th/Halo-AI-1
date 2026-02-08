/**
 * Snapshot versioning and migration.
 * Each snapshot is tagged with a version number.
 * When loading a snapshot with an older version, migration functions run sequentially.
 */

// Current snapshot version — bump this when the shape of app state changes
export const SNAPSHOT_VERSION = 1;

export interface AppSnapshot {
  version: number;
  businessProfile: any;
  clients: any[];
  appointments: any[];
  expenses: any[];
  ratings: any[];
  bonusEntries: any[];
}

/**
 * Migration registry: key = source version, value = function that upgrades to version+1
 * Example: when bumping to v2, add:
 *   1: (snapshot) => ({ ...snapshot, version: 2, newField: defaultValue })
 */
const migrations: Record<number, (snapshot: AppSnapshot) => AppSnapshot> = {
  // Example migration from v1 -> v2 (uncomment when needed):
  // 1: (snapshot) => ({
  //   ...snapshot,
  //   version: 2,
  //   // Add any new fields with defaults
  //   businessProfile: {
  //     ...snapshot.businessProfile,
  //     newFeatureEnabled: false,
  //   },
  // }),
};

/**
 * Migrate a snapshot from its version to the current version.
 * Runs each migration step sequentially.
 */
export function migrateSnapshot(snapshot: AppSnapshot): AppSnapshot {
  let current = { ...snapshot };

  // If no version, assume v1
  if (!current.version) {
    current.version = 1;
  }

  while (current.version < SNAPSHOT_VERSION) {
    const migrateFn = migrations[current.version];
    if (!migrateFn) {
      console.warn(`No migration found for version ${current.version} -> ${current.version + 1}. Forcing version to current.`);
      current.version = SNAPSHOT_VERSION;
      break;
    }
    console.log(`Migrating snapshot from v${current.version} to v${current.version + 1}`);
    current = migrateFn(current);
  }

  return current;
}

/**
 * Create a snapshot from current app state
 */
export function createSnapshot(state: {
  businessProfile: any;
  clients: any[];
  appointments: any[];
  expenses: any[];
  ratings: any[];
  bonusEntries: any[];
}): AppSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    businessProfile: state.businessProfile,
    clients: state.clients,
    appointments: state.appointments,
    expenses: state.expenses,
    ratings: state.ratings,
    bonusEntries: state.bonusEntries || [],
  };
}
