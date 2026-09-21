import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
    getAuth,
    signInAnonymously
} from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
    get,
    getDatabase,
    onValue,
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
    roomStatusMessage.hidden = false;
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

function waitForOpponent(roomCode) {
    const roomReference = ref(db, `rooms/${roomCode}`);

    onValue(roomReference, snapshot => {
        const roomData = snapshot.val();

        if (roomData?.guestUid) {
            setRoomStatus("相手が参加しました。対戦画面へ移動します…", "success");
            openBattleGame(roomCode, "host");
        }
    }, error => {
        console.error("相手の参加状態の監視に失敗しました:", error);
        setRoomStatus("相手の参加状態を確認できません。", "error");
        createRoomButton.disabled = false;
    });
}

async function getAuthenticatedUser() {
    if (auth.currentUser) {
        return auth.currentUser;
    }

    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
}

async function fetchRandomPokemon() {
    const randomId = Math.floor(Math.random() * 1025) + 1;
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${randomId}`);

    if (!response.ok) {
        throw new Error("ポケモン情報を取得できませんでした");
    }

    const data = await response.json();
    const speciesResponse = await fetch(data.species.url);

    if (!speciesResponse.ok) {
        throw new Error("ポケモンの日本語名を取得できませんでした");
    }

    const speciesData = await speciesResponse.json();
    const japaneseName = speciesData.names.find(
        name => name.language.name === "ja"
    );

    return {
        id: data.id,
        name: japaneseName ? japaneseName.name : data.name
    };
}

async function createRoom() {
    createRoomButton.disabled = true;
    setRoomStatus("部屋を作成しています…");

    try {
        const user = await getAuthenticatedUser();
        const pokemon = await fetchRandomPokemon();
        let roomCode = "";

        for (let attempt = 0; attempt < 5; attempt += 1) {
            const candidate = generateRoomCode();

            try {
                await set(ref(db, `rooms/${candidate}`), {
                    status: "waiting",
                    createdAt: Date.now(),
                    round: 1,
                    scores: { host: 0, guest: 0 },
                    roundResult: null,
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
        roomStatusMessage.hidden = true;
        waitForOpponent(roomCode);
    } catch (error) {
        console.error("部屋の作成に失敗しました:", error);
        if (error.code === "auth/operation-not-allowed") {
            setRoomStatus("匿名認証が無効です。Firebase Console で匿名ログインを有効にしてください。", "error");
        } else if (error.code === "PERMISSION_DENIED" || error.code === "database/permission-denied") {
            setRoomStatus("Firebase の書き込みルールで拒否されました。Realtime Database の Rules を確認してください。", "error");
        } else {
            const errorCode = error.code ? ` [${error.code}]` : "";
            setRoomStatus(`部屋を作成できませんでした。${errorCode} ${error.message || "Firebase の設定を確認してください。"}`, "error");
        }
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
