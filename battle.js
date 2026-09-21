const createRoomButton = document.getElementById("createRoomButton");
const joinRoomButton = document.getElementById("joinRoomButton");
const battleCodeInput = document.getElementById("battleCode");
const roomCodeSection = document.getElementById("roomCodeSection");
const generatedRoomCode = document.getElementById("generatedRoomCode");
const roomStatusMessage = document.getElementById("roomStatusMessage");
const battleSetupScreen = document.getElementById("battleSetupScreen");
const battleGameScreen = document.getElementById("battleGameScreen");
const battleResultPanel = document.getElementById("battleResultPanel");
const battleResultText = document.getElementById("battleResultText");
const battleAnswerInputs = document.querySelectorAll(".battle-answer-input");
const battleSubmitButtons = document.querySelectorAll(".battle-submit-button");
const battlePlayerResults = document.querySelectorAll(".battle-player-result");

const ROOM_STORAGE_KEY = "pokemon-battle-room";

const roomState = {
    roomCode: "",
    players: [],
    status: "idle",
    createdAt: null,
    ready: false
};

const battleState = {
    hostAnswer: "",
    guestAnswer: "",
    hostSubmitted: false,
    guestSubmitted: false,
    hostCorrect: false,
    guestCorrect: false
};

const battlePokemonList = [
    { name: "ピカチュウ", image: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png" },
    { name: "フシギダネ", image: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png" },
    { name: "リザードン", image: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png" },
    { name: "ミュウツー", image: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png" },
    { name: "ゲッコウガ", image: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/260.png" }
];

function generateRoomCode() {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";

    for (let index = 0; index < 6; index += 1) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        code += characters[randomIndex];
    }

    return code;
}

function normalizeRoomCode(value) {
    return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function renderRoomCode(code) {
    generatedRoomCode.textContent = code || "-";
    roomCodeSection.hidden = !code;
}

function setRoomStatus(message, type = "info") {
    roomStatusMessage.textContent = message;
    roomStatusMessage.classList.remove("success", "error", "info");
    roomStatusMessage.classList.add(type);
}

function saveRoom(roomData) {
    localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(roomData));
    roomState.roomCode = roomData.roomCode;
    roomState.players = roomData.players || [];
    roomState.status = roomData.status || "waiting";
    roomState.createdAt = roomData.createdAt || new Date().toISOString();
    roomState.ready = roomData.status === "ready";
}

function showBattleGame() {
    window.location.href = "battle-game.html";
}

function hideBattleGame() {
    window.location.href = "battle.html";
}

function createRoom() {
    const roomCode = generateRoomCode();
    const roomData = {
        roomCode,
        createdAt: new Date().toISOString(),
        status: "waiting",
        players: ["host"],
        hostId: "host-user",
        guestId: null
    };

    saveRoom(roomData);
    renderRoomCode(roomCode);
    battleCodeInput.value = "";
    setRoomStatus(`部屋を作成しました。コード: ${roomCode}`, "success");
    setTimeout(() => {
        showBattleGame();
    }, 200);
    return roomCode;
}

function joinRoom() {
    const inputCode = normalizeRoomCode(battleCodeInput.value);

    if (!inputCode) {
        setRoomStatus("コードを入力してください。", "error");
        return;
    }

    const savedRoom = localStorage.getItem(ROOM_STORAGE_KEY);

    if (!savedRoom) {
        setRoomStatus("そのコードの部屋はまだ作成されていません。", "error");
        return;
    }

    try {
        const roomData = JSON.parse(savedRoom);

        if (roomData.roomCode !== inputCode) {
            setRoomStatus("入力したコードと部屋のコードが一致しません。", "error");
            return;
        }

        const players = Array.isArray(roomData.players) ? roomData.players : [];
        const nextRoomData = {
            ...roomData,
            status: "ready",
            guestId: "guest-user",
            players: players.includes("guest") ? players : [...players, "guest"]
        };

        saveRoom(nextRoomData);
        renderRoomCode(inputCode);
        setRoomStatus(`部屋に接続しました。コード: ${inputCode}`, "success");
        setTimeout(() => {
            showBattleGame();
        }, 200);
    } catch (error) {
        console.error("部屋データの読み込みに失敗しました:", error);
        setRoomStatus("部屋データの取得に失敗しました。", "error");
    }
}

function handleStorageSync(event) {
    if (event.key !== ROOM_STORAGE_KEY || !event.newValue) {
        return;
    }

    try {
        const roomData = JSON.parse(event.newValue);
        roomState.roomCode = roomData.roomCode || "";
        roomState.players = roomData.players || [];
        roomState.status = roomData.status || "waiting";
        renderRoomCode(roomState.roomCode);
        setRoomStatus(`他の参加者が接続しました。コード: ${roomState.roomCode}`, "success");
    } catch (error) {
        console.error("同期後のルームデータが不正です:", error);
    }
}

function updateBattleResult() {
    if (!battleState.hostSubmitted || !battleState.guestSubmitted) {
        return;
    }

    battleResultPanel.hidden = false;

    const hostResult = battleState.hostCorrect ? "正解" : "不正解";
    const guestResult = battleState.guestCorrect ? "正解" : "不正解";

    if (battleState.hostCorrect && battleState.guestCorrect) {
        battleResultText.textContent = `両者とも正解です。引き分けです。`;
        return;
    }

    if (battleState.hostCorrect && !battleState.guestCorrect) {
        battleResultText.textContent = `あなたの勝ちです！あなたは${hostResult}、相手は${guestResult}です。`;
        return;
    }

    if (!battleState.hostCorrect && battleState.guestCorrect) {
        battleResultText.textContent = `相手の勝ちです。あなたは${hostResult}、相手は${guestResult}です。`;
        return;
    }

    battleResultText.textContent = `両者とも不正解です。引き分けです。`;
}

function submitBattleAnswer(player) {
    const answerInput = document.querySelector(`.battle-answer-input[data-player="${player}"]`);
    const resultElement = document.querySelector(`.battle-player-result[data-player="${player}"]`);
    const answer = (answerInput.value || "").trim();

    if (!answer) {
        resultElement.textContent = "名前を入力してください。";
        return;
    }

    const correctMap = {
        host: "ピカチュウ",
        guest: "フシギダネ"
    };

    const normalizedAnswer = answer.replace(/[\s]/g, "");
    const normalizedCorrect = correctMap[player].replace(/[\s]/g, "");

    const isCorrect = normalizedAnswer === normalizedCorrect;

    if (player === "host") {
        battleState.hostSubmitted = true;
        battleState.hostAnswer = answer;
        battleState.hostCorrect = isCorrect;
    }

    if (player === "guest") {
        battleState.guestSubmitted = true;
        battleState.guestAnswer = answer;
        battleState.guestCorrect = isCorrect;
    }

    resultElement.textContent = isCorrect ? "正解" : "不正解";
    answerInput.disabled = true;
    document.querySelector(`.battle-submit-button[data-player="${player}"]`).disabled = true;
    updateBattleResult();
}

battleCodeInput.addEventListener("input", event => {
    event.target.value = normalizeRoomCode(event.target.value);
});

createRoomButton.addEventListener("click", createRoom);
joinRoomButton.addEventListener("click", joinRoom);
battleSubmitButtons.forEach(button => {
    button.addEventListener("click", () => submitBattleAnswer(button.dataset.player));
});
window.addEventListener("storage", handleStorageSync);
