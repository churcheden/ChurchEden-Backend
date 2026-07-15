import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { randomBytes } from 'crypto';
import { prisma } from './prisma.js';
import { env } from '../env.js';
import { hashPassword } from '../utils/password.js';

passport.use(new GoogleStrategy({
    clientID: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackURL: env.GOOGLE_CALLBACK_URL,
    passReqToCallback: true,
    scope: ['profile', 'email']
},  async(_req, _accessToken, _refreshToken, profile, done) => {
    try{
        const { id: googleId, emails, displayName } = profile;
        const email = emails?.[0]?.value;

        if(!email) {
            return done(new Error("No email found in Google profile!"));
        };

        let user = await prisma.user.findUnique({
            where: { googleId }
        });

        if(user) {
            return done(null, user)
        };

        user = await prisma.user.findUnique({
            where: { email }
        });

        if(user) {
            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    loginProvider: 'GOOGLE',
                    googleId: profile.id,
                    isVerified: true,
                }
            })
            return done(null, user);
        }

        const randomPassword = randomBytes(32).toString('hex');
        const hashedPassword = await hashPassword(randomPassword);

        user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                googleId,
                fullName: displayName ?? null,
                loginProvider: 'GOOGLE',
                isVerified: true,
            }
        });
        return done(null, user);

    }catch(error) {
        done(error as Error, undefined);
    }
}));

export { passport };
