import 'dotenv/config'
import { joinVoiceChannel, createAudioPlayer, createAudioResource, StreamType } from '@discordjs/voice'
import play from 'play-dl'
import { Client, GatewayIntentBits, Partials } from 'discord.js'

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Channel],
});

const queue = new Map()

const playSong = async (guild, url) => {
    const serverQueue = queue.get(guild.id)

    if (!url || url.length === 0) {
        serverQueue.connection.destroy()
        queue.delete(guild.id)
        return
    }

    let singleUrl = ''
    if (url.url) {
        singleUrl = url.url
    } else {
        singleUrl = url
    }

    const stream = await play.stream(singleUrl)

    const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
    });
    const player = createAudioPlayer()

    player.play(resource)
    serverQueue.connection.subscribe(player)

    player.on('idle', () => {
        serverQueue.songs.shift()
        playSong(guild, serverQueue.songs[0])
    })

    player.on('error', error => {
        console.error(`Error: ${error.message}`)
    });

    serverQueue.textChannel.send(`Start playing: **${singleUrl}**`)
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`)
})

client.on('messageCreate', async (message) => {
    if (message.author.bot) return

    if (message.content.startsWith('!play')) {
        const args = message.content.split(' ')
        if (args.length < 2) {
            message.reply('Please provide a YouTube URL.')
            return
        }
        const url = args[1]

        const serverQueue = queue.get(message.guild.id)
        const channel = message.member.voice.channel
        if (!channel) {
            message.reply('You need to join a voice channel first.')
            return
        }


        if (!serverQueue) {
            const queueConstructor = {
                textChannel: message.channel,
                voiceChannel: channel,
                connection: null,
                songs: [],
                volume: 5,
                playing: true,
            }
            queue.set(message.guild.id, queueConstructor)
            const regexPlaylist = /^https?:\/\/(www.youtube.com|youtube.com)\/(watch\?v=[\w-]+&list=[\w-]+).*/;
            if (regexPlaylist.test(url)) {
                const playlist = await play.playlist_info(url)
                playlist.videos.forEach((video) => {
                    queueConstructor.songs.push(video)
                })
            } else {
                queueConstructor.songs.push(url)
            }
            try {

                const connection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                });
                queueConstructor.connection = connection
                playSong(message.guild, queueConstructor.songs[0])

            } catch (error) {
                console.error('Error playing the song:', error)
                message.reply('There was an error trying to play that song.')
            }
        } else {
            const serverQueue = queue.get(message.guild.id)
            const regexPlaylist = /^https?:\/\/(www.youtube.com|youtube.com)\/(playlist\?list=[\w-]+|watch\?v=[\w-]+&list=[\w-]+)$/;
            if (regexPlaylist.test(url)) {
                const playlist = await play.playlist_info(url)
                playlist.videos.forEach((video) => {
                    serverQueue.songs.push(video)
                })
            } else {
                serverQueue.songs.push(url)
            }
            return message.channel.send(`Song has been added to the queue!`)
        }
    }

    if (message.content.toLowerCase() === '!stop') {
        const serverQueue = queue.get(message.guild.id)

        if (serverQueue) {
            serverQueue.connection.destroy()
            queue.delete(message.guild.id)
        }
    }
    if (message.content.toLowerCase() === '!hello') {
        message.channel.send('world');
    } else if (message.content.toLowerCase() === '!ping') {
        message.channel.send('pong');
    } else if (message.content.toLowerCase() === '!mirza è?') {
        message.channel.send('scarso');
    } else if (message.content.toLowerCase() === '!bottino hackera i server della nasa') {
        message.channel.send('fatto!gli ho anche lasciato un messaggio di riscatto ;)')
    }
})

client.login(process.env.DISCORD_TOKEN)