// config.js
const config = {
    CLIENT_ID: process.env.CLIENT_ID || 'e37f4ec0f332475a897c624671c5449d',
    CLIENT_SECRET: process.env.CLIENT_SECRET || '12c9a9eaf6854037bd4c9ccfc55169cd',
    MAIN_ROOM: '-1001259716845',
    ERROR: 'ERROR',
    DEPLOY: 'deploy',
    LOCAL: 'local',
    SERVER_PORT: process.env.PORT || 5000,
    CLIENT_PORT: 3000,
    MODE: 'deploy',
    URL_ROOT: {
        deploy: 'https://robots-cant-dance.herokuapp.com',
        local: 'http://localhost:'
    },
    PERMISSIONS_SCOPE: 'user-read-currently-playing user-modify-playback-state user-read-playback-state streaming user-read-private',
    STATE_KEY: 'spotify_auth_state',
    playbackDelay: 0,
    // telegram chat id
    CHAT_ID: '-1001389216905',
    TELEGRAM_TOKEN: '645121157:AAFVvaehPv3fkN4mALIysCq27b5Q3gtyIPY'
};

module.exports = config;