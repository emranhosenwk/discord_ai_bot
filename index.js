const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder, PermissionFlagsBits, ActivityType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const { default: ytdl } = require('@distube/ytdl-core');
const yts = require('yt-search');
const Groq = require('groq-sdk');
require('dotenv').config();

// ========== CONFIG ==========
const config = {
    TOKEN: process.env.DISCORD_TOKEN,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    PREFIX: process.env.PREFIX || '!',
    BOT_NAME: process.env.BOT_NAME || 'NexusAI',
    COLOR: '#5865F2',
    MODEL: 'llama-3.3-70b-versatile',
};

// ========== GROQ ==========
const groq = new Groq({ apiKey: config.GROQ_API_KEY });
const userHistories = new Map();

async function getAIResponse(userId, message, systemPrompt) {
    if (!userHistories.has(userId)) userHistories.set(userId, []);
    const history = userHistories.get(userId);
    history.push({ role: 'user', content: message });
    if (history.length > 12) userHistories.set(userId, history.slice(-12));

    const response = await groq.chat.completions.create({
        model: config.MODEL,
        messages: [{ role: 'system', content: systemPrompt }, ...history],
        max_tokens: 1024,
        temperature: 0.7,
    });

    const reply = response.choices[0].message.content;
    history.push({ role: 'assistant', content: reply });
    return reply;
}

// ========== CLIENT ==========
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// ========== STORAGE ==========
const musicQueues = new Map();
const warnings = new Map();
const badWords = ['spam', 'scam', 'hack']; // customize as needed

// ========== READY ==========
client.once('ready', () => {
    console.log(`✅ ${config.BOT_NAME} is online!`);
    console.log(`📊 Serving ${client.guilds.cache.size} servers`);
    client.user.setActivity(`${config.PREFIX}help | AI Powered`, { type: ActivityType.Watching });
});

// ========== WELCOME ==========
client.on('guildMemberAdd', async (member) => {
    const channel = member.guild.systemChannel;
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor(config.COLOR)
        .setTitle('👋 Welcome to the server!')
        .setDescription(`Hey ${member}, welcome to **${member.guild.name}**! 🎉\n\nType \`${config.PREFIX}help\` to see what I can do!`)
        .setThumbnail(member.user.displayAvatarURL())
        .setFooter({ text: `Member #${member.guild.memberCount}` })
        .setTimestamp();

    channel.send({ embeds: [embed] });
});

client.on('guildMemberRemove', async (member) => {
    const channel = member.guild.systemChannel;
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription(`👋 **${member.user.tag}** has left the server.`)
        .setTimestamp();

    channel.send({ embeds: [embed] });
});

// ========== AUTO MOD ==========
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const content = message.content.toLowerCase();

    // Bad word filter
    for (const word of badWords) {
        if (content.includes(word)) {
            await message.delete().catch(() => {});
            const warn = new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription(`⚠️ ${message.author}, your message was removed for violating server rules.`);
            const warn_msg = await message.channel.send({ embeds: [warn] });
            setTimeout(() => warn_msg.delete().catch(() => {}), 5000);
            return;
        }
    }

    // Spam detection (5 messages in 5 seconds)
    // (simplified version)

    // Command handler
    if (!message.content.startsWith(config.PREFIX)) return;
    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // ========== COMMANDS ==========

    // !help
    if (command === 'help') {
        const embed = new EmbedBuilder()
            .setColor(config.COLOR)
            .setTitle(`🤖 ${config.BOT_NAME} — Command List`)
            .setDescription('Here are all available commands:')
            .addFields(
                {
                    name: '🧠 AI Commands',
                    value: `\`${config.PREFIX}ai [message]\` — Chat with AI\n\`${config.PREFIX}ask [question]\` — Ask anything\n\`${config.PREFIX}clear\` — Clear AI history`,
                },
                {
                    name: '🎵 Music Commands',
                    value: `\`${config.PREFIX}play [song]\` — Play a song\n\`${config.PREFIX}skip\` — Skip current song\n\`${config.PREFIX}stop\` — Stop music\n\`${config.PREFIX}queue\` — Show queue`,
                },
                {
                    name: '🛡️ Moderation',
                    value: `\`${config.PREFIX}warn @user\` — Warn a user\n\`${config.PREFIX}kick @user\` — Kick a user\n\`${config.PREFIX}ban @user\` — Ban a user\n\`${config.PREFIX}clear [amount]\` — Delete messages`,
                },
                {
                    name: '📊 Info & Fun',
                    value: `\`${config.PREFIX}serverinfo\` — Server info\n\`${config.PREFIX}userinfo\` — User info\n\`${config.PREFIX}joke\` — Random joke\n\`${config.PREFIX}ping\` — Bot latency`,
                }
            )
            .setFooter({ text: `${config.BOT_NAME} • Powered by Groq AI ⚡` })
            .setTimestamp();

        message.reply({ embeds: [embed] });
        return;
    }

    // !ping
    if (command === 'ping') {
        const latency = Date.now() - message.createdTimestamp;
        const embed = new EmbedBuilder()
            .setColor(config.COLOR)
            .setTitle('🏓 Pong!')
            .addFields(
                { name: 'Bot Latency', value: `${latency}ms`, inline: true },
                { name: 'API Latency', value: `${Math.round(client.ws.ping)}ms`, inline: true }
            );
        message.reply({ embeds: [embed] });
        return;
    }

    // !ai / !ask
    if (command === 'ai' || command === 'ask') {
        const userMessage = args.join(' ');
        if (!userMessage) {
            return message.reply('❌ Please provide a message! Usage: `' + config.PREFIX + 'ai [message]`');
        }

        const typing = await message.channel.sendTyping();
        try {
            const systemPrompt = `You are ${config.BOT_NAME}, a helpful AI assistant in a Discord server. 
Be friendly, concise, and helpful. Use Discord markdown formatting when appropriate.
Respond in the same language the user writes in.`;

            const reply = await getAIResponse(message.author.id, userMessage, systemPrompt);

            const embed = new EmbedBuilder()
                .setColor(config.COLOR)
                .setDescription(reply.length > 4096 ? reply.slice(0, 4093) + '...' : reply)
                .setFooter({ text: `${config.BOT_NAME} • Powered by Groq AI ⚡` });

            message.reply({ embeds: [embed] });
        } catch (error) {
            message.reply('❌ AI error. Please try again!');
        }
        return;
    }

    // !clear history
    if (command === 'clear') {
        const amount = parseInt(args[0]);
        if (!isNaN(amount) && amount > 0) {
            // Clear messages
            if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return message.reply('❌ You need **Manage Messages** permission!');
            }
            const deleted = await message.channel.bulkDelete(Math.min(amount + 1, 100), true);
            const msg = await message.channel.send(`✅ Deleted **${deleted.size - 1}** messages.`);
            setTimeout(() => msg.delete().catch(() => {}), 3000);
        } else {
            userHistories.set(message.author.id, []);
            message.reply('🗑️ AI conversation history cleared!');
        }
        return;
    }

    // !serverinfo
    if (command === 'serverinfo') {
        const guild = message.guild;
        const embed = new EmbedBuilder()
            .setColor(config.COLOR)
            .setTitle(`📊 ${guild.name}`)
            .setThumbnail(guild.iconURL())
            .addFields(
                { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
                { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
                { name: '💬 Channels', value: `${guild.channels.cache.size}`, inline: true },
                { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true },
                { name: '😀 Emojis', value: `${guild.emojis.cache.size}`, inline: true },
            )
            .setFooter({ text: `ID: ${guild.id}` })
            .setTimestamp();
        message.reply({ embeds: [embed] });
        return;
    }

    // !userinfo
    if (command === 'userinfo') {
        const target = message.mentions.members.first() || message.member;
        const embed = new EmbedBuilder()
            .setColor(config.COLOR)
            .setTitle(`👤 ${target.user.tag}`)
            .setThumbnail(target.user.displayAvatarURL())
            .addFields(
                { name: '🆔 ID', value: target.user.id, inline: true },
                { name: '📅 Joined Server', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:D>`, inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:D>`, inline: true },
                { name: '🎭 Top Role', value: `${target.roles.highest}`, inline: true },
            )
            .setFooter({ text: `${config.BOT_NAME}` })
            .setTimestamp();
        message.reply({ embeds: [embed] });
        return;
    }

    // !joke
    if (command === 'joke') {
        const jokes = [
            "Why do programmers prefer dark mode? Because light attracts bugs! 🐛",
            "A SQL query walks into a bar, walks up to two tables and asks... 'Can I join you?' 😄",
            "Why don't scientists trust atoms? Because they make up everything! ⚛️",
            "I told my wife she was drawing her eyebrows too high. She looked surprised. 😲",
            "Why did the scarecrow win an award? Because he was outstanding in his field! 🌾",
            "What do you call a fake noodle? An impasta! 🍝",
        ];
        const joke = jokes[Math.floor(Math.random() * jokes.length)];
        const embed = new EmbedBuilder()
            .setColor(config.COLOR)
            .setTitle('😄 Random Joke')
            .setDescription(joke);
        message.reply({ embeds: [embed] });
        return;
    }

    // ========== MODERATION ==========

    // !warn
    if (command === 'warn') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('❌ You need **Moderate Members** permission!');
        }
        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ Please mention a user! Usage: `!warn @user`');

        const reason = args.slice(1).join(' ') || 'No reason provided';
        const userId = target.user.id;
        if (!warnings.has(userId)) warnings.set(userId, []);
        warnings.get(userId).push({ reason, date: new Date() });

        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('⚠️ User Warned')
            .addFields(
                { name: 'User', value: `${target}`, inline: true },
                { name: 'Reason', value: reason, inline: true },
                { name: 'Total Warnings', value: `${warnings.get(userId).length}`, inline: true },
            )
            .setTimestamp();
        message.reply({ embeds: [embed] });
        return;
    }

    // !kick
    if (command === 'kick') {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return message.reply('❌ You need **Kick Members** permission!');
        }
        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ Please mention a user!');
        const reason = args.slice(1).join(' ') || 'No reason provided';

        await target.kick(reason);
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('👢 User Kicked')
            .addFields(
                { name: 'User', value: target.user.tag, inline: true },
                { name: 'Reason', value: reason, inline: true },
            )
            .setTimestamp();
        message.reply({ embeds: [embed] });
        return;
    }

    // !ban
    if (command === 'ban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply('❌ You need **Ban Members** permission!');
        }
        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ Please mention a user!');
        const reason = args.slice(1).join(' ') || 'No reason provided';

        await target.ban({ reason });
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🔨 User Banned')
            .addFields(
                { name: 'User', value: target.user.tag, inline: true },
                { name: 'Reason', value: reason, inline: true },
            )
            .setTimestamp();
        message.reply({ embeds: [embed] });
        return;
    }

    // ========== MUSIC ==========

    // !play
    if (command === 'play') {
        const query = args.join(' ');
        if (!query) return message.reply('❌ Please provide a song name! Usage: `!play [song]`');

        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('❌ You need to be in a voice channel!');

        try {
            await message.channel.sendTyping();

            // Search for song
            const results = await yts(query);
            if (!results.videos.length) return message.reply('❌ No results found!');

            const video = results.videos[0];
            const guildId = message.guild.id;

            // Initialize queue
            if (!musicQueues.has(guildId)) {
                musicQueues.set(guildId, { connection: null, player: null, queue: [], playing: false });
            }

            const serverQueue = musicQueues.get(guildId);
            serverQueue.queue.push({ title: video.title, url: video.url, duration: video.duration.timestamp, requestedBy: message.author.tag });

            const embed = new EmbedBuilder()
                .setColor(config.COLOR)
                .setTitle('🎵 Added to Queue')
                .setDescription(`**[${video.title}](${video.url})**`)
                .addFields(
                    { name: '⏱️ Duration', value: video.duration.timestamp, inline: true },
                    { name: '👤 Requested by', value: message.author.tag, inline: true },
                    { name: '📋 Position', value: `#${serverQueue.queue.length}`, inline: true },
                )
                .setThumbnail(video.thumbnail);
            message.reply({ embeds: [embed] });

            if (!serverQueue.playing) {
                playMusic(message, guildId, voiceChannel);
            }
        } catch (error) {
            console.error('Music error:', error);
            message.reply('❌ Could not play that song. Try another!');
        }
        return;
    }

    // !skip
    if (command === 'skip') {
        const serverQueue = musicQueues.get(message.guild.id);
        if (!serverQueue || !serverQueue.playing) return message.reply('❌ No music is playing!');
        serverQueue.player?.stop();
        message.reply('⏭️ Skipped!');
        return;
    }

    // !stop
    if (command === 'stop') {
        const serverQueue = musicQueues.get(message.guild.id);
        if (!serverQueue) return message.reply('❌ No music is playing!');
        serverQueue.queue = [];
        serverQueue.player?.stop();
        serverQueue.connection?.destroy();
        musicQueues.delete(message.guild.id);
        message.reply('⏹️ Music stopped and queue cleared!');
        return;
    }

    // !queue
    if (command === 'queue') {
        const serverQueue = musicQueues.get(message.guild.id);
        if (!serverQueue || !serverQueue.queue.length) {
            return message.reply('📋 The queue is empty!');
        }

        const queueList = serverQueue.queue
            .slice(0, 10)
            .map((song, i) => `${i === 0 ? '▶️' : `${i + 1}.`} **${song.title}** (${song.duration})`)
            .join('\n');

        const embed = new EmbedBuilder()
            .setColor(config.COLOR)
            .setTitle('🎵 Music Queue')
            .setDescription(queueList)
            .setFooter({ text: `${serverQueue.queue.length} songs in queue` });
        message.reply({ embeds: [embed] });
        return;
    }
});

// ========== PLAY MUSIC FUNCTION ==========
async function playMusic(message, guildId, voiceChannel) {
    const serverQueue = musicQueues.get(guildId);
    if (!serverQueue || !serverQueue.queue.length) {
        serverQueue && (serverQueue.playing = false);
        return;
    }

    const song = serverQueue.queue[0];
    serverQueue.playing = true;

    try {
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: guildId,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });

        const stream = ytdl(song.url, {
            filter: 'audioonly',
            quality: 'lowestaudio',
            highWaterMark: 1 << 25,
        });

        const resource = createAudioResource(stream);
        const player = createAudioPlayer();

        serverQueue.connection = connection;
        serverQueue.player = player;

        connection.subscribe(player);
        player.play(resource);

        const embed = new EmbedBuilder()
            .setColor(config.COLOR)
            .setTitle('🎵 Now Playing')
            .setDescription(`**${song.title}**`)
            .addFields(
                { name: '⏱️ Duration', value: song.duration, inline: true },
                { name: '👤 Requested by', value: song.requestedBy, inline: true },
            );
        message.channel.send({ embeds: [embed] });

        player.on(AudioPlayerStatus.Idle, () => {
            serverQueue.queue.shift();
            playMusic(message, guildId, voiceChannel);
        });

        player.on('error', (error) => {
            console.error('Player error:', error);
            serverQueue.queue.shift();
            playMusic(message, guildId, voiceChannel);
        });

    } catch (error) {
        console.error('Play error:', error);
        serverQueue.queue.shift();
        playMusic(message, guildId, voiceChannel);
    }
}

// ========== LOGIN ==========
client.login(config.TOKEN);
