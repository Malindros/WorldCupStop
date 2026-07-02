/**
 * @openapi
 * components:
 *   schemas:
 *     Media:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         url:
 *           type: string
 *         altText:
 *           type: string
 *         metadata:
 *           type: object
 *         uploadedById:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 *         uploadedBy:
 *           type: object
 *           $ref: '#/components/schemas/User'
 *         userAvatar:
 *           type: object
 *           $ref: '#/components/schemas/User'
 *       required:
 *         - id
 *         - url
 *         - createdAt
 *     Follow:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         followerId:
 *           type: integer
 *         followeeId:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 *         follower:
 *           type: object
 *           $ref: '#/components/schemas/User'
 *         followee:
 *           type: object
 *           $ref: '#/components/schemas/User'
 *       required:
 *         - id
 *         - followerId
 *         - followeeId
 *         - createdAt
 *         - follower
 *         - followee
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         email:
 *           type: string
 *         username:
 *           type: string
 *         displayName:
 *           type: string
 *         password:
 *           type: string
 *         authProvider:
 *           type: string
 *           $ref: '#/components/schemas/AuthProvider'
 *         authProviderUserId:
 *           type: string
 *         role:
 *           type: string
 *           $ref: '#/components/schemas/Role'
 *         favoriteTeamId:
 *           type: integer
 *         avatarMediaId:
 *           type: integer
 *         isBanned:
 *           type: boolean
 *         banUntil:
 *           type: string
 *           format: date-time
 *         banReason:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         avatarMedia:
 *           type: object
 *           $ref: '#/components/schemas/Media'
 *         mediaUploaded:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Media'
 *         favoriteTeam:
 *           type: object
 *           $ref: '#/components/schemas/Team'
 *         followers:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Follow'
 *         following:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Follow'
 *         posts:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Post'
 *         postEdits:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PostEdit'
 *         threads:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ForumThread'
 *         createdPolls:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Poll'
 *         pollVotes:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PollVote'
 *         generatedDigests:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/DailyDigest'
 *         reportsAuthored:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Report'
 *         reportsReviewed:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Report'
 *         bans:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Ban'
 *         bansPlaced:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Ban'
 *         banAppeals:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/BanAppeal'
 *         decidedAppeals:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/BanAppeal'
 *         moderationActions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ModerationAction'
 *       required:
 *         - id
 *         - username
 *         - password
 *         - role
 *         - isBanned
 *         - createdAt
 *         - mediaUploaded
 *         - followers
 *         - following
 *         - posts
 *         - postEdits
 *         - threads
 *         - createdPolls
 *         - pollVotes
 *         - generatedDigests
 *         - reportsAuthored
 *         - reportsReviewed
 *         - bans
 *         - bansPlaced
 *         - banAppeals
 *         - decidedAppeals
 *         - moderationActions
 *     TranslationCache:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         originalTextHash:
 *           type: string
 *         sourceLanguage:
 *           type: string
 *         targetLanguage:
 *           type: string
 *         translatedText:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - id
 *         - originalTextHash
 *         - targetLanguage
 *         - translatedText
 *         - createdAt
 *     Post:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         threadId:
 *           type: integer
 *         authorId:
 *           type: integer
 *         parentPostId:
 *           type: integer
 *         content:
 *           type: string
 *         language:
 *           type: string
 *         isHidden:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         thread:
 *           type: object
 *           $ref: '#/components/schemas/ForumThread'
 *         author:
 *           type: object
 *           $ref: '#/components/schemas/User'
 *         parentPost:
 *           type: object
 *           $ref: '#/components/schemas/Post'
 *         replies:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Post'
 *         edits:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PostEdit'
 *         moderationVerdicts:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AiModerationVerdict'
 *       required:
 *         - id
 *         - authorId
 *         - content
 *         - isHidden
 *         - createdAt
 *         - updatedAt
 *         - author
 *         - replies
 *         - edits
 *         - moderationVerdicts
 *     Report:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         reporterId:
 *           type: integer
 *         targetType:
 *           type: string
 *           $ref: '#/components/schemas/ReportTargetType'
 *         targetId:
 *           type: integer
 *         reasonCode:
 *           type: string
 *           $ref: '#/components/schemas/ReportReasonCode'
 *         additionalComment:
 *           type: string
 *         reason:
 *           type: string
 *         status:
 *           type: string
 *           $ref: '#/components/schemas/ReportStatus'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         reviewedAt:
 *           type: string
 *           format: date-time
 *         reviewerId:
 *           type: integer
 *         reporter:
 *           type: object
 *           $ref: '#/components/schemas/User'
 *         reviewer:
 *           type: object
 *           $ref: '#/components/schemas/User'
 *         aiVerdicts:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AiModerationVerdict'
 *         moderationActions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ModerationAction'
 *       required:
 *         - id
 *         - targetType
 *         - targetId
 *         - reasonCode
 *         - reason
 *         - status
 *         - createdAt
 *         - aiVerdicts
 *         - moderationActions
 *     PostEdit:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         editorId:
 *           type: integer
 *         previousContent:
 *           type: string
 *         language:
 *           type: string
 *         editedAt:
 *           type: string
 *           format: date-time
 *         postId:
 *           type: integer
 *         post:
 *           type: object
 *           $ref: '#/components/schemas/Post'
 *         editor:
 *           type: object
 *           $ref: '#/components/schemas/User'
 *       required:
 *         - id
 *         - previousContent
 *         - editedAt
 *         - postId
 *         - post
 *     Team:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         externalId:
 *           type: string
 *         name:
 *           type: string
 *         shortName:
 *           type: string
 *         slug:
 *           type: string
 *         tla:
 *           type: string
 *         crest:
 *           type: string
 *         address:
 *           type: string
 *         website:
 *           type: string
 *         founded:
 *           type: integer
 *         clubColors:
 *           type: string
 *         venue:
 *           type: string
 *         area:
 *           type: object
 *         runningCompetitions:
 *           type: object
 *         coach:
 *           type: object
 *         marketValue:
 *           type: integer
 *         squad:
 *           type: object
 *         staff:
 *           type: object
 *         lastUpdated:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         homeMatches:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Match'
 *         awayMatches:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Match'
 *         threads:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ForumThread'
 *         fans:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/User'
 *         sentiments:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SentimentSummary'
 *         standings:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TeamStanding'
 *         seasonsWon:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Season'
 *       required:
 *         - id
 *         - name
 *         - createdAt
 *         - updatedAt
 *         - homeMatches
 *         - awayMatches
 *         - threads
 *         - fans
 *         - sentiments
 *         - standings
 *         - seasonsWon
 *     Match:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         externalId:
 *           type: string
 *         homeTeamId:
 *           type: integer
 *         awayTeamId:
 *           type: integer
 *         homeScore:
 *           type: integer
 *         awayScore:
 *           type: integer
 *         status:
 *           type: string
 *         startTime:
 *           type: string
 *           format: date-time
 *         endTime:
 *           type: string
 *           format: date-time
 *         utcDate:
 *           type: string
 *           format: date-time
 *         minute:
 *           type: integer
 *         injuryTime:
 *           type: integer
 *         attendance:
 *           type: integer
 *         venue:
 *           type: string
 *         matchday:
 *           type: integer
 *         stage:
 *           type: string
 *         group:
 *           type: string
 *         lastUpdated:
 *           type: string
 *           format: date-time
 *         seasonId:
 *           type: integer
 *         homeDetails:
 *           type: object
 *         awayDetails:
 *           type: object
 *         score:
 *           type: object
 *         goals:
 *           type: object
 *         penalties:
 *           type: object
 *         bookings:
 *           type: object
 *         substitutions:
 *           type: object
 *         odds:
 *           type: object
 *         referees:
 *           type: object
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         homeTeam:
 *           type: object
 *           $ref: '#/components/schemas/Team'
 *         awayTeam:
 *           type: object
 *           $ref: '#/components/schemas/Team'
 *         season:
 *           type: object
 *           $ref: '#/components/schemas/Season'
 *         threads:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ForumThread'
 *         sentiments:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SentimentSummary'
 *       required:
 *         - id
 *         - homeTeamId
 *         - awayTeamId
 *         - status
 *         - startTime
 *         - createdAt
 *         - updatedAt
 *         - homeTeam
 *         - awayTeam
 *         - threads
 *         - sentiments
 *     Season:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         externalId:
 *           type: integer
 *         startDate:
 *           type: string
 *           format: date-time
 *         endDate:
 *           type: string
 *           format: date-time
 *         currentMatchday:
 *           type: integer
 *         winnerId:
 *           type: integer
 *         winner:
 *           type: object
 *           $ref: '#/components/schemas/Team'
 *         standings:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TeamStanding'
 *         matches:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Match'
 *       required:
 *         - id
 *         - startDate
 *         - endDate
 *         - standings
 *         - matches
 *     AiModerationVerdict:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         postId:
 *           type: integer
 *         reportId:
 *           type: integer
 *         verdict:
 *           type: string
 *         toxicityScore:
 *           type: number
 *         explanation:
 *           type: string
 *         contentSnapshot:
 *           type: string
 *         rawResponse:
 *           type: object
 *         createdAt:
 *           type: string
 *           format: date-time
 *         post:
 *           type: object
 *           $ref: '#/components/schemas/Post'
 *         report:
 *           type: object
 *           $ref: '#/components/schemas/Report'
 *       required:
 *         - id
 *         - postId
 *         - verdict
 *         - createdAt
 *         - post
 *     TeamStanding:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         seasonId:
 *           type: integer
 *         teamId:
 *           type: integer
 *         position:
 *           type: integer
 *         played:
 *           type: integer
 *         wins:
 *           type: integer
 *         draws:
 *           type: integer
 *         losses:
 *           type: integer
 *         goalsFor:
 *           type: integer
 *         goalsAgainst:
 *           type: integer
 *         goalDifference:
 *           type: integer
 *         points:
 *           type: integer
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         season:
 *           type: object
 *           $ref: '#/components/schemas/Season'
 *         team:
 *           type: object
 *           $ref: '#/components/schemas/Team'
 *       required:
 *         - id
 *         - seasonId
 *         - teamId
 *         - position
 *         - updatedAt
 *         - team
 *     DailyDigest:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         date:
 *           type: string
 *           format: date-time
 *         generatedById:
 *           type: integer
 *         content:
 *           type: object
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         generatedBy:
 *           type: object
 *           $ref: '#/components/schemas/User'
 *       required:
 *         - id
 *         - date
 *         - content
 *         - createdAt
 *         - updatedAt
 *     ForumThread:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         title:
 *           type: string
 *         slug:
 *           type: string
 *         isClosed:
 *           type: boolean
 *         isHidden:
 *           type: boolean
 *         autoOpenAt:
 *           type: string
 *           format: date-time
 *         autoCloseAt:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         matchId:
 *           type: integer
 *         teamId:
 *           type: integer
 *         match:
 *           type: object
 *           $ref: '#/components/schemas/Match'
 *         team:
 *           type: object
 *           $ref: '#/components/schemas/Team'
 *         authorId:
 *           type: integer
 *         author:
 *           type: object
 *           $ref: '#/components/schemas/User'
 *         posts:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Post'
 *         sentiments:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SentimentSummary'
 *         tags:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Tag'
 *         polls:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Poll'
 *       required:
 *         - id
 *         - title
 *         - isClosed
 *         - isHidden
 *         - createdAt
 *         - updatedAt
 *         - posts
 *         - sentiments
 *         - tags
 *         - polls
 *     Tag:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         slug:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         threads:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ForumThread'
 *       required:
 *         - id
 *         - name
 *         - slug
 *         - createdAt
 *         - threads
 *     Poll:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         threadId:
 *           type: integer
 *         question:
 *           type: string
 *         createdById:
 *           type: integer
 *         deadline:
 *           type: string
 *           format: date-time
 *         isClosed:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         thread:
 *           type: object
 *           $ref: '#/components/schemas/ForumThread'
 *         createdBy:
 *           type: object
 *           $ref: '#/components/schemas/User'
 *         options:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PollOption'
 *         votes:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PollVote'
 *       required:
 *         - id
 *         - question
 *         - createdById
 *         - deadline
 *         - isClosed
 *         - createdAt
 *         - createdBy
 *         - options
 *         - votes
 *     PollOption:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         pollId:
 *           type: integer
 *         label:
 *           type: string
 *         metadata:
 *           type: object
 *         poll:
 *           type: object
 *           $ref: '#/components/schemas/Poll'
 *         votes:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PollVote'
 *       required:
 *         - id
 *         - pollId
 *         - label
 *         - poll
 *         - votes
 *     PollVote:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         pollId:
 *           type: integer
 *         optionId:
 *           type: integer
 *         voterId:
 *           type: integer
 *         votedAt:
 *           type: string
 *           format: date-time
 *         poll:
 *           type: object
 *           $ref: '#/components/schemas/Poll'
 *         option:
 *           type: object
 *           $ref: '#/components/schemas/PollOption'
 *         voter:
 *           type: object
 *           $ref: '#/components/schemas/User'
 *       required:
 *         - id
 *         - pollId
 *         - optionId
 *         - voterId
 *         - votedAt
 *         - poll
 *         - option
 *         - voter
 *     ModerationAction:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         reportId:
 *           type: integer
 *         actionType:
 *           type: string
 *           $ref: '#/components/schemas/ModerationActionType'
 *         performedById:
 *           type: integer
 *         details:
 *           type: object
 *         createdAt:
 *           type: string
 *           format: date-time
 *         report:
 *           type: object
 *           $ref: '#/components/schemas/Report'
 *         performedBy:
 *           type: object
 *           $ref: '#/components/schemas/User'
 *       required:
 *         - id
 *         - actionType
 *         - performedById
 *         - createdAt
 *         - performedBy
 *     Ban:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         userId:
 *           type: integer
 *         bannedById:
 *           type: integer
 *         reason:
 *           type: string
 *         until:
 *           type: string
 *           format: date-time
 *         liftedAt:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         user:
 *           type: object
 *           $ref: '#/components/schemas/User'
 *         bannedBy:
 *           type: object
 *           $ref: '#/components/schemas/User'
 *         appeals:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/BanAppeal'
 *       required:
 *         - id
 *         - userId
 *         - bannedById
 *         - reason
 *         - createdAt
 *         - user
 *         - bannedBy
 *         - appeals
 *     BanAppeal:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         banId:
 *           type: integer
 *         userId:
 *           type: integer
 *         message:
 *           type: string
 *         status:
 *           type: string
 *           $ref: '#/components/schemas/BanAppealStatus'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         decidedAt:
 *           type: string
 *           format: date-time
 *         decidedById:
 *           type: integer
 *         ban:
 *           type: object
 *           $ref: '#/components/schemas/Ban'
 *         user:
 *           type: object
 *           $ref: '#/components/schemas/User'
 *         decidedBy:
 *           type: object
 *           $ref: '#/components/schemas/User'
 *       required:
 *         - id
 *         - banId
 *         - userId
 *         - message
 *         - status
 *         - createdAt
 *         - ban
 *         - user
 *     SentimentSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         threadId:
 *           type: integer
 *         matchId:
 *           type: integer
 *         teamId:
 *           type: integer
 *         scope:
 *           type: string
 *         targetKey:
 *           type: string
 *         sentiment:
 *           type: string
 *         score:
 *           type: number
 *         computedAt:
 *           type: string
 *           format: date-time
 *         thread:
 *           type: object
 *           $ref: '#/components/schemas/ForumThread'
 *         match:
 *           type: object
 *           $ref: '#/components/schemas/Match'
 *         team:
 *           type: object
 *           $ref: '#/components/schemas/Team'
 *       required:
 *         - id
 *         - threadId
 *         - scope
 *         - targetKey
 *         - sentiment
 *         - score
 *         - computedAt
 *         - thread
 *     Role:
 *       type: string
 *       enum:
 *         - USER
 *         - ADMIN
 *     AuthProvider:
 *       type: string
 *       enum:
 *         - GOOGLE
 *         - GITHUB
 *     ReportTargetType:
 *       type: string
 *       enum:
 *         - POST
 *         - THREAD
 *     ReportReasonCode:
 *       type: string
 *       enum:
 *         - SPAM
 *         - HARASSMENT
 *         - HATE_SPEECH
 *         - VIOLENCE
 *         - SEXUAL_CONTENT
 *         - MISINFORMATION
 *         - OTHER
 *         - SYSTEM_FLAGGED
 *     ReportStatus:
 *       type: string
 *       enum:
 *         - OPEN
 *         - REVIEWED
 *         - DISMISSED
 *         - ACTIONED
 *     BanAppealStatus:
 *       type: string
 *       enum:
 *         - PENDING
 *         - APPROVED
 *         - DENIED
 *     ModerationActionType:
 *       type: string
 *       enum:
 *         - DISMISS
 *         - HIDE
 *         - BAN
 *         - UNBAN
 */
