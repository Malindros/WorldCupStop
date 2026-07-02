-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'GITHUB');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('POST', 'THREAD');

-- CreateEnum
CREATE TYPE "ReportReasonCode" AS ENUM ('SPAM', 'HARASSMENT', 'HATE_SPEECH', 'VIOLENCE', 'SEXUAL_CONTENT', 'MISINFORMATION', 'OTHER', 'SYSTEM_FLAGGED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED', 'ACTIONED');

-- CreateEnum
CREATE TYPE "BanAppealStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('DISMISS', 'HIDE', 'BAN', 'UNBAN');

-- CreateTable
CREATE TABLE "Media" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "metadata" JSONB,
    "uploadedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" SERIAL NOT NULL,
    "followerId" INTEGER NOT NULL,
    "followeeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "password" TEXT NOT NULL,
    "authProvider" "AuthProvider",
    "authProviderUserId" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "favoriteTeamId" INTEGER,
    "avatarMediaId" INTEGER,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banUntil" TIMESTAMP(3),
    "banReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranslationCache" (
    "id" SERIAL NOT NULL,
    "originalTextHash" TEXT NOT NULL,
    "sourceLanguage" TEXT,
    "targetLanguage" TEXT NOT NULL,
    "translatedText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranslationCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" SERIAL NOT NULL,
    "threadId" INTEGER,
    "authorId" INTEGER NOT NULL,
    "parentPostId" INTEGER,
    "content" TEXT NOT NULL,
    "language" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" SERIAL NOT NULL,
    "reporterId" INTEGER,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" INTEGER NOT NULL,
    "reasonCode" "ReportReasonCode" NOT NULL DEFAULT 'OTHER',
    "additionalComment" TEXT,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewerId" INTEGER,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostEdit" (
    "id" SERIAL NOT NULL,
    "editorId" INTEGER,
    "previousContent" TEXT NOT NULL,
    "language" TEXT,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postId" INTEGER NOT NULL,

    CONSTRAINT "PostEdit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "slug" TEXT,
    "tla" TEXT,
    "crest" TEXT,
    "address" TEXT,
    "website" TEXT,
    "founded" INTEGER,
    "clubColors" TEXT,
    "venue" TEXT,
    "area" JSONB,
    "runningCompetitions" JSONB,
    "coach" JSONB,
    "marketValue" INTEGER,
    "squad" JSONB,
    "staff" JSONB,
    "lastUpdated" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" SERIAL NOT NULL,
    "externalId" TEXT,
    "homeTeamId" INTEGER NOT NULL,
    "awayTeamId" INTEGER NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "utcDate" TIMESTAMP(3),
    "minute" INTEGER,
    "injuryTime" INTEGER,
    "attendance" INTEGER,
    "venue" TEXT,
    "matchday" INTEGER,
    "stage" TEXT,
    "group" TEXT,
    "lastUpdated" TIMESTAMP(3),
    "seasonId" INTEGER,
    "homeDetails" JSONB,
    "awayDetails" JSONB,
    "score" JSONB,
    "goals" JSONB,
    "penalties" JSONB,
    "bookings" JSONB,
    "substitutions" JSONB,
    "odds" JSONB,
    "referees" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" SERIAL NOT NULL,
    "externalId" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "currentMatchday" INTEGER,
    "winner" INTEGER,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiModerationVerdict" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "reportId" INTEGER,
    "verdict" TEXT NOT NULL,
    "toxicityScore" DOUBLE PRECISION,
    "explanation" TEXT,
    "contentSnapshot" TEXT,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiModerationVerdict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamStanding" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "played" INTEGER,
    "wins" INTEGER,
    "draws" INTEGER,
    "losses" INTEGER,
    "goalsFor" INTEGER,
    "goalsAgainst" INTEGER,
    "goalDifference" INTEGER,
    "points" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamStanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyDigest" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "generatedById" INTEGER,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyDigest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumThread" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "autoOpenAt" TIMESTAMP(3),
    "autoCloseAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "matchId" INTEGER,
    "teamId" INTEGER,
    "authorId" INTEGER,

    CONSTRAINT "ForumThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" SERIAL NOT NULL,
    "threadId" INTEGER,
    "question" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollOption" (
    "id" SERIAL NOT NULL,
    "pollId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "id" SERIAL NOT NULL,
    "pollId" INTEGER NOT NULL,
    "optionId" INTEGER NOT NULL,
    "voterId" INTEGER NOT NULL,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER,
    "actionType" "ModerationActionType" NOT NULL,
    "performedById" INTEGER NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ban" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "bannedById" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "until" TIMESTAMP(3),
    "liftedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ban_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BanAppeal" (
    "id" SERIAL NOT NULL,
    "banId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "status" "BanAppealStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" INTEGER,

    CONSTRAINT "BanAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentimentSummary" (
    "id" SERIAL NOT NULL,
    "threadId" INTEGER NOT NULL,
    "matchId" INTEGER,
    "teamId" INTEGER,
    "scope" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentimentSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ForumThreadToTag" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ForumThreadToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Follow_followeeId_idx" ON "Follow"("followeeId");

-- CreateIndex
CREATE INDEX "Follow_followerId_idx" ON "Follow"("followerId");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followerId_followeeId_key" ON "Follow"("followerId", "followeeId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_avatarMediaId_key" ON "User"("avatarMediaId");

-- CreateIndex
CREATE UNIQUE INDEX "User_authProvider_authProviderUserId_key" ON "User"("authProvider", "authProviderUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TranslationCache_originalTextHash_key" ON "TranslationCache"("originalTextHash");

-- CreateIndex
CREATE UNIQUE INDEX "Report_reporterId_targetType_targetId_key" ON "Report"("reporterId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_externalId_key" ON "Team"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Match_externalId_key" ON "Match"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Season_externalId_key" ON "Season"("externalId");

-- CreateIndex
CREATE INDEX "AiModerationVerdict_postId_createdAt_idx" ON "AiModerationVerdict"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "AiModerationVerdict_reportId_idx" ON "AiModerationVerdict"("reportId");

-- CreateIndex
CREATE INDEX "TeamStanding_updatedAt_idx" ON "TeamStanding"("updatedAt");

-- CreateIndex
CREATE INDEX "TeamStanding_teamId_updatedAt_idx" ON "TeamStanding"("teamId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyDigest_date_key" ON "DailyDigest"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ForumThread_slug_key" ON "ForumThread"("slug");

-- CreateIndex
CREATE INDEX "ForumThread_teamId_idx" ON "ForumThread"("teamId");

-- CreateIndex
CREATE INDEX "ForumThread_matchId_idx" ON "ForumThread"("matchId");

-- CreateIndex
CREATE INDEX "ForumThread_authorId_idx" ON "ForumThread"("authorId");

-- CreateIndex
CREATE INDEX "ForumThread_createdAt_idx" ON "ForumThread"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "Poll_threadId_idx" ON "Poll"("threadId");

-- CreateIndex
CREATE INDEX "Poll_createdById_idx" ON "Poll"("createdById");

-- CreateIndex
CREATE INDEX "Poll_isClosed_idx" ON "Poll"("isClosed");

-- CreateIndex
CREATE INDEX "PollOption_pollId_idx" ON "PollOption"("pollId");

-- CreateIndex
CREATE INDEX "PollVote_optionId_idx" ON "PollVote"("optionId");

-- CreateIndex
CREATE INDEX "PollVote_voterId_idx" ON "PollVote"("voterId");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_pollId_voterId_key" ON "PollVote"("pollId", "voterId");

-- CreateIndex
CREATE INDEX "ModerationAction_reportId_idx" ON "ModerationAction"("reportId");

-- CreateIndex
CREATE INDEX "ModerationAction_performedById_idx" ON "ModerationAction"("performedById");

-- CreateIndex
CREATE INDEX "Ban_userId_idx" ON "Ban"("userId");

-- CreateIndex
CREATE INDEX "Ban_bannedById_idx" ON "Ban"("bannedById");

-- CreateIndex
CREATE INDEX "Ban_liftedAt_idx" ON "Ban"("liftedAt");

-- CreateIndex
CREATE INDEX "BanAppeal_banId_idx" ON "BanAppeal"("banId");

-- CreateIndex
CREATE INDEX "BanAppeal_userId_idx" ON "BanAppeal"("userId");

-- CreateIndex
CREATE INDEX "BanAppeal_status_idx" ON "BanAppeal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SentimentSummary_threadId_targetKey_key" ON "SentimentSummary"("threadId", "targetKey");

-- CreateIndex
CREATE INDEX "_ForumThreadToTag_B_index" ON "_ForumThreadToTag"("B");

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followeeId_fkey" FOREIGN KEY ("followeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_avatarMediaId_fkey" FOREIGN KEY ("avatarMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_favoriteTeamId_fkey" FOREIGN KEY ("favoriteTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ForumThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_parentPostId_fkey" FOREIGN KEY ("parentPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostEdit" ADD CONSTRAINT "PostEdit_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostEdit" ADD CONSTRAINT "PostEdit_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_winner_fkey" FOREIGN KEY ("winner") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiModerationVerdict" ADD CONSTRAINT "AiModerationVerdict_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiModerationVerdict" ADD CONSTRAINT "AiModerationVerdict_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamStanding" ADD CONSTRAINT "TeamStanding_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamStanding" ADD CONSTRAINT "TeamStanding_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDigest" ADD CONSTRAINT "DailyDigest_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumThread" ADD CONSTRAINT "ForumThread_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumThread" ADD CONSTRAINT "ForumThread_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumThread" ADD CONSTRAINT "ForumThread_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ForumThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ban" ADD CONSTRAINT "Ban_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ban" ADD CONSTRAINT "Ban_bannedById_fkey" FOREIGN KEY ("bannedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanAppeal" ADD CONSTRAINT "BanAppeal_banId_fkey" FOREIGN KEY ("banId") REFERENCES "Ban"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanAppeal" ADD CONSTRAINT "BanAppeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanAppeal" ADD CONSTRAINT "BanAppeal_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentimentSummary" ADD CONSTRAINT "SentimentSummary_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ForumThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentimentSummary" ADD CONSTRAINT "SentimentSummary_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentimentSummary" ADD CONSTRAINT "SentimentSummary_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ForumThreadToTag" ADD CONSTRAINT "_ForumThreadToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "ForumThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ForumThreadToTag" ADD CONSTRAINT "_ForumThreadToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
