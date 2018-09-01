const express = require('express');
var spotify = require('./spotify-functions');
const app = express();
require('dotenv').config();

const SERVER_PORT = process.env.PORT || 5000;
const CLIENT_PORT = 3000;

const _ = require ('lodash')
const cors = require('cors')
// playbackDelay pushes the track 'back'
const querystring = require('querystring');
const cookieParser = require('cookie-parser');
const axios = require ('axios')
const rp = require('request-promise')
const CLIENT_ID = process.env.CLIENT_ID; 
const CLIENT_SECRET = process.env.CLIENT_SECRET; 
const ERROR = 'ERROR'
const DEPLOY = 'deploy'
const LOCAL = 'local'
const MODE = DEPLOY
const URL_root = {
  deploy: 'https://robots-cant-dance.herokuapp.com',
  local: 'http://localhost:'
}

const selectorCalls = ['drew', 'dropped', 'pulled it up and played', 'reloaded the set and dropped', 'smashed', 'selected', 'played', 'wheeled up']
const URLfactory = (endpoint, ERROR = false, port = CLIENT_PORT, mode = MODE) => {
  if (MODE===DEPLOY){
    if (ERROR) {
      return URL_root[mode] + '/error?error=' + endpoint
    } else {
      return URL_root[mode] + '/' + endpoint + '/'
    }
  } else {
    if (ERROR) {
      return URL_root[mode] + port + '/error?error=' + endpoint
    } else {
      return URL_root[mode] + port + '/' + endpoint + '/'
    }
  }
}
/* 
*/

const sendToBot = (message, token = "645121157:AAFVvaehPv3fkN4mALIysCq27b5Q3gtyIPY", chatId = '-1001389216905') => {
  axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id: chatId,
    status: 200,
    text: message
  })
  .catch(err => {
    console.log('Error :', err)
    res.end('Error :' + err)
  })
}

const HOST_REDIRECT_URI = 'https://rcd-api.herokuapp.com/callback/'
const GUEST_REDIRECT_URI = 'https://rcd-api.herokuapp.com/guestcallback/'
const PERMISSIONS_SCOPE = 'user-read-currently-playing user-modify-playback-state user-read-playback-state streaming user-read-private';
const STATE_KEY = 'spotify_auth_state';

const playbackDelay = 0

// set mode to LOCAL or DEPLOY
const host = {
  token: null,
  name: null
}

let users = [];
// var tokenExpiry = new Date().getTime();

app.use(express.static(__dirname + '/public'))
  .use(cookieParser())
  .use(cors())



let generateRandomString = function(length) {
  let text = '';
  let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

let wait_promise = (time) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, time);
  })

}
let master = {
  track_uri: null,
  track_name: null,
  artist_name: null,
  play_position: null,
  selector_name: null,
  selector_token: null
}


app.get('/login', function(req, res) {
  const state = generateRandomString(16);
  res.cookie(STATE_KEY, state);
  if (!host.token) {
    res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: CLIENT_ID,
      scope: PERMISSIONS_SCOPE,
      redirect_uri: HOST_REDIRECT_URI,
      state: state
    }));
  } else {
    res.redirect(URLfactory('alreadyHosted'))
  }
});

app.get('/invite', function(req, res) {
  const state = generateRandomString(16);
  res.cookie(STATE_KEY, state);
  if (host.token) {
    res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: CLIENT_ID,
      scope: PERMISSIONS_SCOPE,
      redirect_uri: GUEST_REDIRECT_URI,
      state: state
    }));
  } else { 
    res.redirect(URLfactory('no_Host_Connected', ERROR)) 
  }
});

app.get('/callback', function(req, res) {
  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies[STATE_KEY] : null;
  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(STATE_KEY);

    rp.post(spotify.authOptions(HOST_REDIRECT_URI, code), function(error, response, body) {
      if (!error && response.statusCode === 200) {
        host.token = body.access_token
        rp(spotify.getUserOptions(host))
        .then((user_details) => {
          host.name = user_details.display_name || 'DJ Anonymous'
          sendToBot(`${host.name} just stepped up the 121011.5s`)
          res.redirect(URLfactory('hostLoggedIn'))
        })
        .catch( e => res.redirect(URLfactory('getting_host_options', ERROR)) )
      } else {
        res.redirect(URLfactory('spotify_host_auth', ERROR))
      }
    })
  }
});

app.get('/guestcallback', function(req, res) {
  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies[STATE_KEY] : null;
  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(STATE_KEY);

    rp.post(spotify.authOptions(GUEST_REDIRECT_URI, code), function(error, response, body) {
      if (!error && response.statusCode === 200) {
        let newUser = {}
        newUser.token = body.access_token
        rp(spotify.getUserOptions(newUser))
        .then( (user_details) => {
          console.log(`${user_details.name} trying to join.`)
          newUser.name = user_details.display_name
          return checkCurrentTrack(host, master)
        })
        .then( (obj) => {
          master = obj;
          return rp(spotify.setPlaybackOptions(newUser, master, playbackDelay))
        })
        .then( () => {
          users = [...users,newUser]
          sendToBot(`${newUser.name} just joined the party`)
          res.redirect(URLfactory('guestLoggedIn'))
          pollUsersPlayback()
        })
        .catch( e =>  {
          console.log('Error in guest sync: ', e)
          res.redirect(URLfactory('guest_sync', ERROR))
        })
      } else {
        res.redirect(URLfactory('guest_callback', ERROR))
      }
    })
  }
});


const syncToMaster = ( host, users) => {
  if (host.token && users.length){
    let allUsers = [...users, host]
    allUsers.some(
      (user) => {
        wait_promise(350)
        .then( () => checkCurrentTrack(user))
        .then( result => {
          if (result.track_uri !== master.track_uri) {
            master = result
            allUsers.splice(allUsers.indexOf(user),1)
            resync(allUsers, master)
            return true
          } 
        })
        .catch(e => console.log(e.message))
      })
  } else {
    console.log('only one user in the room');
  }
}

const resync = (allUsers, master) => {
  sendToBot(`${master.selector_name} ${selectorCalls[Math.floor(Math.random()*selectorCalls.length)]} ${master.track_name}!!`)
  allUsers.forEach((user =>  
    rp(spotify.setPlaybackOptions(user,master,playbackDelay))
    .then(() => console.log(`...`))
    .catch(e => console.log(e.message))))
}

// polling loop at 1s
 
const pollUsersPlayback = () => {
  setInterval(() => syncToMaster(host, users), 350 * (users.length + 1)); 
}

const checkCurrentTrack = (user) => {
  return new Promise (function (resolve, reject) {
    return rp(spotify.getPlaybackOptions(user)).then((res) => {
      const master_ref = { 
        track_uri: res.item.uri,
        track_name: res.item.name,
        artist_name: res.item.artists[0].name,
        play_position: res.progress_ms,
        selector_name: user.name,
        selector_token: user.token}
      return resolve(master_ref)
    })
    .catch(e => reject(e.message))
  })
}

app.listen(SERVER_PORT, () => {
  console.log(`Started RCD Server.js on ${MODE}: ${SERVER_PORT}`);
});
