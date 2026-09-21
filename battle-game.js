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
const pokemonSuggestions = document.getElementById("pokemonSuggestions");
const quizCheckButton = document.getElementById("quizCheckButton");
const battleResultPanel = document.getElementById("battleResultPanel");
const battleResultText = document.getElementById("battleResultText");
const nextRoundButton = document.getElementById("nextRoundButton");
const battleScore = document.getElementById("battleScore");
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
    audio: null,
    round: 0,
    finalizingRound: false
};
let allPokemonNames = [];
const battlePokemonList = [
    { id: 1, name: "フシギダネ" },
    { id: 6, name: "リザードン" },
    { id: 25, name: "ピカチュウ" },
    { id: 150, name: "ミュウツー" },
    { id: 658, name: "ゲッコウガ" }
];

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

async function loadPokemonNames() {
    try {
        const response = await fetch(
            "https://pokeapi.co/api/v2/pokemon-species?limit=1025"
        );

        if (!response.ok) {
            throw new Error("ポケモン名の一覧を取得できませんでした");
        }

        const speciesList = await response.json();
        const names = [];
        const batchSize = 25;

        for (let index = 0; index < speciesList.results.length; index += batchSize) {
            const batch = speciesList.results.slice(index, index + batchSize);
            const batchNames = await Promise.all(
                batch.map(async species => {
                    try {
                        const speciesResponse = await fetch(species.url);

                        if (!speciesResponse.ok) {
                            return null;
                        }

                        const speciesData = await speciesResponse.json();
                        const japaneseName = speciesData.names.find(
                            name => name.language.name === "ja"
                        );

                        if (!japaneseName) {
                            return null;
                        }

                        const speciesId = species.url.match(/\/([0-9]+)\/$/)[1];
                        return {
                            name: japaneseName.name,
                            imageUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${speciesId}.png`
                        };
                    } catch (error) {
                        console.warn("ポケモン名の取得に失敗しました:", species.name);
                        return null;
                    }
                })
            );

            names.push(...batchNames);
            allPokemonNames = names
                .filter(Boolean)
                .sort((firstPokemon, secondPokemon) =>
                    firstPokemon.name.localeCompare(secondPokemon.name, "ja")
                );
            updateSuggestions();
        }

        allPokemonNames = names
            .filter(Boolean)
            .sort((firstPokemon, secondPokemon) =>
                firstPokemon.name.localeCompare(secondPokemon.name, "ja")
            );
        updateSuggestions();
    } catch (error) {
        console.error(error);
    }
}

function updateSuggestions() {
    const query = quizAnswer.value.trim();
    const normalizedQuery = normalizeKana(query);
    const matchedNames = query
        ? allPokemonNames
            .filter(pokemon => normalizeKana(pokemon.name).startsWith(normalizedQuery))
            .slice(0, 20)
        : [];

    pokemonSuggestions.replaceChildren(
        ...matchedNames.map(pokemon => {
            const option = document.createElement("button");
            option.type = "button";
            option.className = "pokemon-suggestion";
            option.setAttribute("role", "option");
            const image = document.createElement("img");
            image.src = pokemon.imageUrl;
            image.alt = "";
            image.loading = "lazy";

            const nameLabel = document.createElement("span");
            nameLabel.textContent = pokemon.name;
            option.append(image, nameLabel);
            option.addEventListener("click", () => {
                quizAnswer.value = pokemon.name;
                pokemonSuggestions.hidden = true;
                quizAnswer.focus();
            });
            return option;
        })
    );

    pokemonSuggestions.hidden = matchedNames.length === 0;
}

function normalizeKana(text) {
    return text.replace(/[ァ-ヶ]/g, character =>
        String.fromCharCode(character.charCodeAt(0) - 0x60)
    );
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

function updateScoreDisplay(roomData) {
    const scores = roomData.scores || { host: 0, guest: 0 };
    const myScore = scores[role] || 0;
    const opponentRole = role === "host" ? "guest" : "host";
    const opponentScore = scores[opponentRole] || 0;
    battleScore.textContent = `あなた ${myScore} - ${opponentScore} 相手`;
}

function showResult(roomData) {
    const players = roomData.players || {};
    const result = roomData.roundResult;

    if (!result) {
        return;
    }

    const myCorrect = players[role]?.correct === true;
    const opponentRole = role === "host" ? "guest" : "host";
    const opponentCorrect = players[opponentRole]?.correct === true;
    const scores = roomData.scores || { host: 0, guest: 0 };
    const myScore = scores[role] || 0;
    const opponentScore = scores[opponentRole] || 0;
    battleState.resultShown = true;
    showPokemonImage();
    setWaitingState(false);
    quizAnswer.disabled = true;
    quizCheckButton.disabled = true;
    battleResultPanel.hidden = false;
    updateScoreDisplay(roomData);
    nextRoundButton.hidden = result.winner !== null || role !== "host";
    nextRoundButton.disabled = false;

    if (myCorrect && opponentCorrect) {
        quizMessage.textContent = "対戦結果が出ました。";
        battleResultText.textContent = `両者正解で1点ずつ。現在 ${myScore} - ${opponentScore} です。`;
    } else if (myCorrect) {
        quizMessage.textContent = result.winner ? "あなたの勝ちです！" : "あなたが正解しました。";
        battleResultText.textContent = `あなたに1点。現在 ${myScore} - ${opponentScore} です。`;
    } else if (opponentCorrect) {
        quizMessage.textContent = result.winner ? "相手の勝ちです。" : "相手が正解しました。";
        battleResultText.textContent = `相手に1点。現在 ${myScore} - ${opponentScore} です。`;
    } else {
        quizMessage.textContent = "対戦結果が出ました。";
        battleResultText.textContent = `両者不正解で加点なし。正解は ${battleState.correctAnswer} でした。現在 ${myScore} - ${opponentScore} です。`;
    }

    if (result.winner) {
        battleResultText.textContent += result.winner === role
            ? " 5点先取であなたの勝利です。"
            : " 5点先取で相手の勝利です。";
    }
}

async function finalizeRound(roomData) {
    if (role !== "host" || battleState.finalizingRound || roomData.status === "result") {
        return;
    }

    const hostPlayer = roomData.players?.host || {};
    const guestPlayer = roomData.players?.guest || {};

    if (!hostPlayer.submitted || !guestPlayer.submitted) {
        return;
    }

    battleState.finalizingRound = true;
    const scores = roomData.scores || { host: 0, guest: 0 };
    const nextScores = {
        host: (scores.host || 0) + (hostPlayer.correct ? 1 : 0),
        guest: (scores.guest || 0) + (guestPlayer.correct ? 1 : 0)
    };
    const winner = nextScores.host >= 5
        ? "host"
        : nextScores.guest >= 5
            ? "guest"
            : null;

    try {
        await update(ref(db, `rooms/${roomCode}`), {
            scores: nextScores,
            status: "result",
            roundResult: {
                hostCorrect: hostPlayer.correct === true,
                guestCorrect: guestPlayer.correct === true,
                winner
            }
        });
    } catch (error) {
        console.error("ラウンド結果の保存に失敗しました:", error);
    } finally {
        battleState.finalizingRound = false;
    }
}

async function advanceRound() {
    if (role !== "host" || !battleState.roomData?.roundResult || battleState.roomData.roundResult.winner) {
        return;
    }

    const nextPokemon = battlePokemonList[
        Math.floor(Math.random() * battlePokemonList.length)
    ];

    await update(ref(db, `rooms/${roomCode}`), {
        round: (battleState.roomData.round || 1) + 1,
        status: "ready",
        pokemon: nextPokemon,
        roundResult: null,
        "players/host/answer": "",
        "players/host/correct": false,
        "players/host/submitted": false,
        "players/guest/answer": "",
        "players/guest/correct": false,
        "players/guest/submitted": false
    });
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
    updateScoreDisplay(roomData);
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

    if (roomData.status === "result") {
        showResult(roomData);
        return;
    }

    if (battleState.round !== roomData.round) {
        battleState.round = roomData.round;
        battleState.started = false;
        battleState.answered = false;
        battleState.resultShown = false;
        battleResultPanel.hidden = true;
        quizAnswer.value = "";
        quizAnswer.disabled = false;
        quizCheckButton.disabled = false;
        nextRoundButton.hidden = true;
        showQuestionMark();
    }

    if (!battleState.answered && !battleState.started) {
        setWaitingState(false);
        startQuiz();
    }

    if (myPlayer.submitted && opponent.submitted) {
        finalizeRound(roomData);
    } else if (myPlayer.submitted) {
        setWaitingState(true);
    }
}

async function submitAnswer() {
    const answer = quizAnswer.value.trim();

    pokemonSuggestions.hidden = true;

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
nextRoundButton.addEventListener("click", () => {
    nextRoundButton.disabled = true;
    advanceRound().catch(error => {
        console.error("次のラウンドへの移行に失敗しました:", error);
        nextRoundButton.disabled = false;
    });
});
quizAnswer.addEventListener("input", updateSuggestions);
quizAnswer.addEventListener("focus", updateSuggestions);
quizAnswer.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        submitAnswer();
    }
});

showQuestionMark();
loadPokemonNames();

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
