const quizMessage = document.getElementById("quizMessage");
const quizPokemonImage = document.getElementById("quizPokemonImage");
const quizStartButton = document.getElementById("quizStartButton");
const replayCryButton = document.getElementById("replayCryButton");
const quizAnswer = document.getElementById("quizAnswer");
const quizCheckButton = document.getElementById("quizCheckButton");
const battleResultPanel = document.getElementById("battleResultPanel");
const battleResultText = document.getElementById("battleResultText");
const waitingPopup = document.getElementById("waitingPopup");

const battleState = {
    correctAnswer: "ピカチュウ",
    answered: false,
    waitingForOpponent: false,
    opponentSubmitted: false,
    resultShown: false
};

function showPokemonImage() {
    const image = document.createElement("img");
    image.src = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png";
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

function setWaitingState(isWaiting) {
    battleState.waitingForOpponent = isWaiting;
    waitingPopup.hidden = !isWaiting;
    waitingPopup.classList.toggle("show", isWaiting);
}

function setBattleResultState(isCorrect) {
    battleState.answered = true;
    battleState.resultShown = true;
    quizAnswer.disabled = true;
    quizCheckButton.disabled = true;
    setWaitingState(false);

    if (isCorrect) {
        quizMessage.textContent = "あなたの勝ちです！";
        battleResultText.textContent = "正解です。相手の答えと比較して勝利しました。";
    } else {
        quizMessage.textContent = "残念でした。";
        battleResultText.textContent = `不正解です。正解は ${battleState.correctAnswer} でした。`;
    }

    battleResultPanel.hidden = false;
}

function handleOpponentSubmit() {
    battleState.opponentSubmitted = true;
    setWaitingState(false);
    quizMessage.textContent = "相手が入力を完了しました。結果を確認してください。";
    battleResultPanel.hidden = false;
    battleResultText.textContent = "相手が回答しました。結果を比較中です。";
}

quizStartButton.addEventListener("click", () => {
    quizMessage.textContent = "鳴き声を聞いて、ポケモンの名前を入力してください。";
    showQuestionMark();
    showPokemonImage();
    quizStartButton.disabled = true;
});

replayCryButton.addEventListener("click", () => {
    const audio = new Audio("https://raw.githubusercontent.com/PokeAPI/sounds/master/cries/pokemon/latest/25.ogg");
    audio.play().catch(() => {});
});

quizCheckButton.addEventListener("click", () => {
    const answer = (quizAnswer.value || "").trim();

    if (!answer) {
        quizMessage.textContent = "ポケモンの名前を入力してください。";
        return;
    }

    const isCorrect = answer.replace(/[\s]/g, "") === battleState.correctAnswer.replace(/[\s]/g, "");
    battleState.answered = true;
    setWaitingState(true);
    quizMessage.textContent = "入力を完了しました。相手の入力を待っています。";
    quizCheckButton.disabled = true;
    quizAnswer.disabled = true;

    if (battleState.opponentSubmitted) {
        setBattleResultState(isCorrect);
        return;
    }

    setTimeout(() => {
        handleOpponentSubmit();
        if (isCorrect) {
            battleResultText.textContent = "相手が入力しました。あなたは正解でした。";
        } else {
            battleResultText.textContent = "相手が入力しました。あなたは不正解でした。";
        }
    }, 1200);
});

showQuestionMark();
