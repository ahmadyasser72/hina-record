import { defineRelations } from "drizzle-orm";

import * as profile from "./tables/profile";
import * as tracker from "./tables/tracker";

export const relations = defineRelations({ ...profile, ...tracker }, (r) => ({
	profileSnapshots: {
		changes: r.many.profileSnapshotChanges({
			from: [r.profileSnapshots.timestamp, r.profileSnapshots.uid],
			to: [r.profileSnapshotChanges.timestamp, r.profileSnapshotChanges.uid],
		}),

		previous: r.one.profileSnapshots({
			from: r.profileSnapshots.previousId,
			to: r.profileSnapshots.id,
			optional: true,
		}),
		next: r.one.profileSnapshots({
			from: r.profileSnapshots.id,
			to: r.profileSnapshots.previousId,
			optional: true,
		}),
	},

	trackerReferences: {
		snapshots: r.many.trackerSnapshots({
			from: [r.trackerReferences.kind, r.trackerReferences.id],
			to: [r.trackerSnapshots.trackerKind, r.trackerSnapshots.trackerId],
		}),
	},
	trackerSnapshots: {
		top: r.many.trackerSnapshotsTop({
			from: r.trackerSnapshots.id.through(r.trackerSnapshotsToTop.snapshotId),
			to: r.trackerSnapshotsTop.id.through(r.trackerSnapshotsToTop.topId),
		}),
	},
	trackerSnapshotsTop: {
		snapshot: r.one.trackerSnapshots({
			from: r.trackerSnapshotsTop.snapshotId,
			to: r.trackerSnapshots.id,
			optional: false,
		}),
		profile: r.one.trackerSnapshotsTopProfiles({
			from: r.trackerSnapshotsTop.profileId,
			to: r.trackerSnapshotsTopProfiles.id,
			optional: true,
		}),
		session: r.one.trackerSnapshotsTopSessions({
			from: r.trackerSnapshotsTop.sessionId,
			to: r.trackerSnapshotsTopSessions.id,
			optional: true,
		}),
	},
}));
