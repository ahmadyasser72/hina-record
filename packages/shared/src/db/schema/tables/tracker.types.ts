import { MasterMonthlyRankingSchema } from "#root/gbp/gen/suite_master_pb.ts";
import {
	ChallengeTrackerSchema,
	FestivalTrackerSchema,
	LiveTryTrackerSchema,
	MedleyTrackerSchema,
	MissionLiveTrackerSchema,
	VersusTrackerSchema,
} from "#root/gbp/gen/tracker_metadata_pb.ts";
import { ChallengeRankingSchema } from "#root/gbp/gen/tracker_ranking_challenge_pb.ts";
import { DefaultRankingSchema } from "#root/gbp/gen/tracker_ranking_default_pb.ts";
import { MedleyRankingSchema } from "#root/gbp/gen/tracker_ranking_medley_pb.ts";
import { VersusRankingSchema } from "#root/gbp/gen/tracker_ranking_versus_pb.ts";

export const TrackerKind = ["event", "monthly"] as const;
export type TrackerKind = (typeof TrackerKind)[number];

export const TrackerProtoSchema = {
	challenge: ChallengeTrackerSchema,
	versus: VersusTrackerSchema,
	liveTry: LiveTryTrackerSchema,
	missionLive: MissionLiveTrackerSchema,
	festival: FestivalTrackerSchema,
	medley: MedleyTrackerSchema,
	monthly: MasterMonthlyRankingSchema,
} as const;

export const TrackerRankingProtoSchema = {
	challenge: ChallengeRankingSchema,
	versus: VersusRankingSchema,
	liveTry: DefaultRankingSchema,
	missionLive: DefaultRankingSchema,
	festival: DefaultRankingSchema,
	medley: MedleyRankingSchema,
	monthly: DefaultRankingSchema,
} as const satisfies Record<TrackerType, unknown>;

export type TrackerType = keyof typeof TrackerProtoSchema;
export const TrackerType = Object.keys(TrackerProtoSchema) as TrackerType[];
