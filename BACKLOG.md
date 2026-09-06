# Backlog

Idées et travaux identifiés mais pas encore planifiés ni chiffrés — à
distinguer du [CHANGELOG.md](CHANGELOG.md) qui ne liste que ce qui est
réellement livré. Une entrée ici n'est retirée que lorsqu'elle est faite (et
documentée dans le changelog) ou explicitement abandonnée.

## Administration

- **Écrans manager pour les expressions de besoin.** Aujourd'hui, la création
  d'une expression de besoin n'existe que côté module Recrutement (mock, voir
  `dev-recrutement-module`), accessible à qui a accès à ce module. Le
  processus du client suppose qu'un manager/département (espace employé,
  hors RH) puisse lui-même déposer une demande de poste ("les autres
  départements demandent un employé", cf. `liste-besoins/Recruitment.csv`).
  Il faudra ajouter un écran côté espace employé/Administration pour ça, une
  fois le module Recrutement branché à un vrai backend. Dépend aussi du
  chantier de permissions du module Recrutement (accès et rôles pas encore
  définis).

- **Conversion candidat → employé (Employee Master).** Demande explicite du
  client (`liste-besoins/Recruitment.csv`, item 4) : *"Parmi les notes et les
  observations, il est possible de transférer immédiatement un candidat à un
  employé."* Le document de spec fonctionnelle appelle ça l'**"Inclusion d'un
  Potentiel"** dans le fichier du Personnel, *"lorsqu'il est confirmé à
  l'issue du processus de recrutement"* (doc2, section 7.6.4, "Objet
  Potentiel"). Rien de ça n'existe aujourd'hui — le pipeline Recrutement
  (mock) est entièrement déconnecté du vrai module Employés
  (`stores/employees.ts`), y compris à la conversion de la période d'essai
  (`trialStore.convert()` ne fait que changer un statut fictif). Un bouton
  "Créer le profil employé" existe déjà en simulation sur la fiche d'un
  contrat accepté (voir ContractCard.vue) — reste à le brancher pour de vrai :
  pré-remplir ce qu'on connaît déjà (nom, poste, entité, date de début,
  salaire) et demander le reste (naissance, situation matrimoniale, pièce
  d'identité, matricule…) avant de créer un vrai `Employee` via l'API
  existante. Nécessite un vrai backend Recrutement.

- **Rappels des échéances à venir sur une période donnée.** Idée remontée en
  revue hebdo du 29/08 en relisant les documents client sur l'Administration
  (pas encore appliquée, juste mise de côté) : pouvoir choisir une période
  (ex. aujourd'hui à la fin de l'année) et voir/être notifié des échéances qui
  tombent dedans, fins de CDD, fins de stage, anniversaires des employés. Rien
  n'existe aujourd'hui pour ça dans le module Administration.

## Recrutement

- **Candidature interne (mobilité).** Le client décrit explicitement la
  gestion des *"mobilités internes"* (doc1, ATS) et un bouton *"Ajouter à la
  candidature"* directement sur la fiche d'un salarié, permettant *"d'ajouter
  un salarié à des candidatures associées à des offres d'emploi"* (doc2,
  ligne 742). Aujourd'hui, `Application` ne modélise que des candidats
  externes (nom/email/téléphone en texte libre) : rien ne permet à un
  employé existant de postuler en interne, ni de le faire depuis sa fiche.
  Buildable en mock dès maintenant (même annuaire employé déjà utilisé pour
  les participants d'entretien, voir InterviewsView.vue).

- **Diffusion multi-plateformes des offres.** Le client mentionne la
  *"création et diffusion des offres d'emploi sur différentes plateformes"*
  (doc1, ATS). Aujourd'hui, une offre publiée n'est visible que sur notre
  propre portail carrière (`/careers`). Publier vers de vraies plateformes
  externes (LinkedIn, jobboards locaux…) demande de vraies intégrations
  tierces — hors de portée d'un module mock, à traiter avec un vrai backend.

- **Communication automatique avec les candidats.** Le client mentionne des
  *"mails automatiques"* et un *"suivi du statut"* envoyés au candidat à
  chaque étape (doc1, ATS). Aujourd'hui, aucun email n'est envoyé à aucun
  moment du pipeline (candidature reçue, entretien planifié, refus…) — pas de
  service d'email sur ce module. Nécessite un vrai backend.

- **Statut "ouvert/fermé" sur un Potentiel (CVthèque).** Le document de spec
  mentionne une vue par défaut *"Potentiels ouverts"* (doc2, 7.6.2) — sous-
  entendu qu'un Potentiel a un statut (ouvert = toujours disponible/à
  recontacter, fermé = plus d'actualité). `TalentPoolEntry` n'a aujourd'hui
  aucun statut, juste des tags et une note libre. Buildable en mock.

- **Historique d'évaluations sur un Potentiel.** Le document liste
  *"Evaluations Potentiel"* comme une entité liée à part entière (doc2,
  7.6.4), pas un simple champ texte. `TalentPoolEntry.notes` est aujourd'hui
  une chaîne libre unique, sans historique ni structure (note, évaluateur,
  date). Buildable en mock, même modèle que TrialEmployee.evaluation.

- **Grilles d'évaluation standardisées pour les entretiens.** La cartographie
  du client liste explicitement des *"Grilles d'évaluation standardisées"*
  sous "Entretiens", et le document de spec mentionne des *"Modèles Fiche
  d'entretien"* comme entité à part. Aujourd'hui, `InterviewEvaluation` n'a
  qu'une note globale /5 + un commentaire libre — pas de grille configurable
  par critères (comme les modèles de contrat, mais pour l'évaluation
  d'entretien). Buildable en mock, même pattern que ContractTemplate.
