import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Coins, CheckCircle, Lock } from "lucide-react";
import { Blob } from "../components/Blob";
import { useAuth } from "../context/AuthContext";
import { CHARACTERS, type Character } from "../data/characters";

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

  const owned = profile?.owned_characters ?? ["cream_wide"];
  const active = profile?.active_character ?? "cream_wide";
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
        display: "flex",
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

      {/* Sidebar */}
      <div
        style={{
          width: 280,
          flexShrink: 0,
          borderRight: `1.5px solid ${C.border}`,
          background: C.card,
          display: "flex",
          flexDirection: "column",
          padding: "24px 16px",
          gap: 4,
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: C.soft,
            fontSize: 13,
            fontWeight: 800,
            fontFamily: "inherit",
            padding: "8px 10px",
            borderRadius: 10,
            marginBottom: 8,
            textAlign: "left",
          }}
        >
          <ArrowLeft size={15} /> Back
        </button>

        <div
          style={{
            padding: "0 10px 16px",
            borderBottom: `1.5px solid ${C.border}`,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: 1.3,
              color: C.soft,
              marginBottom: 2,
            }}
          >
            Focus Friends
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: -0.4 }}>
            Character Shop
          </div>
        </div>

        <div style={{ marginTop: "auto", paddingTop: 24, borderTop: `1.5px solid ${C.border}` }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "#FFF3D6",
              color: "#C97A3F",
              borderRadius: 14,
              padding: "10px 14px",
              fontWeight: 900,
              fontSize: 15,
              marginBottom: 12,
            }}
          >
            <Coins size={15} />
            {balance} coins
          </div>
          <button
            onClick={() => navigate("/start")}
            style={{
              width: "100%",
              background: C.accent,
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "11px 0",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: "0 4px 14px rgba(240,143,96,0.35)",
            }}
          >
            Start a session →
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "40px 32px 80px" }}>
        <h1
          style={{
            fontSize: "clamp(24px, 3vw, 36px)",
            fontWeight: 900,
            letterSpacing: -0.8,
            color: C.ink,
            marginBottom: 6,
          }}
        >
          Meet your companions
        </h1>
        <p style={{ fontSize: 14, fontWeight: 500, color: C.soft, marginBottom: 36 }}>
          Spend your focus coins to unlock new blob friends.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
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

        <div
          style={{
            marginTop: 48,
            background: C.card,
            border: `1.5px solid ${C.border}`,
            borderRadius: 20,
            padding: "20px 24px",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 15, color: C.ink, marginBottom: 3 }}>
            Need more coins?
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.soft }}>
            Earn coins every 5 seconds of focused work — up to 3× with your streak bonus.
          </div>
        </div>
      </div>
    </div>
  );
}
