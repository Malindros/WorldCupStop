#!/usr/bin/env node
/*
 * Seed social data after external API fetch scripts complete.
 * This script intentionally does NOT seed Team/Season/Match/TeamStanding,
 * since those are populated by the fetch scripts.
 * 
 * This script was created by ChatGPT.
 */

const { PrismaClient } = require("../prisma/generated");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

const ADMIN_USERNAME = "admin";
const RANDOM_USER_COUNT = 10;
const ADMIN_PASSWORD = "a";
const USER_PASSWORD = "b";

function pickByIndex(arr, index) {
	if (!arr.length) return null;
	return arr[index % arr.length];
}

function pickWindow(arr, count, startIndex) {
	if (!arr.length || count <= 0) return [];
	const limit = Math.min(count, arr.length);
	const picked = [];

	for (let i = 0; i < limit; i += 1) {
		picked.push(arr[(startIndex + i) % arr.length]);
	}

	return picked;
}

async function seedUsers() {
	const teams = await prisma.team.findMany({
		select: { id: true },
		orderBy: { id: "asc" },
	});
	const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
	const userPasswordHash = await bcrypt.hash(USER_PASSWORD, 10);

	const admin = await prisma.user.upsert({
		where: { username: ADMIN_USERNAME },
		update: {
			password: adminPasswordHash,
			role: "ADMIN",
			displayName: "Administrator",
			email: "admin@sportsdeck.local",
		},
		create: {
			username: ADMIN_USERNAME,
			password: adminPasswordHash,
			role: "ADMIN",
			displayName: "Administrator",
			email: "admin@sportsdeck.local",
			favoriteTeamId: teams.length ? teams[0].id : null,
		},
	});

	const randomUsers = [];
	for (let i = 1; i <= RANDOM_USER_COUNT; i += 1) {
		const username = `fan${String(i).padStart(2, "0")}`;
		const user = await prisma.user.upsert({
			where: { username },
			update: {
				password: userPasswordHash,
				role: "USER",
				displayName: `Fan ${i}`,
				email: `fan${String(i).padStart(2, "0")}@sportsdeck.local`,
			},
			create: {
				username,
				password: userPasswordHash,
				role: "USER",
				displayName: `Fan ${i}`,
				email: `fan${String(i).padStart(2, "0")}@sportsdeck.local`,
				favoriteTeamId: teams.length ? pickByIndex(teams, i - 1).id : null,
			},
		});
		randomUsers.push(user);
	}

	console.log(`Seeded users: 1 admin + ${randomUsers.length} deterministic users`);
	return { admin, users: [admin, ...randomUsers] };
}

async function seedThreads(users) {
	const matches = await prisma.match.findMany({
		select: { id: true, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
		take: 6,
		orderBy: { startTime: "desc" },
	});
	const teams = await prisma.team.findMany({
		select: { id: true, name: true, shortName: true },
		take: 6,
		orderBy: { id: "asc" },
	});

	const createdThreads = [];

	for (const match of matches) {
		const slug = `match-${match.id}-discussion`;
		const title = `${match.homeTeam?.name || "Home"} vs ${match.awayTeam?.name || "Away"} Discussion`;
		const thread = await prisma.forumThread.upsert({
			where: { slug },
			update: {},
			create: {
				slug,
				title,
				matchId: match.id,
				authorId: users.admin.id,
			},
		});
		createdThreads.push(thread);
	}

	for (const team of teams.slice(0, 4)) {
		const slug = `team-${team.id}-fan-talk`;
		const title = `${team.shortName || team.name} Fan Talk`;
		const thread = await prisma.forumThread.upsert({
			where: { slug },
			update: {},
			create: {
				slug,
				title,
				teamId: team.id,
				authorId: users.admin.id,
			},
		});
		createdThreads.push(thread);
	}

	const generalThread = await prisma.forumThread.upsert({
		where: { slug: "general-football-chat" },
		update: {},
		create: {
			slug: "general-football-chat",
			title: "General Football Chat",
			authorId: users.admin.id,
		},
	});
	createdThreads.push(generalThread);

	console.log(`Seeded/upserted threads: ${createdThreads.length}`);
	return createdThreads;
}

function buildPostText(threadTitle, idx) {
	const lines = [
		`Thoughts on ${threadTitle}: tempo looked strong today.`,
		`I think pressing shape was the difference in ${threadTitle}.`,
		`Set pieces could decide the next game in ${threadTitle}.`,
		`Big question from ${threadTitle}: can this form continue?`,
		`Defensive transitions in ${threadTitle} need work.`,
	];
	return lines[idx % lines.length];
}

async function seedPostsAndEdits(threads, users) {
	let postsCreated = 0;
	let editsCreated = 0;

	for (const thread of threads) {
		const existingPostCount = await prisma.post.count({ where: { threadId: thread.id } });
		if (existingPostCount > 0) {
			continue;
		}

		const authors = pickWindow(users.users, 4, thread.id % users.users.length);
		const threadPosts = [];

		for (let i = 0; i < authors.length; i += 1) {
			const author = authors[i];
			const content = buildPostText(thread.title, i);
			const post = await prisma.post.create({
				data: {
					threadId: thread.id,
					authorId: author.id,
					content,
					language: "en",
				},
			});
			threadPosts.push(post);
			postsCreated += 1;
		}

		const firstPost = threadPosts[0];
		const replyAuthor = authors[authors.length - 1];
		const reply = await prisma.post.create({
			data: {
				threadId: thread.id,
				authorId: replyAuthor.id,
				parentPostId: firstPost.id,
				content: `Replying on ${thread.title}: fair take, but I disagree on the lineup choice.`,
				language: "en",
			},
		});
		threadPosts.push(reply);
		postsCreated += 1;

		const postToEdit = threadPosts[1];
		const existingEdit = await prisma.postEdit.findFirst({ where: { postId: postToEdit.id } });
		if (!existingEdit) {
			await prisma.postEdit.create({
				data: {
					postId: postToEdit.id,
					editorId: users.admin.id,
					previousContent: `${postToEdit.content} (before edit)`,
					language: postToEdit.language,
				},
			});
			editsCreated += 1;
		}
	}

	console.log(`Seeded posts: ${postsCreated}, edits: ${editsCreated}`);
}

async function seedFollows(users) {
	const allUsers = users.users;
	let followsCreated = 0;

	for (let i = 0; i < allUsers.length; i += 1) {
		const follower = allUsers[i];
		const candidates = allUsers.filter((u) => u.id !== follower.id);
		const toFollow = pickWindow(candidates, Math.min(3, candidates.length), i);

		for (const followee of toFollow) {
			await prisma.follow.upsert({
				where: {
					followerId_followeeId: {
						followerId: follower.id,
						followeeId: followee.id,
					},
				},
				update: {},
				create: {
					followerId: follower.id,
					followeeId: followee.id,
				},
			});
			followsCreated += 1;
		}
	}

	console.log(`Seeded/upserted follow relationships: ${followsCreated}`);
}

async function seedClosedOpenMatchThreads(users) {
	const match = await prisma.match.findFirst({
		select: { id: true, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
		orderBy: { startTime: "desc" },
	});
	if (!match) {
		console.log("No match found to seed closed/open threads");
		return;
	}

	// Prefer using an existing `fan1` user; do not create a new user.
	let homefan = await prisma.user.findUnique({ where: { username: "fan01" } });
	if (!homefan) {
		// fall back to the first seeded fan user if `fan1` doesn't exist
		homefan = users.users.find((u) => u.username && u.username.startsWith("fan"));
		if (!homefan) {
			console.log("No fan user found (fan1 or seeded fans). Using admin as poll author fallback.");
			homefan = users.admin;
		} else {
			console.log("User 'fan1' not found; using first seeded fan user for polls/post authorship.");
		}
	}

	const now = new Date();
	const inTwoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
	const pastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

	const pairs = [
		{ key: "closed", titleSuffix: "Closed Match Thread", autoCloseAt: pastWeek, isClosed: true },
		{ key: "open", titleSuffix: "Open Match Thread", autoCloseAt: inTwoWeeks, isClosed: false },
	];

	for (const p of pairs) {
		const slug = `match-${match.id}-${p.key}-match-thread`;
		const title = `${match.homeTeam?.name || "Home"} vs ${match.awayTeam?.name || "Away"} - ${p.titleSuffix}`;

		const thread = await prisma.forumThread.upsert({
			where: { slug },
			update: {
				title,
				matchId: match.id,
				authorId: users.admin.id,
				autoCloseAt: p.autoCloseAt,
				isClosed: p.isClosed,
			},
			create: {
				slug,
				title,
				matchId: match.id,
				authorId: users.admin.id,
				autoCloseAt: p.autoCloseAt,
				isClosed: p.isClosed,
			},
		});

		// create a couple posts if none exist
		const existingPosts = await prisma.post.count({ where: { threadId: thread.id } });
		if (existingPosts === 0) {
			const post1 = await prisma.post.create({ data: { threadId: thread.id, authorId: homefan.id, content: `First post in ${title}`, language: "en" } });
			const post2 = await prisma.post.create({ data: { threadId: thread.id, authorId: homefan.id, content: `Second post in ${title}`, language: "en" } });
			await prisma.post.create({ data: { threadId: thread.id, authorId: homefan.id, parentPostId: post1.id, content: `Reply to first post in ${title}`, language: "en" } });
		}

		// create a poll authored by homefan if none exist
		const existingPolls = await prisma.poll.count({ where: { threadId: thread.id } });
		if (existingPolls === 0) {
			await prisma.poll.create({
				data: {
					threadId: thread.id,
					question: `Which side performed better in ${match.homeTeam?.name || "Home"} vs ${match.awayTeam?.name || "Away"}?`,
					deadline: p.autoCloseAt,
					isClosed: p.isClosed,
					createdById: homefan.id,
					options: {
						create: [{ label: "Home" }, { label: "Away" }],
					},
				},
			});
		}
	}

	console.log("Seeded closed/open match threads and polls");
}

async function main() {
	try {
		const users = await seedUsers();
		const threads = await seedThreads(users);
		await seedPostsAndEdits(threads, users);
		await seedFollows(users);
		await seedClosedOpenMatchThreads(users);
		console.log("seed-after-fetch complete.");
	} catch (err) {
		console.error("seed-after-fetch failed", err);
		process.exitCode = 1;
	} finally {
		await prisma.$disconnect();
	}
}

main();
