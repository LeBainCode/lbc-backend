// src/config/passport.js
// config/passport.js
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/User');

const debug = (message, data) => {
  console.log(`[GitHub Auth] ${message}`, data || '');
};

exports.configureGitHubStrategy = () => {
  debug('Configuring GitHub strategy');

  passport.serializeUser((user, done) => {
    debug('Serializing user', { id: user._id });
    done(null, user._id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      debug('Deserializing user', { id });
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      debug('Deserialization error', error);
      done(error);
    }
  });

  passport.use(new GitHubStrategy({
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/api/auth/github/callback`
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        debug('Processing GitHub profile', { id: profile.id });
        
        let user = await User.findOne({ githubId: profile.id });
        
        if (!user) {
          const latestUser = await User.findOne({ role: 'user' })
            .sort({ username: -1 });
          
          const newUserNumber = latestUser 
            ? String(Number(latestUser.username) + 1).padStart(3, '0')
            : '001';
          
          debug('Creating new user', { username: newUserNumber });

          user = await User.create({
            username: newUserNumber,
            githubId: profile.id,
            email: profile.emails?.[0]?.value,
            role: 'user',
            githubProfile: {
              username: profile.username,
              profileUrl: profile.profileUrl,
              avatarUrl: profile._json.avatar_url
            },
            progress: {
              cModule: { completed: 0, total: 10 },
              examModule: { completed: 0, total: 4, isUnlocked: false }
            }
          });
        }

        debug('Authentication successful', { username: user.username });
        return done(null, user);
      } catch (error) {
        debug('Authentication error', error);
        return done(error);
      }
    }
  ));
};