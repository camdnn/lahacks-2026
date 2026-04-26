import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Coins, CheckCircle, Lock } from "lucide-react";
import { Blob, type PaletteKey, type ShapeKey } from "../components/Blob";
import { useAuth } from "../context/AuthContext";

const C = {
  bg: "#FBF1E5",
  card: "#FFFAF1",
  border: "#EAD7BE",
  ink: "#3D2A1B",
  soft: "#806550",
  accent: "#F08F60",
  accentSoft: "#FFE8D9",
  green: "#7FB069",
  greenSoft: "#D9F0D3",
};

interface Character {
  key: string;
  name: string;
  palette: PaletteKey;
  shape: ShapeKey;
  price: number;
  tagline: string;
}

const CHARACTERS: Character[] = [
  {
    key: "peach_classic",
    name: "Peachy",
    palette: "peach",
    shape: "classic",
    price: 0,
    tagline: "Your original companion",
  },
  {
    key: "cream_wide",
    name: "Cloudy",
    palette: "cream",
    shape: "wide",
    price: 150,
    tagline: "Soft, calm, and wide-eyed",
  },
  {
    key: "butter_eared",
    name: "Sunny",
    palette: "butter",
    shape: "eared",
    price: 200,
    tagline: "Golden and full of energy",
  },
  {
    key: "rose_baby",
    name: "Rosey",
    palette: "rose",
    shape: "baby",
    price: 250,
    tagline: "Tiny but mighty",
  },
  {
    key: "coral_spike",
    name: "Ember",
    palette: "coral",
    shape: "spike",
    price: 300,
    tagline: "Fierce and fiery",
  },
  {
    key: "honey_tall",
    name: "Honey",
    palette: "honey",
    shape: "tall",
    price: 350,
    tagline: "Sweet and statuesque",
  },
];

function CharacterCard({
  character,
  owned,
  active,
  canAfford,
  balance,
  onBuy,
  onEquip,
  buying,
}: {
  character: Character;
  owned: boolean;
  active: boolean;
  canAfford: boolean;
  balance: number;
  onBuy: () => void;
  onEquip: () => void;
  buying: boolean;
}) {
  const isDefault = character.price === 0;

  return (
    <div
      style={{
        background: C.card,
        border: `2px solid ${active ? C.accent : C.border}`,
        borderRadius: 24,
        padding: "28px 20px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        position: "relative",
        transition: "border-color 0.2s, box-shadow 0.2s",
        boxShadow: active ? "0 0 0 4px rgba(240,143,96,0.15)" : "none",
      }}
    >
      {active && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: C.green,
            color: "#fff",
            borderRadius: 999,
            padding: "3px 10px",
            fontSize: 11,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <CheckCircle size={11} />
          Equipped
        </div>
      )}

      {!owned && !isDefault && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            background: C.border,
            color: C.soft,
            borderRadius: 999,
            padding: "3px 10px",
            fontSize: 11,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Lock size={10} />
          Locked
        </div>
      )}

      {/* Blob preview */}
      <div style={{ marginTop: 8 }}>
        <Blob
          palette={character.palette}
          shape={character.shape}
          state={owned ? "idle" : "sleeping"}
          size={110}
          showGround
        />
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontWeight: 900, fontSize: 18, color: C.ink, marginBottom: 2 }}>
          {character.name}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.soft }}>
          {character.tagline}
        </div>
      </div>

      {/* Price badge */}
      {isDefault ? (
        <div
          style={{
            background: C.greenSoft,
            color: C.green,
            borderRadius: 999,
            padding: "4px 12px",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          Free · Default
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            background: "#FFF3D6",
            color: "#C97A3F",
            borderRadius: 999,
            padding: "4px 12px",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          <Coins size={13} />
          {character.price} coins
        </div>
      )}

      {/* Action button */}
      {isDefault || owned ? (
        <button
          onClick={onEquip}
          disabled={active}
          style={{
            width: "100%",
            padding: "10px 0",
            borderRadius: 12,
            border: `2px solid ${active ? C.accent : C.border}`,
            background: active ? C.accentSoft : "transparent",
            color: active ? C.accent : C.soft,
            fontWeight: 800,
            fontSize: 13,
            cursor: active ? "default" : "pointer",
            fontFamily: "inherit",
            transition: "all 0.15s",
          }}
        >
          {active ? "Equipped ✓" : "Equip"}
        </button>
      ) : canAfford ? (
        <button
          onClick={onBuy}
          disabled={buying}
          style={{
            width: "100%",
            padding: "10px 0",
            borderRadius: 12,
            border: "none",
            background: buying ? C.border : C.accent,
            color: buying ? C.soft : "#fff",
            fontWeight: 800,
            fontSize: 13,
            cursor: buying ? "default" : "pointer",
            fontFamily: "inherit",
            boxShadow: buying ? "none" : "0 4px 14px rgba(240,143,96,0.35)",
            transition: "all 0.15s",
          }}
        >
          {buying ? "Buying…" : `Buy · ${character.price} coins`}
        </button>
      ) : (
        <div style={{ width: "100%", textAlign: "center" }}>
          <button
            disabled
            style={{
              width: "100%",
              padding: "10px 0",
              borderRadius: 12,
              border: `2px solid ${C.border}`,
              background: "transparent",
              color: C.border,
              fontWeight: 800,
              fontSize: 13,
              cursor: "not-allowed",
              fontFamily: "inherit",
              marginBottom: 4,
            }}
          >
            Buy · {character.price} coins
          </button>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.soft }}>
            Need {character.price - balance} more coins
          </div>
        </div>
      )}
    </div>
  );
}

export default function Store() {
  const navigate = useNavigate();
  const { profile, purchaseCharacter, setActiveCharacter } = useAuth();
  const [buyingKey, setBuyingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const owned = profile?.owned_characters ?? ["peach_classic"];
  const active = profile?.active_character ?? "peach_classic";
  const balance = profile?.coin_balance ?? 0;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const handleBuy = async (char: Character) => {
    setBuyingKey(char.key);
    const ok = await purchaseCharacter(char.key, char.price);
    setBuyingKey(null);
    if (ok) {
      showToast(`${char.name} unlocked! 🎉`);
    } else {
      showToast("Not enough coins.");
    }
  };

  const handleEquip = (char: Character) => {
    setActiveCharacter(char.key);
    showToast(`${char.name} equipped!`);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        fontFamily: "Nunito, system-ui, sans-serif",
        color: C.ink,
        padding: "0 0 80px",
      }}
    >
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            background: C.ink,
            color: "#fff",
            borderRadius: 999,
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 700,
            zIndex: 100,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            pointerEvents: "none",
          }}
        >
          {toast}
        </div>
      )}

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px 0" }}>
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 40,
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <button
            onClick={() => navigate("/home")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              color: C.soft,
              fontFamily: "inherit",
              padding: 0,
            }}
          >
            <ArrowLeft size={15} />
            Back to home
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "#FFF3D6",
              color: "#C97A3F",
              borderRadius: 999,
              padding: "8px 18px",
              fontWeight: 900,
              fontSize: 15,
            }}
          >
            <Coins size={16} />
            {balance} coins
          </div>
        </div>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: C.accentSoft,
              color: C.accent,
              borderRadius: 999,
              padding: "5px 14px",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 1,
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            ✦ Character Shop
          </div>
          <h1
            style={{
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 900,
              letterSpacing: -1,
              color: C.ink,
              marginBottom: 10,
            }}
          >
            Meet your companions
          </h1>
          <p style={{ fontSize: 15, fontWeight: 500, color: C.soft }}>
            Spend your focus coins to unlock new blob friends.
          </p>
        </div>

        {/* Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 20,
          }}
        >
          {CHARACTERS.map((char) => (
            <CharacterCard
              key={char.key}
              character={char}
              owned={owned.includes(char.key)}
              active={active === char.key}
              canAfford={balance >= char.price}
              balance={balance}
              onBuy={() => handleBuy(char)}
              onEquip={() => handleEquip(char)}
              buying={buyingKey === char.key}
            />
          ))}
        </div>

        {/* Earn more hint */}
        <div
          style={{
            marginTop: 48,
            background: C.card,
            border: `1.5px solid ${C.border}`,
            borderRadius: 20,
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.ink, marginBottom: 3 }}>
              Need more coins?
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.soft }}>
              Earn 1 coin every 5 seconds of focused work — up to 3× with your streak bonus.
            </div>
          </div>
          <button
            onClick={() => navigate("/start")}
            style={{
              background: C.accent,
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "11px 22px",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              boxShadow: "0 4px 14px rgba(240,143,96,0.35)",
            }}
          >
            Start a session →
          </button>
        </div>
      </div>
    </div>
  );
}
