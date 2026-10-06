// Configuration Auth.js (next-auth v5) : sessions de 8 heures, deux façons de se connecter.
// - « admin » : e-mail + mot de passe + code TOTP (F1)
// - « lien » : lien magique des référents (F2)
// Les droits sont revérifiés en base à chaque page (lib/auth/acces.ts).
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { verifierConnexionAdmin } from "@/lib/auth/connexion-admin";
import { consommerLienMagique } from "@/lib/auth/lien-magique";
import { getDb } from "@/lib/db/client";

declare module "next-auth" {
  interface User {
    role?: "admin" | "referent";
  }
  interface Session {
    user: { id: string; role: "admin" | "referent"; name: string; email: string };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    uid?: string;
    role?: "admin" | "referent";
  }
}

class CompteBloque extends CredentialsSignin {
  code = "bloque";
}

const DUREE_SESSION_S = 8 * 60 * 60;

const saisieAdmin = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
  code: z.string().trim().regex(/^\d{6}$/),
});

const saisieLien = z.object({ token: z.string().min(20).max(100) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: DUREE_SESSION_S },
  jwt: { maxAge: DUREE_SESSION_S },
  providers: [
    Credentials({
      id: "admin",
      credentials: { email: {}, password: {}, code: {} },
      async authorize(credentials) {
        const saisie = saisieAdmin.safeParse(credentials);
        if (!saisie.success) return null;
        const resultat = await verifierConnexionAdmin(getDb(), saisie.data);
        if (!resultat.ok) {
          if (resultat.raison === "bloque") throw new CompteBloque();
          return null;
        }
        return resultat.user;
      },
    }),
    Credentials({
      id: "lien",
      credentials: { token: {} },
      async authorize(credentials) {
        const saisie = saisieLien.safeParse(credentials);
        if (!saisie.success) return null;
        return consommerLienMagique(getDb(), saisie.data.token);
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid ?? "";
      session.user.role = token.role ?? "referent";
      return session;
    },
  },
});
