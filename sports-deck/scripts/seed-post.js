const { PrismaClient } = require('../prisma/generated');

const prisma = new PrismaClient();

// Utility script to seed the database.
// Written with help from ChatGPT.

async function clearDatabase() {
    console.log('Clearing database tables: PostEdit, Post, TranslationCache, User');
    // delete in order to respect FK relations
    await prisma.postEdit.deleteMany().catch(() => {});
    await prisma.post.deleteMany().catch(() => {});
    await prisma.translationCache.deleteMany().catch(() => {});
    await prisma.user.deleteMany().catch(() => {});

    // For SQLite, reset autoincrement counters stored in sqlite_sequence so IDs start from 1 again
    try {
        // This will fail cleanly on non-SQLite DBs; Prisma exposes $executeRawUnsafe for raw SQL
        await prisma.$executeRawUnsafe("DELETE FROM sqlite_sequence WHERE name IN ('Post','PostEdit','TranslationCache','User')");
        console.log('Reset sqlite_sequence autoincrement counters');
    } catch (e) {
        // ignore if not sqlite or permission issues
    }

    console.log('Database cleared');
}

async function seedPosts() {
    const existing = await prisma.post.findFirst();
    if (existing) {
        console.log('Posts already exist; skipping seedPosts');
        return;
    }

    const postsToCreate = [
        {
            content: '¡Buen partido anoche! Me encantó la remontada en el segundo tiempo.',
            language: 'es',
        },
        {
            content: "What a game last night! The comeback in the second half was amazing.",
            language: 'en',
        },
        {
            content: 'C\'était un match incroyable, très serré jusqu\'au bout.',
            language: 'fr',
        },
        {
            content: 'Das Spiel gestern war fantastisch, besonders das Tor in der Nachspielzeit.',
        },
    ];

    for (const p of postsToCreate) {
        await prisma.post.create({ data: p });
    }

    console.log('Seeded posts');
}

async function seedEdits() {
    const posts = await prisma.post.findMany();
    if (!posts.length) {
        console.log('No posts found; seedEdits requires posts. Run with --posts or --all first.');
        return;
    }

    let totalEdits = 0;

    // Create 1-3 edits per post (deterministic based on index)
    for (const [idx, post] of posts.entries()) {
        const numEdits = (idx % 3) + 1; // yields 1,2,3,1,2,3,...
        for (let rev = 1; rev <= numEdits; rev++) {
            const prev = `${post.content} (earlier version ${rev})`;
            await prisma.postEdit.create({
                data: {
                    postId: post.id,
                    previousContent: prev,
                    language: post.language,
                },
            });
            totalEdits++;
        }
    }

    console.log(`Seeded post edits for ${posts.length} posts (total edits: ${totalEdits})`);
}

function printHelp() {
    console.log('Usage: node scripts/seed-post.js [--clear] [--posts] [--edits] [--all]');
    console.log('  --clear   Clear the database tables (PostEdit, Post, TranslationCache, User)');
    console.log('  --posts   Seed sample posts');
    console.log('  --edits   Seed sample post edits (requires posts)');
    console.log('  --all     Clear DB and seed posts and edits');
}

async function main() {
    try {
        const args = process.argv.slice(2);
        if (args.includes('--help') || args.includes('-h')) {
            printHelp();
            return;
        }

        if (args.includes('--all')) {
            await clearDatabase();
            await seedPosts();
            await seedEdits();
            return;
        }

        if (args.includes('--clear')) {
            await clearDatabase();
        }

        if (args.includes('--posts')) {
            await seedPosts();
        }

        if (args.includes('--edits')) {
            await seedEdits();
        }

        // default behavior: seed posts if none exist
        if (!args.length) {
            await seedPosts();
        }
    } catch (err) {
        console.error('Seeding failed', err);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

main();
