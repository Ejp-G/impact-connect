# 🕊️ IMPACT CONNECT — Guide de déploiement complet

> Application SaaS de suivi pastoral — Next.js 14 + Supabase + Vercel

---

## 📦 Contenu du projet

```
impact-connect/
├── src/
│   ├── app/                    # Pages et API routes (Next.js App Router)
│   │   ├── dashboard/          # Tableau de bord
│   │   ├── visiteurs/          # Gestion des visiteurs
│   │   ├── pipeline/           # Pipeline Kanban
│   │   ├── fi/                 # Familles d'Impact
│   │   ├── suivi/              # Suivi & Tâches
│   │   ├── jeunesse/           # Module jeunesse
│   │   ├── communications/     # Messagerie
│   │   ├── carte/              # Carte géographique
│   │   ├── rapports/           # Statistiques
│   │   ├── qrcode/             # Formulaire public (QR Code)
│   │   ├── journal/            # Journal d'audit
│   │   ├── utilisateurs/       # Gestion utilisateurs (admin)
│   │   ├── parametres/         # Paramètres
│   │   └── api/                # API REST
│   ├── components/             # Composants réutilisables
│   ├── hooks/                  # React Hooks
│   └── lib/                    # Utilitaires et config
├── supabase/migrations/        # Schéma SQL
├── public/                     # Fichiers statiques + PWA
├── middleware.js                # Auth + protection par rôle
└── vercel.json                  # Config Vercel + Crons
```

---

## 🚀 DÉPLOIEMENT ÉTAPE PAR ÉTAPE

### ÉTAPE 1 — Créer le compte Supabase

1. Aller sur **https://supabase.com** → "Start your project"
2. Créer un projet (ex: "impact-connect")
3. Choisir la région **Europe West** (Frankfurt ou London)
4. Copier vos clés dans **Project Settings → API** :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

### ÉTAPE 2 — Créer la base de données

1. Dans Supabase → **SQL Editor** → "New query"
2. Copier **tout le contenu** de `supabase/migrations/001_schema.sql`
3. Cliquer "Run" (le script prend ~10 secondes)
4. Vérifier que toutes les tables sont créées dans **Table Editor**

### ÉTAPE 3 — Créer le premier administrateur

Dans Supabase → **Authentication → Users → Invite user** :

```
Email: pasteur@votre-eglise.gp
Password: (choisir un mot de passe fort)
```

Puis dans **SQL Editor**, exécuter :
```sql
UPDATE profiles
SET role = 'admin', name = 'Pasteur Admin', sex = 'M', active = true
WHERE email = 'pasteur@votre-eglise.gp';
```

### ÉTAPE 4 — Créer les Familles d'Impact

Dans **SQL Editor**, adapter et exécuter :
```sql
INSERT INTO familles_impact (name, commune_name, day, time, capacity, status) VALUES
  ('FI Pointe-à-Pitre', 'Pointe-à-Pitre', 'Jeudi', '19h30', 15, 'active'),
  ('FI Abymes',          'Abymes',          'Jeudi', '19h30', 15, 'active'),
  ('FI Baie-Mahault',    'Baie-Mahault',    'Jeudi', '19h30', 15, 'active'),
  ('FI Sainte-Anne',     'Sainte-Anne',     'Vendredi', '19h00', 12, 'active'),
  ('FI Capesterre',      'Capesterre',      'Vendredi', '19h00', 12, 'active');
```

### ÉTAPE 5 — Déployer sur Vercel

1. Installer Vercel CLI : `npm install -g vercel`
2. Dans le dossier du projet : `vercel login`
3. Déployer : `vercel --prod`
4. Ou pousser sur GitHub et connecter le repo à Vercel.

Dans Vercel → **Settings → Environment Variables**, ajouter :
```
NEXT_PUBLIC_SUPABASE_URL     = votre_url
NEXT_PUBLIC_SUPABASE_ANON_KEY = votre_anon_key
SUPABASE_SERVICE_ROLE_KEY    = votre_service_role_key
CRON_SECRET                  = une_chaine_aleatoire_32_chars
RESEND_API_KEY               = votre_resend_key (optionnel)
```

### ÉTAPE 6 — Activer les Crons Vercel

Dans **Vercel → Settings → Cron Jobs**, vérifier que ces deux crons sont actifs :
- `/api/cron/daily` → tous les jours à 7h
- `/api/cron/tuesday-reminder` → tous les mardis à 9h

> ⚠️ Les Crons Vercel nécessitent le plan **Pro** (~20$/mois)

---

## 📱 INSTALLATION COMME APPLICATION (PWA)

### Sur iPhone (iOS)
1. Ouvrir Safari sur **https://votre-app.vercel.app**
2. Appuyer sur l'icône **Partager** (carré avec flèche)
3. Sélectionner **"Sur l'écran d'accueil"**
4. Nommer l'app **"Impact"** → Ajouter

### Sur Android
1. Ouvrir Chrome sur **https://votre-app.vercel.app**
2. Menu (3 points) → **"Ajouter à l'écran d'accueil"**
3. Confirmer l'installation
4. L'app apparaît comme une vraie application

---

## 👥 CRÉER DES UTILISATEURS

### Via l'interface Admin (recommandé)

1. Se connecter avec le compte Admin
2. Aller dans **Utilisateurs** (menu gauche)
3. Cliquer **"Nouvel utilisateur"**
4. Remplir : nom, email, mot de passe, rôle, sexe
5. Pour les **Pilotes FI** : sélectionner la FI assignée

### Via Supabase (pour import massif)

Dans **Authentication → Users → Invite user** pour chaque personne,
puis dans SQL Editor mettre à jour le rôle :
```sql
UPDATE profiles SET role = 'pilote_fi', name = 'Ruth Céleste', sex = 'F'
WHERE email = 'ruth@eglise.gp';
```

---

## 🔐 RÔLES ET ACCÈS

| Rôle | Pages accessibles |
|------|-------------------|
| Administrateur | Tout |
| Resp. Intégration | Dashboard, Visiteurs, Pipeline, Suivi, QR, Journal, Rapports |
| Équipe Intégration | Visiteurs, QR Code |
| Resp. Suivi | Dashboard, Visiteurs, Suivi, Communications, Rapports |
| Équipe Suivi | Visiteurs, Suivi, Communications |
| Pilote FI | FI, Suivi, Communications, QR Code |
| Superviseur | Dashboard, Visiteurs, FI, Rapports, Carte, Communications |
| Resp. Jeunesse | Jeunesse, Visiteurs, Communications |

---

## 📊 COÛTS MENSUELS ESTIMÉS

| Service | Plan | Coût |
|---------|------|------|
| Supabase | Free (jusqu'à 500MB) | 0€ |
| Supabase | Pro (si >500MB ou plus de 50k users) | ~25€/mois |
| Vercel | Hobby (sans crons auto) | 0€ |
| Vercel | Pro (avec crons auto) | ~20€/mois |
| Resend Email | Free (3000 emails/mois) | 0€ |
| **Total production** | | **~45€/mois** |

---

## ⚙️ AUTOMATISATIONS INCLUSES

| Automatisation | Déclencheur |
|----------------|-------------|
| Attribution agent H→H / F→F | À la création du contact |
| Attribution FI par commune | À la création du contact |
| Création tâches J+3,7,14,21,30 | À la création du contact |
| Notification pilote FI | Quand une personne est assignée |
| Archivage mineur J+30 | Cron quotidien 7h |
| Suppression mineur J+90 | Cron quotidien 7h |
| MAJ alertes et scores | Cron quotidien 7h |
| Rappel pilotes FI | Cron mardi 9h |
| "Vos actions du jour" | Cron quotidien 7h |

---

## 🔗 FORMULAIRE QR CODE

Le formulaire public est accessible à l'URL :
**https://votre-app.vercel.app/qrcode**

Pour générer un QR Code pointant vers cette URL :
1. Aller sur **https://www.qrcode-monkey.com**
2. Coller l'URL de votre formulaire
3. Télécharger le QR Code en PNG HD
4. Imprimer et afficher dans l'église

---

## 🛠️ COMMANDES UTILES

```bash
# Développement local
npm install
cp .env.local.example .env.local
# Remplir .env.local avec vos clés Supabase
npm run dev

# Build de production
npm run build

# Déploiement
vercel --prod
```

---

## 📞 SUPPORT

Pour toute question sur le déploiement, consultez :
- Supabase docs : https://supabase.com/docs
- Next.js docs : https://nextjs.org/docs
- Vercel docs : https://vercel.com/docs
