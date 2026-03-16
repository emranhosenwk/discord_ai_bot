# NexusAI Discord Bot 🤖

A professional, feature-rich Discord bot powered by Groq AI.

## ✨ Features

### 🧠 AI Chat
- Smart conversations powered by LLaMA 3.3 70B
- Remembers conversation context per user
- Responds in any language
- Beautiful embed responses

### 🎵 Music Player
- Play music from YouTube
- Queue system
- Skip, stop, view queue
- Now Playing display

### 🛡️ Auto Moderation
- Bad word filter (auto-delete)
- Warn system with history
- Kick & Ban commands
- Bulk message delete

### 👋 Welcome System
- Auto welcome new members
- Goodbye messages
- Member count display

### 📊 Info Commands
- Server info with stats
- User info with join date
- Bot ping/latency

### 😄 Fun
- Random jokes
- More coming soon!

## 🚀 Setup

### 1. Create Discord Bot
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. New Application → Bot → Add Bot
3. Copy Token
4. Enable: Message Content Intent, Server Members Intent
5. Invite bot with permissions: Administrator

### 2. Environment Variables
```
DISCORD_TOKEN=your_discord_bot_token
GROQ_API_KEY=your_groq_api_key
PREFIX=!
BOT_NAME=NexusAI
```

### 3. Deploy to Railway
1. Upload files to GitHub
2. Connect Railway to repo
3. Add environment variables
4. Deploy!

## 📋 Commands

| Command | Description |
|---------|-------------|
| `!help` | Show all commands |
| `!ai [msg]` | Chat with AI |
| `!ask [question]` | Ask anything |
| `!clear` | Clear AI history / Delete messages |
| `!play [song]` | Play music |
| `!skip` | Skip song |
| `!stop` | Stop music |
| `!queue` | Show queue |
| `!warn @user` | Warn user |
| `!kick @user` | Kick user |
| `!ban @user` | Ban user |
| `!serverinfo` | Server stats |
| `!userinfo` | User info |
| `!joke` | Random joke |
| `!ping` | Bot latency |
