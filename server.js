import express from "express";
import cors from "cors";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());

const LIVEKIT_URL = process.env.LIVEKIT_URL;
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;

if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
  console.error("⚠️  LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET manquants dans .env");
  process.exit(1);
}

const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);

// Génère un token d'accès à une room.
// canPublish=true  -> le professeur (présentateur du direct)
// canPublish=false -> l'élève (spectateur)
app.post("/api/token", async (req, res) => {
  try {
    const { room, identity, name, canPublish } = req.body;
    if (!room || !identity) {
      return res.status(400).json({ error: "room et identity sont requis" });
    }

    const at = new AccessToken(API_KEY, API_SECRET, {
      identity,
      name: name || identity,
      ttl: "4h",
    });
    at.addGrant({
      room,
      roomJoin: true,
      canPublish: !!canPublish,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    res.json({ token, url: LIVEKIT_URL });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur lors de la génération du token" });
  }
});

// Liste les rooms actuellement actives (pour afficher "en direct" côté élèves)
app.get("/api/rooms/active", async (req, res) => {
  try {
    const rooms = await roomService.listRooms();
    res.json({
      rooms: rooms.map((r) => ({
        name: r.name,
        numParticipants: r.numParticipants,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur lors de la récupération des rooms" });
  }
});

// Ferme une room (arrête le direct pour tout le monde côté serveur)
app.delete("/api/rooms/:room", async (req, res) => {
  try {
    await roomService.deleteRoom(req.params.room);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur lors de la fermeture de la room" });
  }
});

// Retire un spectateur précis d'une room (utilisé par le bouton "Bloquer")
app.delete("/api/rooms/:room/participants/:identity", async (req, res) => {
  try {
    await roomService.removeParticipant(req.params.room, req.params.identity);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur lors du retrait du spectateur" });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Backend Lycée+ LiveKit lancé sur http://localhost:${PORT}`);
});
