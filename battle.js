import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
    getAuth,
    signInAnonymously
} from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
    getDatabase,
    ref,
    set,
    update
} from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const createRoomButton = document.getElementById("createRoomButton");
const joinRoomButton = document.getElementById("joinRoomButton");
const battleCodeInput = document.getElementById("battleCode");
const roomCodeSection = document.getElementById("roomCodeSection");
const generatedRoomCode = document.getElementById("generatedRoomCode");
const roomStatusMessage = document.getElementById("roomStatusMessage");

const firebaseConfig = {
    apiKey: "AIzaSyBMbTPARxGLgZHD3lVaY4NeOaHBVHhPRs4",
    authDomain: "pokevoice-quiz-bf927.firebaseapp.com",
    projectId: "pokevoice-quiz-bf927",
    storageBucket: "pokevoice-quiz-bf927.firebasestorage.app",
    messagingSenderId: "22531666936",
    appId: "1:22531666936:web:67a6e63414d5b15632dc0d",
    databaseURL: "https://pokevoice-quiz-bf927-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const sessionKey = "pokemon-battle-session";
const battlePokemonList = [
    { id: 1, name: "フシギダネ" },
    { id: 6, name: "リザードン" },
    { id: 25, name: "ピカチュウ" },
    { id: 150, name: "ミュウツー" },
    { id: 658, name: "ゲッコウガ" }
];

function generateRoomCode() {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 6 }, () =>
        characters[Math.floor(Math.random() * characters.length)]
    ).join("");
}

function normalizeRoomCode(value) {
    return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function setRoomStatus(message, type = "info") {
    roomStatusMessage.textContent = message;
    roomStatusMessage.className = `room-status-message ${type}`;
}

function saveSession(roomCode, role) {
    sessionStorage.setItem(sessionKey, JSON.stringify({ roomCode, role }));
}

function openBattleGame(roomCode, role) {
    saveSession(roomCode, role);
    window.location.href = `battle-game.html?room=${encodeURIComponent(roomCode)}`;
}

async function getAuthenticatedUser() {
    if (auth.currentUser) {
        return auth.currentUser;
    }

    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
}

async function createRoom() {
    createRoomButton.disabled = true;
    setRoomStatus("部屋を作成しています…");

    try {
        const user = await getAuthenticatedUser();
        const pokemon = battlePokemonList[
            Math.floor(Math.random() * battlePokemonList.length)
        ];
        let roomCode = "";

        for (let attempt = 0; attempt < 5; attempt += 1) {
            const candidate = generateRoomCode();

            try {
                await set(ref(db, `rooms/${candidate}`), {
                    status: "waiting",
                    createdAt: Date.now(),
                    hostUid: user.uid,
                    guestUid: null,
                    pokemon,
                    players: {
                        host: { joined: true, answer: "", submitted: false },
                        guest: { joined: false, answer: "", submitted: false }
                    }
                });
                roomCode = candidate;
                break;
            } catch (error) {
                if (error.code !== "PERMISSION_DENIED" || attempt === 4) {
                    throw error;
                }
            }
        }

        if (!roomCode) {
            throw new Error("部屋コードを発行できませんでした");
        }

        generatedRoomCode.textContent = roomCode;
        roomCodeSection.hidden = false;
        setRoomStatus(`部屋を作成しました。コード: ${roomCode}`, "success");
        openBattleGame(roomCode, "host");
    } catch (error) {
        console.error("部屋の作成に失敗しました:", error);
        setRoomStatus("部屋を作成できませんでした。Firebase のルールを確認してください。", "error");
        createRoomButton.disabled = false;
    }
}

async function joinRoom() {
    const roomCode = normalizeRoomCode(battleCodeInput.value);

    if (!roomCode) {
        setRoomStatus("コードを入力してください。", "error");
        return;
    }

    joinRoomButton.disabled = true;
    setRoomStatus("部屋を確認しています…");

    try {
        const user = await getAuthenticatedUser();
        const roomReference = ref(db, `rooms/${roomCode}`);
        const snapshot = await get(roomReference);

        if (!snapshot.exists()) {
            setRoomStatus("そのコードの部屋は見つかりません。", "error");
            joinRoomButton.disabled = false;
            return;
        }

        const roomData = snapshot.val();

        if (roomData.status !== "waiting" || roomData.players?.guest?.joined) {
            setRoomStatus("その部屋は満員、または対戦中です。", "error");
            joinRoomButton.disabled = false;
            return;
        }

        await update(roomReference, {
            guestUid: user.uid
        });
        await update(roomReference, {
            status: "ready"
        });
        await update(ref(db, `rooms/${roomCode}/players/guest`), {
            joined: true
        });
        openBattleGame(roomCode, "guest");
    } catch (error) {
        console.error("部屋への参加に失敗しました:", error);
        setRoomStatus("部屋に参加できませんでした。Firebase のルールを確認してください。", "error");
        joinRoomButton.disabled = false;
    }
}

battleCodeInput.addEventListener("input", event => {
    event.target.value = normalizeRoomCode(event.target.value);
});
createRoomButton.addEventListener("click", createRoom);
joinRoomButton.addEventListener("click", joinRoom);
