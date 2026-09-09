export type { IArticleViewCommandRepository } from "./article-view.command-repository.interface";
export type { IArticleViewQueryRepository } from "./article-view.query-repository.interface";
export {
  logScoreAfterReaction,
  logScoreAfterReactionRemoved,
  logScoreAfterView,
  REACTION_WEIGHT_IN_VIEWS,
  reactionWeightLog,
  VIEW_SCORE_EPOCH,
  VIEW_SCORE_HALF_LIFE_DAYS,
  viewWeightLog,
} from "./view-ranking";
