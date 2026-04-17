const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./db');
const { v4: uuidv4 } = require('uuid');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  done(null, user || null);
});

// Google OAuth
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
  }, (accessToken, refreshToken, profile, done) => {
    let user = db.prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?')
      .get('google', profile.id);

    if (!user) {
      const id = uuidv4();
      const email = profile.emails?.[0]?.value || '';
      const name = profile.displayName || '';
      const avatar = profile.photos?.[0]?.value || '';

      // First user becomes admin and auto-approved
      const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
      const isAdmin = userCount === 0 ? 1 : 0;
      const approved = isAdmin ? 1 : 0;

      db.prepare(
        'INSERT INTO users (id, email, name, avatar, provider, provider_id, is_admin, approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(id, email, name, avatar, 'google', profile.id, isAdmin, approved);

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    }

    done(null, user);
  }));
}

module.exports = passport;
