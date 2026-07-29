/**
 * Rule that decides whether a detected survey can be loaded as "pública".
 *
 * A public (named) survey shows who answered what, so it is only possible when
 * the uploaded files carry individual participants **and** each participant's
 * own answers. Anything else — aggregated reports, or a participant roster with
 * no per-person answers — can only be loaded as anonymous, and the UI blocks
 * the choice instead of letting the user pick something we can't honor.
 */
import type { DetectedParticipant, DetectedSurveyAnalysis, ParticipantMatchStatus } from "./types";

export type PublicVisibilityBlock = "no-participants" | "answers-not-linked";

/** Why this survey can't be public, or null when it can. */
export function publicVisibilityBlock(analysis: DetectedSurveyAnalysis): PublicVisibilityBlock | null {
  const detection = analysis.participants;
  if (!detection || detection.participants.length === 0) return "no-participants";
  if (!detection.answersLinked) return "answers-not-linked";
  return null;
}

/** User-facing explanation for each reason the public option is unavailable. */
export const PUBLIC_VISIBILITY_BLOCK_MESSAGE: Record<PublicVisibilityBlock, string> = {
  "no-participants":
    "Los archivos traen resultados agregados, no participantes con sus respuestas individuales. Por eso esta encuesta solo puede cargarse como anónima.",
  "answers-not-linked":
    "Detectamos participantes, pero sus respuestas no están asociadas a cada persona. Sin ese vínculo la encuesta solo puede cargarse como anónima.",
};

/**
 * What the user decided about a participant the system did not link on its own:
 * either tie them to a specific UBITS user (the suggested one, or any other
 * picked from the directory), or keep them inside the survey.
 */
export type ParticipantResolution =
  | { kind: "linked"; username: string }
  | { kind: "separate" };

/** Decisions taken so far, keyed by the participant's `identifier`. */
export type ParticipantResolutions = Record<string, ParticipantResolution>;

export interface ParticipantMatchSplit {
  total: number;
  /** Username matched in UBITS, or a name-only match the user confirmed. */
  matched: DetectedParticipant[];
  /** Name-only candidates still waiting for a decision. */
  possible: DetectedParticipant[];
  /** Created inside the survey only, either by default or by the user's choice. */
  unmatched: DetectedParticipant[];
}

/**
 * Where a participant lands once the user's decisions are applied.
 *
 * A `possible` match is never resolved automatically: until someone confirms or
 * rejects it, it stays pending. An `unmatched` participant can still be linked
 * by hand to any directory user, which moves them to `matched`. A participant
 * whose username already matched is left alone.
 */
export function effectiveMatchStatus(
  participant: DetectedParticipant,
  resolutions: ParticipantResolutions = {}
): ParticipantMatchStatus {
  if (participant.matchStatus === "matched") return "matched";

  const decision = resolutions[participant.identifier];
  if (decision?.kind === "linked") return "matched";
  if (decision?.kind === "separate") return "unmatched";

  return participant.matchStatus;
}

/**
 * Groups detected participants into the three scenarios the review step shows,
 * honoring the decisions already taken on name-only candidates. Unmatched people
 * are still loaded — they just live inside the survey instead of being linked to
 * a UBITS user.
 */
export function splitParticipantsByMatch(
  participants: DetectedParticipant[],
  resolutions: ParticipantResolutions = {}
): ParticipantMatchSplit {
  const byStatus = (status: ParticipantMatchStatus) =>
    participants.filter((p) => effectiveMatchStatus(p, resolutions) === status);

  return {
    total: participants.length,
    matched: byStatus("matched"),
    possible: byStatus("possible"),
    unmatched: byStatus("unmatched"),
  };
}

/**
 * UBITS usernames already tied to somebody in this batch — either matched
 * automatically (where the identifier IS the username) or linked by hand. Lets
 * the directory picker stop one user being attached to two different people.
 */
export function linkedUsernames(
  participants: DetectedParticipant[],
  resolutions: ParticipantResolutions = {}
): Set<string> {
  const taken = new Set<string>();
  participants.forEach((participant) => {
    if (participant.matchStatus === "matched") {
      taken.add(participant.identifier);
      return;
    }
    const decision = resolutions[participant.identifier];
    if (decision?.kind === "linked") taken.add(decision.username);
  });
  return taken;
}

const IDENTIFIER_TYPE_LABEL: Record<DetectedParticipant["identifierType"], string> = {
  correo: "Correo",
  numero: "Número de documento",
  username: "Username asignado",
};

/** Human label for the kind of username a participant was identified with. */
export function identifierTypeLabel(type: DetectedParticipant["identifierType"]): string {
  return IDENTIFIER_TYPE_LABEL[type];
}
