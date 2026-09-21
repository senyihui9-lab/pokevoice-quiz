import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
    getAuth,
    signInAnonymously
} from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
    getDatabase,
    onValue,
    ref,
    update
} from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const quizMessage = document.getElementById("quizMessage");
const quizPokemonImage = document.getElementById("quizPokemonImage");
const quizStartButton = document.getElementById("quizStartButton");
const replayCryButton = document.getElementById("replayCryButton");
const quizAnswer = document.getElementById("quizAnswer");
const quizCheckButton = document.getElementById("quizCheckButton");
const battleResultPanel = document.getElementById("battleResultPanel");
const battleResultText = document.getElementById("battleResultText");
const waitingPopup = document.getElementById("waitingPopup");
const roomConnectionStatus = document.getElementById("roomConnectionStatus");

const firebaseConfig = {
    apiKey: "AIzaSyBMbTPARxGLgZHD3lVaY4NeOaHBVHhPRs4",
    authDomain: "pokevoice-quiz-bf927.firebaseapp.com",
    projectId: "pokevoice-quiz-bf927",
    storageBucket: "pokevoice-quiz-bf927.firebasestorage.app",
    messagingSenderId: "22531666936",
    appId: "1:22531666936:web:67a6e63414d5b15632dc0d",
    databaseURL: "https://pokevoice-quiz-bf927-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

const roomCode = new URLSearchParams(window.location.search).get("room");
const session = JSON.parse(sessionStorage.getItem("pokemon-battle-session") || "null");
const role = session?.role === "guest" ? "guest" : "host";
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const battleState = {
    correctAnswer: "",
    pokemonId: null,
    started: false,
    answered: false,
    resultShown: false,
    roomData: null,
    audio: null
};

async function getAuthenticatedUser() {
    if (auth.currentUser) {
        return auth.currentUser;
    }

    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
}

function setWaitingState(isWaiting) {
    waitingPopup.hidden = !isWaiting;
    waitingPopup.classList.toggle("show", isWaiting);
}

function showPokemonImage() {
    const image = document.createElement("img");
    image.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${battleState.pokemonId}.png`;
    image.alt = battleState.correctAnswer;
    quizPokemonImage.className = "quiz-pokemon-image has-image";
    quizPokemonImage.replaceChildren(image);
}

function showQuestionMark() {
    const questionMark = document.createElement("span");
    questionMark.textContent = "?";
    questionMark.setAttribute("aria-hidden", "true");
    quizPokemonImage.className = "quiz-pokemon-image";
    quizPokemonImage.replaceChildren(questionMark);
}

function normalizeAnswer(value) {
    return String(value || "").replace(/[\s]/g, "");
}

async function playCry() {
    if (!battleState.pokemonId) {
        return;
    }

    const audioUrl =
        `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${battleState.pokemonId}.ogg`;

    if (!battleState.audio || battleState.audio.src !== audioUrl) {
        battleState.audio = new Audio(audioUrl);
        battleState.audio.preload = "auto";
    }

    battleState.audio.currentTime = 0;

    try {
        await battleState.audio.play();
    } catch (error) {
        console.error("鳴き声の再生に失敗しました:", error);
        quizMessage.textContent = "自動再生が制限されています。スピーカーボタンを押してください。";
    }
}

function showResult(roomData) {
    const players = roomData.players || {};
    const myPlayer = players[role] || {};
    const opponentRole = role === "host" ? "guest" : "host";
    const opponent = players[opponentRole] || {};

    if (!myPlayer.submitted || !opponent.submitted) {
        return;
    }

    const myCorrect = myPlayer.correct === true;
    const opponentCorrect = opponent.correct === true;
    battleState.resultShown = true;
    showPokemonImage();
    setWaitingState(false);
    quizAnswer.disabled = true;
    quizCheckButton.disabled = true;
    battleResultPanel.hidden = false;

    if (myCorrect && opponentCorrect) {
        quizMessage.textContent = "対戦結果が出ました。";
        battleResultText.textContent = "両者とも正解です。引き分けです。";
    } else if (myCorrect) {
        quizMessage.textContent = "あなたの勝ちです！";
        battleResultText.textContent = "あなたは正解、相手は不正解でした。";
    } else if (opponentCorrect) {
        quizMessage.textContent = "相手の勝ちです。";
        battleResultText.textContent = "あなたは不正解、相手は正解でした。";
    } else {
        quizMessage.textContent = "対戦結果が出ました。";
        battleResultText.textContent = `両者とも不正解です。正解は ${battleState.correctAnswer} でした。`;
    }
}

function handleRoomUpdate(snapshot) {
    const roomData = snapshot.val();

    if (!roomData) {
        quizMessage.textContent = "部屋が見つかりません。";
        quizStartButton.disabled = true;
        return;
    }

    const authenticatedUser = auth.currentUser;
    const expectedUid = role === "host" ? roomData.hostUid : roomData.guestUid;

    if (!authenticatedUser || authenticatedUser.uid !== expectedUid) {
        quizMessage.textContent = "この部屋に参加する権限がありません。";
        quizStartButton.disabled = true;
        quizAnswer.disabled = true;
        quizCheckButton.disabled = true;
        setWaitingState(false);
        return;
    }

    battleState.roomData = roomData;
    battleState.correctAnswer = roomData.pokemon?.name || "";
    battleState.pokemonId = roomData.pokemon?.id || null;
    const opponentRole = role === "host" ? "guest" : "host";
    const myPlayer = roomData.players?.[role] || {};
    const opponent = roomData.players?.[opponentRole] || {};

    if (roomConnectionStatus) {
        roomConnectionStatus.textContent = roomData.players?.guest?.joined
            ? `部屋コード: ${roomCode}（対戦相手が参加しました）`
            : `部屋コード: ${roomCode}（相手の参加を待っています）`;
    }

    if (!roomData.players?.guest?.joined) {
        quizStartButton.disabled = true;
        quizMessage.textContent = "相手の参加を待っています。";
        setWaitingState(true);
        return;
    }

    if (!battleState.answered && !battleState.started) {
        setWaitingState(false);
        startQuiz();
    }

    if (myPlayer.submitted && opponent.submitted) {
        showResult(roomData);
    } else if (myPlayer.submitted) {
        setWaitingState(true);
    }
}

async function submitAnswer() {
    const answer = quizAnswer.value.trim();

    if (!answer || battleState.answered) {
        return;
    }

    battleState.answered = true;
    quizAnswer.disabled = true;
    quizCheckButton.disabled = true;
    setWaitingState(true);
    quizMessage.textContent = "入力を完了しました。相手の入力を待っています。";

    try {
        const user = await getAuthenticatedUser();
        const expectedUid = role === "host"
            ? battleState.roomData?.hostUid
            : battleState.roomData?.guestUid;

        if (user.uid !== expectedUid) {
            throw new Error("部屋の参加者 UID と一致しません");
        }

        await update(ref(db, `rooms/${roomCode}/players/${role}`), {
            answer,
            correct: normalizeAnswer(answer) === normalizeAnswer(battleState.correctAnswer),
            submitted: true
        });
    } catch (error) {
        console.error("回答の送信に失敗しました:", error);
        battleState.answered = false;
        quizAnswer.disabled = false;
        quizCheckButton.disabled = false;
        setWaitingState(false);
        quizMessage.textContent = "回答を送信できませんでした。通信状態を確認してください。";
    }
}

function startQuiz() {
    if (battleState.started) {
        return;
    }

    battleState.started = true;
    quizStartButton.disabled = true;
    quizStartButton.hidden = true;
    showQuestionMark();
    quizMessage.textContent = "鳴き声を聞いて、ポケモンの名前を入力してください。";
    replayCryButton.disabled = false;

    playCry();
}

quizStartButton.addEventListener("click", () => {
    startQuiz();
});

replayCryButton.addEventListener("click", () => {
    playCry();
});

quizCheckButton.addEventListener("click", submitAnswer);
quizAnswer.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        submitAnswer();
    }
});

showQuestionMark();

if (!roomCode || !session) {
    quizMessage.textContent = "部屋情報がありません。対戦モードから入り直してください。";
    quizStartButton.disabled = true;
} else {
    getAuthenticatedUser()
        .then(() => {
            onValue(ref(db, `rooms/${roomCode}`), handleRoomUpdate, error => {
                console.error("部屋情報の監視に失敗しました:", error);
                quizMessage.textContent = "部屋との接続に失敗しました。";
            });
        })
        .catch(error => {
            console.error("匿名認証に失敗しました:", error);
            quizMessage.textContent = "認証に失敗しました。対戦を開始できません。";
            quizStartButton.disabled = true;
        });
}
